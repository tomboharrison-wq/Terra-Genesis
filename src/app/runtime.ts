import { Engine } from '../engine/engine';
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
      sed: (() => {
        const S = engine.sediment.ledger;
        const susp = engine.sediment.suspendedVolume();
        return {
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
    syncWorldInfo();
    syncSim();
    scheduleAutosave();
  }
  if (e.type === 'sim-state-changed' || e.type === 'water-params-changed') {
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
