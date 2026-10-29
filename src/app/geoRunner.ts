import { GEO_MAX_STEP_YEARS, type GeoResult } from '../engine/engine';
import type { GeoJob } from '../sim/geology/geoWorker';
import { cloneMeander, type MeanderState } from '../sim/geology/meander';
import { useUi } from '../state/uiStore';
import { engine, onWorldReplaced, syncSim } from './runtime';

/**
 * Geological time driver. Runs the landscape evolution model (sim/geology) in a Web Worker on a copy
 * of the terrain, in chunks of ~¼ s of requested time, and applies each result to the engine — so the
 * 3D view stays smooth however slow a step is. A result computed from terrain that a tool changed in
 * the meantime is discarded. Without Web Workers (tests) it runs on this thread.
 *
 * Record and replay: a frame of the terrain is kept about once per real second of running (and at
 * the start). showFrame(k) puts the world back to frame k exactly; running on from an earlier frame
 * discards the later ones (a new branch of history).
 */
export const GEO_SPEEDS = [
  { v: 1000, label: '1,000 years / s' },
  { v: 10000, label: '10,000 years / s' },
  { v: 100000, label: '100,000 years / s' },
];
export const MAX_FRAMES = 48;

export interface GeoFrame {
  years: number;
  bed: Float32Array;
  soil: Float32Array;
  material: Uint8Array;
  meander: MeanderState | null;
}

let worker: Worker | null = null;
let jobId = 0;
let inFlight: { id: number; rev: number; t0: number; years: number; world: object; done?: () => void } | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let achieved = 0;
let lastFrameYears = -Infinity;
export const frames: GeoFrame[] = [];

const ui = () => useUi.getState();
const setGeo = (p: Partial<ReturnType<typeof ui>['geo']>) => ui().set({ geo: { ...ui().geo, ...p } });

function publish() {
  setGeo({ years: engine.geologicYears, achieved, frames: frames.map((f) => f.years) });
  syncSim();
}

function getWorker(): Worker | null {
  if (worker || typeof Worker === 'undefined') return worker;
  try {
    worker = new Worker(new URL('../sim/geology/geoWorker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<GeoResult & { id: number }>) => onResult(e.data);
    worker.onerror = () => {
      worker = null; // fall back to this thread
    };
  } catch {
    worker = null;
  }
  return worker;
}

function record(force = false) {
  const y = engine.geologicYears;
  const every = ui().geo.yearsPerSec; // about one frame per real second of running
  if (!force && y - lastFrameYears < every * 0.999) return;
  const w = engine.world;
  frames.push({
    years: y,
    bed: w.bedrockElevationM.slice(),
    soil: w.looseSedimentThicknessM.slice(),
    material: w.materialId.slice(),
    meander: engine.geoMeander ? cloneMeander(engine.geoMeander) : null,
  });
  lastFrameYears = y;
  if (frames.length > MAX_FRAMES) {
    // Keep the whole span at half the resolution: drop every other frame (first and last stay).
    const keep = frames.filter((_, k) => k % 2 === 0 || k === frames.length - 1);
    frames.length = 0;
    frames.push(...keep);
  }
}

/** Switch the time bar between water time and geological time. */
export function setGeoMode(on: boolean) {
  if (!on) stopGeo();
  if (on) {
    engine.setPlaying(false);
    engine.beginGeologic();
  }
  setGeo({ mode: on, viewing: null });
  publish();
}

export function setGeoSpeed(v: number) {
  setGeo({ yearsPerSec: v });
}

function chunkYears() {
  return ui().geo.yearsPerSec * 0.25;
}

function send(years: number, done?: () => void) {
  const w = engine.world;
  const wk = getWorker();
  if (!wk) {
    const t0 = performance.now();
    engine.geoStep(years);
    afterChunk(years, t0);
    done?.();
    return;
  }
  const job: GeoJob = {
    id: ++jobId,
    width: w.width,
    height: w.height,
    cellSizeM: w.cellSizeM,
    seaLevelM: w.seaLevelM,
    boundary: w.water.boundary,
    bed: w.bedrockElevationM.slice(),
    soil: w.looseSedimentThicknessM.slice(),
    material: w.materialId.slice(),
    strataBounds: w.strataBoundsM.slice(),
    strataMaterial: w.strataMaterial.slice(),
    years,
    maxStepYears: GEO_MAX_STEP_YEARS, // and never longer than the accurate step (LandscapeEvolution.run)
    params: { ...engine.geoParams },
    meander: engine.geoMeander ? cloneMeander(engine.geoMeander) : null,
  };
  inFlight = { id: job.id, rev: engine.editRevision, t0: performance.now(), years, world: w, done };
  setGeo({ busy: true });
  wk.postMessage(job, [job.bed.buffer, job.soil.buffer, job.material.buffer, job.strataBounds.buffer, job.strataMaterial.buffer]);
}

function onResult(r: GeoResult & { id: number }) {
  const job = inFlight;
  inFlight = null;
  setGeo({ busy: false });
  if (!job || job.id !== r.id) return;
  // Terrain edited, or a different world, while this ran: discard and run again from the current terrain.
  const stale = job.world !== engine.world || job.rev !== engine.editRevision;
  if (!stale) {
    engine.applyGeologic(r);
    afterChunk(job.years, job.t0);
    job.done?.();
  } else if (job.done) {
    if (job.world === engine.world) send(job.years, job.done); // a scripted run: redo this chunk from the edited terrain
    else job.done();
  } else if (ui().geo.playing) schedule(0);
}

/**
 * Run exactly `years` of geological time (lesson stages): in ~10 chunks so the landscape is seen
 * changing, resolving when all of it is applied.
 */
export function runGeoYears(years: number): Promise<void> {
  if (ui().geo.playing) stopGeo();
  engine.beginGeologic();
  if (frames.length === 0) record(true);
  const chunk = Math.max(5000, years / 10);
  return new Promise((resolve) => {
    let left = years;
    const next = () => {
      if (left <= 1e-9) return resolve();
      const y = Math.min(left, chunk);
      left -= y;
      send(y, next);
    };
    next();
  });
}

function afterChunk(years: number, t0: number) {
  const dt = (performance.now() - t0) / 1000;
  const rate = years / Math.max(dt, 1e-3);
  achieved = achieved > 0 ? 0.6 * achieved + 0.4 * Math.min(rate, ui().geo.yearsPerSec) : Math.min(rate, ui().geo.yearsPerSec);
  record();
  publish();
  if (ui().geo.playing) schedule(Math.max(0, (years / ui().geo.yearsPerSec) * 1000 - dt * 1000));
}

function schedule(ms: number) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    if (ui().geo.playing && !inFlight) send(chunkYears());
  }, ms);
}

/** Start running geological time (continues from the frame being viewed, discarding later frames). */
export function playGeo() {
  if (!ui().geo.mode) setGeoMode(true);
  const v = ui().geo.viewing;
  if (v !== null) {
    frames.length = v + 1;
    lastFrameYears = frames[v]?.years ?? -Infinity;
  }
  engine.beginGeologic();
  if (frames.length === 0) record(true);
  achieved = 0;
  setGeo({ playing: true, viewing: null });
  if (!inFlight) send(chunkYears());
}

export function stopGeo() {
  if (timer) clearTimeout(timer);
  timer = null;
  setGeo({ playing: false });
  achieved = 0;
  publish();
}

/** One chunk of `years` (Step button). */
export function stepGeo(years: number) {
  if (ui().geo.playing || inFlight) return;
  playGeoOnce(years);
}

function playGeoOnce(years: number) {
  const v = ui().geo.viewing;
  if (v !== null) {
    frames.length = v + 1;
    lastFrameYears = frames[v]?.years ?? -Infinity;
    setGeo({ viewing: null });
  }
  engine.beginGeologic();
  if (frames.length === 0) record(true);
  send(years);
}

/** Show recorded frame k (the world really goes back to it; Play continues from there). */
export function showFrame(k: number) {
  const f = frames[k];
  if (!f) return;
  if (ui().geo.playing) stopGeo();
  engine.restoreGeoFrame(f);
  setGeo({ viewing: k === frames.length - 1 ? null : k });
  publish();
}

/** Forget the recording (e.g. a new world). */
export function clearFrames() {
  frames.length = 0;
  lastFrameYears = -Infinity;
  setGeo({ frames: [], viewing: null });
}

onWorldReplaced(() => {
  stopGeo();
  inFlight = null;
  clearFrames();
  setGeo({ mode: false, years: engine.geologicYears });
});

// Pressing Play in water time ends geological running.
engine.on((e) => {
  if (e.type === 'sim-state-changed' && engine.clock.playing && ui().geo.playing) stopGeo();
});
