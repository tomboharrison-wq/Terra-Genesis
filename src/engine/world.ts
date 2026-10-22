import type { CellRect } from '../utils/rect';

export const WORLD_FORMAT_VERSION = 3;

export type BoundaryMode = 'open' | 'closed';

/** Fixed inflow (spring / river inlet) at a cell. */
export interface WaterSource {
  id: number;
  x: number;
  y: number;
  rateM3PerS: number;
}

/** Hydrology forcing and boundary parameters (SI). */
export interface WaterParams {
  /** Map-wide rainfall intensity (m/s). 1 mm/h = 1/3.6e6 m/s. */
  rainMPerS: number;
  /** Potential infiltration into the ground (m/s); removed water is ledgered. */
  infiltrationMPerS: number;
  /** Potential evaporation (m/s). */
  evaporationMPerS: number;
  /** Map edges: open = free outfall, closed = wall. */
  boundary: BoundaryMode;
  /** Manning roughness n (s/m^(1/3)). */
  manningN: number;
  sources: WaterSource[];
}

export const MM_PER_H = 1 / 3.6e6;

/**
 * Hydraulic erosion / deposition parameters (spec E2). Transport capacity per unit area
 * C = capacityK · q · S  (m of bulk sediment), q = depth·speed (m²/s), S = bed slope.
 * Below capacity flow erodes at erodeK·(C − s) (loose sediment first, then bedrock scaled by
 * lithology erodibility × bedrockFactor); above capacity it deposits at depositK·(s − C).
 * `speedup` multiplies erosion and deposition rates together (geomorphic acceleration —
 * a labelled, non-physical time compression so landforms change within minutes).
 * `creepK` is hillslope diffusivity (m²/s at ×1) acting on loose sediment: flux ∝ −∇z,
 * limited to the loose sediment available. Smooths grid-scale roughness; valleys persist.
 */
export interface ErosionParams {
  enabled: boolean;
  creepK: number;
  capacityK: number;
  erodeK: number;
  depositK: number;
  bedrockFactor: number;
  speedup: number;
}

export function defaultErosionParams(): ErosionParams {
  return { enabled: false, creepK: 0, capacityK: 0.05, erodeK: 0.01, depositK: 0.02, bedrockFactor: 0.1, speedup: 10 };
}

export function defaultWaterParams(): WaterParams {
  return { rainMPerS: 0, infiltrationMPerS: 0, evaporationMPerS: 0, boundary: 'open', manningN: 0.035, sources: [] };
}

export interface WorldMeta {
  name: string;
  presetId: string;
  /** Total vertical relief requested at generation (m). Informational. */
  reliefM: number;
  createdAtIso: string;
}

/**
 * Authoritative physical world state (spec C3). All fields SI units.
 * Array index i = y * width + x (x east, y north). Surface elevation is derived.
 */
export interface WorldState {
  version: number;
  width: number;
  height: number;
  cellSizeM: number;
  seaLevelM: number;
  seed: number;
  simTimeSeconds: number;
  bedrockElevationM: Float32Array;
  looseSedimentThicknessM: Float32Array;
  /** Bedrock lithology id, see terrain/materials.ts. */
  materialId: Uint8Array;
  /** Surface water depth above the ground surface (m), ≥ 0. Zero on sea cells (sea is a fixed-head sink). */
  waterDepthM: Float32Array;
  /** Pipe-model outflow per cell, 4 per cell [west, east, south, north] (m³/s), ≥ 0. */
  waterFluxM3PerS: Float32Array;
  water: WaterParams;
  /** Suspended sediment carried by surface water, as bulk deposit thickness (m), ≥ 0. */
  sedimentSuspendedM: Float32Array;
  erosion: ErosionParams;
  meta: WorldMeta;
}

export interface WorldInit {
  width: number;
  height: number;
  cellSizeM: number;
  seaLevelM?: number;
  seed: number;
  meta?: Partial<WorldMeta>;
}

export function createWorld(init: WorldInit): WorldState {
  const { width, height } = init;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 2 || height < 2) {
    throw new Error(`Invalid world size ${width}x${height}`);
  }
  if (!(init.cellSizeM > 0)) throw new Error(`Invalid cell size ${init.cellSizeM}`);
  const n = width * height;
  return {
    version: WORLD_FORMAT_VERSION,
    width,
    height,
    cellSizeM: init.cellSizeM,
    seaLevelM: init.seaLevelM ?? 0,
    seed: init.seed >>> 0,
    simTimeSeconds: 0,
    bedrockElevationM: new Float32Array(n),
    looseSedimentThicknessM: new Float32Array(n),
    materialId: new Uint8Array(n),
    waterDepthM: new Float32Array(n),
    waterFluxM3PerS: new Float32Array(n * 4),
    water: defaultWaterParams(),
    sedimentSuspendedM: new Float32Array(n),
    erosion: defaultErosionParams(),
    meta: {
      name: 'Untitled world',
      presetId: 'flat',
      reliefM: 0,
      createdAtIso: new Date().toISOString(),
      ...init.meta,
    },
  };
}

export const cellIndex = (w: WorldState, x: number, y: number) => y * w.width + x;

export function surfaceAt(w: WorldState, i: number): number {
  return w.bedrockElevationM[i] + w.looseSedimentThicknessM[i];
}

/** Recompute derived surface elevation into `out` for a rect (or whole world). */
export function computeSurface(w: WorldState, out: Float32Array, rect?: CellRect): void {
  const r = rect ?? { x0: 0, y0: 0, x1: w.width, y1: w.height };
  const b = w.bedrockElevationM;
  const s = w.looseSedimentThicknessM;
  for (let y = r.y0; y < r.y1; y++) {
    let i = y * w.width + r.x0;
    for (let x = r.x0; x < r.x1; x++, i++) out[i] = b[i] + s[i];
  }
}

export function worldExtentM(w: WorldState): { x: number; y: number } {
  return { x: (w.width - 1) * w.cellSizeM, y: (w.height - 1) * w.cellSizeM };
}

/** Structural and numerical sanity check. Returns list of problems (empty = valid). */
export function validateWorld(w: WorldState): string[] {
  const errs: string[] = [];
  const n = w.width * w.height;
  if (w.bedrockElevationM.length !== n) errs.push('bedrock length mismatch');
  if (w.looseSedimentThicknessM.length !== n) errs.push('sediment length mismatch');
  if (w.materialId.length !== n) errs.push('material length mismatch');
  if (w.waterDepthM.length !== n) errs.push('water length mismatch');
  if (w.waterFluxM3PerS.length !== n * 4) errs.push('flux length mismatch');
  if (w.sedimentSuspendedM.length !== n) errs.push('suspended length mismatch');
  for (let i = 0; i < n; i++) {
    const v = w.sedimentSuspendedM[i];
    if (!(v >= 0) || !Number.isFinite(v)) {
      errs.push(`invalid suspended sediment ${v} at ${i}`);
      break;
    }
  }
  for (let i = 0; i < n; i++) {
    const d = w.waterDepthM[i];
    if (!(d >= 0) || !Number.isFinite(d)) {
      errs.push(`invalid water depth ${d} at ${i}`);
      break;
    }
  }
  for (let i = 0; i < n; i++) {
    if (!Number.isFinite(w.bedrockElevationM[i])) {
      errs.push(`non-finite bedrock at ${i}`);
      break;
    }
  }
  for (let i = 0; i < n; i++) {
    const s = w.looseSedimentThicknessM[i];
    if (!(s >= 0) || !Number.isFinite(s)) {
      errs.push(`invalid sediment ${s} at ${i}`);
      break;
    }
  }
  return errs;
}

export function cloneWorld(w: WorldState): WorldState {
  return {
    ...w,
    bedrockElevationM: w.bedrockElevationM.slice(),
    looseSedimentThicknessM: w.looseSedimentThicknessM.slice(),
    materialId: w.materialId.slice(),
    waterDepthM: w.waterDepthM.slice(),
    waterFluxM3PerS: w.waterFluxM3PerS.slice(),
    water: { ...w.water, sources: w.water.sources.map((s) => ({ ...s })) },
    sedimentSuspendedM: w.sedimentSuspendedM.slice(),
    erosion: { ...w.erosion },
    meta: { ...w.meta },
  };
}
