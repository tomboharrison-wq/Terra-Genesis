import { overlayById } from '../renderer/overlays';
import { lavaClosure, tephraClosure } from '../sim/lava/lavaSim';
import { Engine, type VolcanoType } from '../engine/engine';
import type { WorldState } from '../engine/world';
import { generateWorld, defaultOptions, type GenerateOptions } from '../terrain/generate';
import type { TerrainScene, CameraPose } from '../renderer/TerrainScene';
import { useUi } from '../state/uiStore';
import { AUTOSAVE_ID, loadSlot, saveSlot } from '../persistence/idb';
import { worldFromFileBytes, worldToFileBytes } from '../persistence/format';
import { runGpuSelfTest } from '../sim/water/gpuSelfTest';
import { closureError, ledgerIn, ledgerOut } from '../sim/water/ledger';
import { sedimentClosure } from '../sim/sediment/sedimentSim';
import { MM_PER_H } from '../engine/world';

/**
 * Process-wide runtime: the single Engine (world owner) and the active TerrainScene.
 * UI components call these functions; they never touch typed arrays directly.
 */
export const engine = new Engine(generateWorld(defaultOptions('river-basin', 20261022, 256)));
// The default river basin starts paused with its preset rain (60 mm/h): press Play to watch it drain.
let scene: TerrainScene | null = null;

export function attachScene(s: TerrainScene | null) {
  scene = s;
}
export const getScene = () => scene;

function syncWorldInfo() {
  const w = engine.world;
  useUi.getState().set({
    world: {
      name: w.meta.name,
      presetId: w.meta.presetId,
      width: w.width,
      height: w.height,
      cellSizeM: w.cellSizeM,
      seaLevelM: w.seaLevelM,
      seed: w.seed,
    },
  });
}

function syncHistory() {
  const h = engine.history;
  useUi.getState().set({ canUndo: h.canUndo, canRedo: h.canRedo, undoLabel: h.undoLabel, redoLabel: h.redoLabel });
}

/** Push simulation/water state into the UI store (throttled by callers). */
export function syncSim() {
  const w = engine.world;
  const L = engine.water.ledger;
  const stored = engine.water.storedVolume();
  useUi.getState().set({
    sim: {
      playing: engine.clock.playing,
      speed: engine.clock.speed,
      achievedSpeed: engine.clock.achievedSpeed,
      simTimeS: w.simTimeSeconds,
      backend: engine.backend,
      storedM3: stored,
      inM3: ledgerIn(L),
      outM3: ledgerOut(L),
      closure: closureError(L, stored),
      maxDepthM: engine.water.maxDepth,
      maxSpeedMS: engine.water.maxSpeed,
      rainMmH: w.water.rainMPerS / MM_PER_H,
      infMmH: w.water.infiltrationMPerS / MM_PER_H,
      evapMmH: w.water.evaporationMPerS / MM_PER_H,
      boundary: w.water.boundary,
      sources: w.water.sources.map((s) => ({ ...s })),
      erosionOn: w.erosion.enabled,
      speedup: w.erosion.speedup,
      bedrockFactor: w.erosion.bedrockFactor,
      creepK: w.erosion.creepK,
      weatherK: w.erosion.weatherK,
      slopeFailure: w.erosion.slopeFailure,
      ...(() => {
        let zMin = Infinity;
        let zMax = -Infinity;
        for (const z of engine.surface) {
          if (z < zMin) zMin = z;
          if (z > zMax) zMax = z;
        }
        return { zMin, zMax };
      })(),
      coast: { ...w.coast, ...engine.coast.ledger },
      climate: (() => {
        let tMin = Infinity;
        let tMax = -Infinity;
        let rMin = Infinity;
        let rMax = -Infinity;
        const c = engine.climate;
        for (let i = 0; i < engine.surface.length; i++) {
          if (engine.surface[i] < w.seaLevelM) continue;
          tMin = Math.min(tMin, c.temperatureC[i]);
          tMax = Math.max(tMax, c.temperatureC[i]);
          rMin = Math.min(rMin, c.rainFactor[i]);
          rMax = Math.max(rMax, c.rainFactor[i]);
        }
        let covered = 0;
        let land = 0;
        for (let i = 0; i < engine.surface.length; i++) {
          if (engine.surface[i] < w.seaLevelM) continue;
          land++;
          if (w.snowSweM[i] > 0.005) covered++;
        }
        return {
          ...w.climate,
          landTempMinC: tMin,
          landTempMaxC: tMax,
          rainMinX: rMin,
          rainMaxX: rMax,
          snowM3: engine.water.snowVolume(),
          snowCoverPct: land ? (100 * covered) / land : 0,
          snowfallM3: L.snowfall,
          snowmeltM3: L.snowmelt,
        };
      })(),
      lava: {
        vents: w.lava.vents.map((v) => ({ ...v })),
        eruptedM3: engine.lava.ledger.erupted,
        flowingM3: engine.lava.flowingVolume(),
        solidifiedM3: engine.lava.ledger.solidified,
        maxTempC: engine.lava.maxTemp(),
        closure: lavaClosure(engine.lava),
        tephraEruptedM3: engine.lava.ledger.tephraErupted,
        tephraDepositedM3: engine.lava.ledger.tephraDeposited,
        tephraOffMapM3: engine.lava.ledger.tephraOffMap,
        tephraClosure: tephraClosure(engine.lava),
        plumeKm: engine.lava.lastPlumeKm,
        windSpeedMS: w.lava.windSpeedMS,
      },
      tectonics: (() => {
        const t = w.tectonics;
        const s = engine.tectonics;
        let c = 0;
        let d = 0;
        let tr = 0;
        for (const b of s.boundary) b === 1 ? c++ : b === 2 ? d++ : b === 3 ? tr++ : 0;
        let maxE = -Infinity;
        for (const z of engine.surface) if (z > maxE) maxE = z;
        return {
          enabled: t.enabled,
          yearsPerSimHour: t.yearsPerSimHour,
          beltWidthM: t.beltWidthM,
          plates: t.plates.map((q) => ({ ...q })),
          upliftedM3: s.ledger.uplifted,
          subsidedM3: s.ledger.subsided,
          years: s.ledger.years,
          convergent: c,
          divergent: d,
          transform: tr,
          maxElevM: maxE,
          revision: engine.plateRevision,
          slipM: s.ledger.slipM,
          shifts: s.ledger.shifts,
          volcanicM3: s.ledger.volcanic,
          vents: s.vents.length,
        };
      })(),
      vegetation: (() => {
        const v = w.vegetation;
        const st = engine.vegetation.stats();
        const c = w.climate;
        return {
          enabled: v.enabled,
          annualPrecipMm: v.annualPrecipMm,
          yearsPerSimHour: v.yearsPerSimHour,
          erosionShield: v.erosionShield,
          coverPct: st.coverPct,
          forestPct: st.forestPct,
          treelineM: w.seaLevelM + ((c.seaLevelTempC + c.seasonalAmpC - 6) / c.lapseRateCPerKm) * 1000,
        };
      })(),
      glacier: (() => {
        const g = engine.glacier;
        const p = w.glacier;
        let area = 0;
        let land = 0;
        let maxIce = 0;
        for (let i = 0; i < w.iceThicknessM.length; i++) {
          if (engine.surface[i] >= w.seaLevelM) land++;
          if (w.iceThicknessM[i] > 1) area++;
          if (w.iceThicknessM[i] > maxIce) maxIce = w.iceThicknessM[i];
        }
        const c = w.climate;
        return {
          enabled: p.enabled,
          yearsPerSimHour: p.yearsPerSimHour,
          elaTempC: p.elaTempC,
          abrasionK: p.abrasionK,
          slidingFactor: p.slidingFactor,
          elaM: w.seaLevelM + ((c.seaLevelTempC - p.elaTempC) / c.lapseRateCPerKm) * 1000,
          iceM3: g.iceVolume(),
          iceAreaPct: land ? (100 * area) / land : 0,
          maxIceM: maxIce,
          maxSlideMPerYr: g.maxSlideMPerYr,
          erodedM3: g.ledger.eroded,
          morainedM3: g.ledger.deposited,
          years: g.ledger.timeS / (365.25 * 86400),
          lagYears: g.ledger.lagS / (365.25 * 86400),
        };
      })(),
      sed: (() => {
        const S = engine.sediment.ledger;
        const susp = engine.sediment.suspendedVolume();
        return {
          weathered: S.weathered,
          rockfall: S.rockfall,
          erodedLoose: S.erodedLoose,
          erodedBedrock: S.erodedBedrock,
          deposited: S.deposited,
          seaDeposited: S.seaDeposited,
          exported: S.edgeExport,
          suspended: susp,
          closure: sedimentClosure(S, susp),
        };
      })(),
    },
  });
}

let autosaveTimer: ReturnType<typeof setTimeout> | undefined;
function scheduleAutosave() {
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => {
    void saveToSlot(AUTOSAVE_ID, 'Autosave', true);
  }, 2500);
}

engine.on((e) => {
  if (e.type === 'world-replaced') {
    useUi.getState().set({ pins: [], profile: null, profileStart: null }); // positions belong to the old world
    const ov = overlayById(useUi.getState().terrainOverlay);
    if (ov && !ov.available(engine)) useUi.getState().set({ terrainOverlay: 'none' }); // no data for it in this world
    syncWorldInfo();
    syncSim();
    scheduleAutosave();
  }
  if (e.type === 'sim-state-changed' || e.type === 'water-params-changed' || e.type === 'climate-changed') {
    syncSim();
    if (!engine.clock.playing) scheduleAutosave();
  }
  if (e.type === 'history-changed') {
    syncHistory();
    scheduleAutosave();
  }
});
syncWorldInfo();
syncSim();

// Autosave periodically while the simulation runs.
setInterval(() => {
  if (engine.clock.playing) void saveToSlot(AUTOSAVE_ID, 'Autosave', true);
}, 60_000);

export function newWorld(o: GenerateOptions, autoplay = false) {
  const t = performance.now();
  engine.replaceWorld(generateWorld(o));
  if (autoplay) engine.setPlaying(true);
  useUi.getState().toast(`Generated ${o.size}² ${o.name ?? o.presetId} in ${Math.round(performance.now() - t)} ms`, 'success');
}

export function replaceWorld(w: WorldState, pose?: CameraPose) {
  engine.replaceWorld(w);
  if (pose) scene?.setPose(pose);
}

function extras() {
  return scene ? { camera: scene.getPose() } : undefined;
}

export async function saveToSlot(id: string, name: string, quiet = false) {
  try {
    engine.syncWater();
    const bytes = await worldToFileBytes(engine.world, extras());
    const w = engine.world;
    const info = await saveSlot({ id, name, width: w.width, height: w.height, presetId: w.meta.presetId }, bytes);
    useUi.getState().set({ lastSavedIso: info.savedAtIso });
    if (!quiet) useUi.getState().toast(`Saved “${name}” (${(bytes.byteLength / 1024).toFixed(0)} KB)`, 'success');
  } catch (err) {
    useUi.getState().toast(`Save failed: ${(err as Error).message}`, 'error');
  }
}

export async function loadFromSlot(id: string): Promise<boolean> {
  try {
    const bytes = await loadSlot(id);
    if (!bytes) return false;
    const { world, extras } = await worldFromFileBytes(bytes);
    replaceWorld(world, (extras?.camera as CameraPose | undefined) ?? undefined);
    return true;
  } catch (err) {
    useUi.getState().toast(`Load failed: ${(err as Error).message}`, 'error');
    return false;
  }
}

export async function exportWorldFile() {
  engine.syncWater();
  const bytes = await worldToFileBytes(engine.world, extras());
  const blob = new Blob([bytes], { type: 'application/octet-stream' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${engine.world.meta.name.replace(/[^\w-]+/g, '_') || 'world'}.tgw`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  useUi.getState().toast(`Exported ${a.download}`, 'success');
}

export async function importWorldFile(file: File) {
  try {
    const { world, extras } = await worldFromFileBytes(new Uint8Array(await file.arrayBuffer()));
    replaceWorld(world, extras?.camera as CameraPose | undefined);
    useUi.getState().toast(`Imported ${file.name}`, 'success');
  } catch (err) {
    useUi.getState().toast(`Import failed: ${(err as Error).message}`, 'error');
  }
}

export function renameWorld(name: string) {
  engine.world.meta.name = name;
  syncWorldInfo();
  scheduleAutosave();
}

/** On startup restore the autosave if present. */
export async function restoreAutosave(): Promise<boolean> {
  const ok = await loadFromSlot(AUTOSAVE_ID);
  if (ok) useUi.getState().toast('Restored last session', 'info');
  return ok;
}

/** Cancel pending autosave when we are about to unload (avoid racing). Save immediately. */
export function flushAutosave() {
  clearTimeout(autosaveTimer);
  void saveToSlot(AUTOSAVE_ID, 'Autosave', true);
}

export { syncHistory };

/** Read-only debug/testing handle (used by scripts/screenshot.mjs browser checks). */
(globalThis as unknown as { __terraGenesis: unknown }).__terraGenesis = {
  engine,
  ui: () => useUi.getState(),
  gpuSelfTest: (seconds?: number) => runGpuSelfTest(undefined, seconds),
  info: () => {
    const r = scene?.renderer;
    return r ? { children: scene!.scene.children.length, ...r.info.memory, programs: r.info.programs?.length, calls: r.info.render.calls } : null;
  },
  /** Mean ms per synchronous render of n frames (forces GPU completion via readPixels). */
  benchRender: (n = 20) => {
    const sc = scene;
    if (!sc) return -1;
    const gl = sc.renderer.getContext();
    const px = new Uint8Array(4);
    const t = performance.now();
    for (let k = 0; k < n; k++) {
      sc.renderer.render(sc.scene, sc.camera);
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    }
    return (performance.now() - t) / n;
  },
  checksum: () => engine.surface.reduce((a, v) => a + v, 0),
};

/** Build a volcano one eruption per frame, showing progress (spec E10, M08-C03). */
export function runVolcanoBuild(xM: number, yM: number, type: VolcanoType, episodes: number): void {
  const ui = useUi.getState();
  const b = engine.buildVolcano(xM, yM, type, episodes);
  ui.set({ volcanoBuild: { type, done: 0, total: b.total } });
  syncSim();
  const tick = () => {
    const more = b.step();
    useUi.getState().set({ volcanoBuild: more ? { type, done: b.done, total: b.total } : null });
    if (more) requestAnimationFrame(() => setTimeout(tick, 0));
    else {
      syncSim();
      useUi.getState().toast(`Built a ${type} volcano from ${b.total} eruptions. Use Profile to see its shape; Ctrl+Z undoes it.`, 'success');
    }
  };
  requestAnimationFrame(() => setTimeout(tick, 0));
}
