import { cloneWorld, computeSurface, type WorldState } from './world';

/**
 * Checkpoints (spec F3): physical history is restored from snapshots, never by running time backwards.
 * A checkpoint is a full copy of the world (every field, every parameter) plus its derived surface.
 * Kept in memory for this session only (Save keeps a world for good).
 */
export interface Checkpoint {
  id: number;
  label: string;
  simTimeS: number;
  createdAtIso: string;
  world: WorldState;
  surface: Float32Array;
  /** Memory held (bytes). */
  bytes: number;
}

export const MAX_CHECKPOINTS = 6;

export function worldBytes(w: WorldState): number {
  let b = 0;
  for (const v of Object.values(w)) if (ArrayBuffer.isView(v)) b += v.byteLength;
  return b;
}

export function makeCheckpoint(w: WorldState, id: number, label: string): Checkpoint {
  const world = cloneWorld(w);
  const surface = new Float32Array(w.width * w.height);
  computeSurface(world, surface);
  return { id, label, simTimeS: w.simTimeSeconds, createdAtIso: new Date().toISOString(), world, surface, bytes: worldBytes(world) + surface.byteLength };
}

/** What changed between a checkpoint and now (both the same map). Volumes in m³, areas in m². */
export interface DiffSummary {
  /** Ground lowered (erosion, collapse) and raised (deposition, lava, uplift), m³. */
  loweredM3: number;
  raisedM3: number;
  /** Area where the ground moved by more than 5 cm. */
  changedAreaM2: number;
  maxLoweringM: number;
  maxRaisingM: number;
  /** Change in standing water, ice (as ice) and cover-weighted plant area. */
  waterChangeM3: number;
  iceChangeM3: number;
  plantAreaChangeM2: number;
  elapsedS: number;
}

export function diffSummary(cp: Checkpoint, w: WorldState, surface: Float32Array): DiffSummary {
  const A = w.cellSizeM * w.cellSizeM;
  const o = cp.world;
  let lowered = 0;
  let raised = 0;
  let area = 0;
  let maxLo = 0;
  let maxHi = 0;
  let water = 0;
  let ice = 0;
  let plants = 0;
  for (let i = 0; i < surface.length; i++) {
    const dz = surface[i] - cp.surface[i];
    if (dz < 0) lowered -= dz;
    else raised += dz;
    if (Math.abs(dz) > 0.05) area++;
    if (-dz > maxLo) maxLo = -dz;
    if (dz > maxHi) maxHi = dz;
    water += w.waterDepthM[i] - o.waterDepthM[i];
    ice += w.iceThicknessM[i] - o.iceThicknessM[i];
    plants += w.vegCover[i] - o.vegCover[i];
  }
  return {
    loweredM3: lowered * A,
    raisedM3: raised * A,
    changedAreaM2: area * A,
    maxLoweringM: maxLo,
    maxRaisingM: maxHi,
    waterChangeM3: water * A,
    iceChangeM3: ice * A,
    plantAreaChangeM2: plants * A,
    elapsedS: w.simTimeSeconds - cp.simTimeS,
  };
}
