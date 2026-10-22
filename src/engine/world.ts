import type { CellRect } from '../utils/rect';
import { defaultCoastParams, type CoastParams } from '../sim/coast/params';
import { defaultClimateParams, type ClimateParams } from '../sim/climate/climate';
import { defaultGlacierParams, type GlacierParams } from '../sim/glacier/glacierSim';
import { defaultVegetationParams, type VegetationParams } from '../sim/vegetation/vegetationSim';
import { defaultTectonicsParams, type TectonicsParams } from '../sim/tectonics/plates';

export const WORLD_FORMAT_VERSION = 9;

/** Bedrock layers per cell: STRATA_LAYERS lithologies separated by STRATA_LAYERS − 1 boundaries. */
export const STRATA_LAYERS = 4;
export const STRATA_BOUNDS = STRATA_LAYERS - 1;
/** Boundary value meaning "no boundary" (layer continues downward indefinitely). */
export const STRATA_NONE = -1e9;

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
 * `weatherK` is the bare-rock regolith production rate (m/s at ×1, × lithology erodibility,
 * × (1 + wetness)), decaying as exp(−soil/soilScaleM) under existing soil.
 * `slopeFailure` enables loose-sediment avalanching above the angle of repose and bedrock
 * rockfall above each lithology's critical cliff angle (both lowered by saturation).
 */
export interface ErosionParams {
  enabled: boolean;
  creepK: number;
  weatherK: number;
  soilScaleM: number;
  slopeFailure: boolean;
  capacityK: number;
  erodeK: number;
  depositK: number;
  bedrockFactor: number;
  speedup: number;
}

export function defaultErosionParams(): ErosionParams {
  return { enabled: false, creepK: 0, weatherK: 2e-8, soilScaleM: 0.5, slopeFailure: true, capacityK: 0.05, erodeK: 0.01, depositK: 0.02, bedrockFactor: 0.1, speedup: 10 };
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
  /**
   * Exposed bedrock lithology id (terrain/materials.ts). DERIVED from the strata column at the
   * current bedrock elevation — refresh with refreshExposed() after bedrock or strata changes.
   */
  materialId: Uint8Array;
  /**
   * Stratigraphic column per cell, by absolute elevation (m): STRATA_BOUNDS descending
   * boundaries; layer 0 lies above boundary 0, layer k between boundaries k−1 and k, the last
   * layer below the last boundary. Unused boundaries = STRATA_NONE. Erosion lowering bedrock
   * through a boundary exposes the next layer; thickness can never go negative.
   */
  strataBoundsM: Float32Array;
  /** Lithology of each layer, STRATA_LAYERS per cell (top first). */
  strataMaterial: Uint8Array;
  /** Surface water depth above the ground surface (m), ≥ 0. Zero on sea cells (sea is a fixed-head sink). */
  waterDepthM: Float32Array;
  /** Pipe-model outflow per cell, 4 per cell [west, east, south, north] (m³/s), ≥ 0. */
  waterFluxM3PerS: Float32Array;
  water: WaterParams;
  /** Snowpack as snow water equivalent (m of water), ≥ 0. Counts as stored water. */
  snowSweM: Float32Array;
  /** Glacier ice thickness on top of the ground surface (m of ice), ≥ 0. */
  iceThicknessM: Float32Array;
  /** Rock debris carried in the ice (m of rock over the cell), ≥ 0. */
  iceDebrisM: Float32Array;
  /** Tectonic plate index per cell (into tectonics.plates). */
  plateId: Uint8Array;
  /** Plant cover fraction 0 … 1 (vegetation). */
  vegCover: Float32Array;
  /** Suspended sediment carried by surface water, as bulk deposit thickness (m), ≥ 0. */
  sedimentSuspendedM: Float32Array;
  erosion: ErosionParams;
  /** Wave climate and coastal process parameters (spec E6). */
  coast: CoastParams;
  /** Climate: temperature, season, wind, orographic rain (spec E7). */
  climate: ClimateParams;
  /** Glacier mass balance, flow and erosion parameters (spec E8). */
  glacier: GlacierParams;
  /** Plant growth and its effect on erosion. */
  vegetation: VegetationParams;
  /** Kinematic plates and boundary deformation (spec E9). */
  tectonics: TectonicsParams;
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
    strataBoundsM: new Float32Array(n * STRATA_BOUNDS).fill(STRATA_NONE),
    strataMaterial: new Uint8Array(n * STRATA_LAYERS),
    waterDepthM: new Float32Array(n),
    waterFluxM3PerS: new Float32Array(n * 4),
    water: defaultWaterParams(),
    sedimentSuspendedM: new Float32Array(n),
    snowSweM: new Float32Array(n),
    iceThicknessM: new Float32Array(n),
    iceDebrisM: new Float32Array(n),
    vegCover: new Float32Array(n),
    plateId: new Uint8Array(n),
    erosion: defaultErosionParams(),
    coast: defaultCoastParams(),
    climate: defaultClimateParams(),
    glacier: defaultGlacierParams(),
    vegetation: defaultVegetationParams(),
    tectonics: defaultTectonicsParams(),
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
  if (w.strataBoundsM.length !== n * STRATA_BOUNDS) errs.push('strata bounds length mismatch');
  if (w.strataMaterial.length !== n * STRATA_LAYERS) errs.push('strata material length mismatch');
  for (let i = 0; i < n; i++) {
    const o = i * STRATA_BOUNDS;
    for (let k = 1; k < STRATA_BOUNDS; k++)
      if (w.strataBoundsM[o + k] > w.strataBoundsM[o + k - 1]) {
        errs.push(`strata boundaries not descending at ${i}`);
        i = n;
        break;
      }
  }
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
    strataBoundsM: w.strataBoundsM.slice(),
    strataMaterial: w.strataMaterial.slice(),
    waterDepthM: w.waterDepthM.slice(),
    waterFluxM3PerS: w.waterFluxM3PerS.slice(),
    water: { ...w.water, sources: w.water.sources.map((s) => ({ ...s })) },
    sedimentSuspendedM: w.sedimentSuspendedM.slice(),
    snowSweM: w.snowSweM.slice(),
    iceThicknessM: w.iceThicknessM.slice(),
    iceDebrisM: w.iceDebrisM.slice(),
    vegCover: w.vegCover.slice(),
    plateId: w.plateId.slice(),
    erosion: { ...w.erosion },
    coast: { ...w.coast },
    climate: { ...w.climate },
    glacier: { ...w.glacier },
    vegetation: { ...w.vegetation },
    tectonics: { ...w.tectonics, plates: w.tectonics.plates.map((q) => ({ ...q })) },
    meta: { ...w.meta },
  };
}

/** Index of the strata layer containing bedrock elevation e at cell i. */
export function layerAt(w: WorldState, i: number, e: number): number {
  const o = i * STRATA_BOUNDS;
  let k = 0;
  while (k < STRATA_BOUNDS && e < w.strataBoundsM[o + k]) k++;
  return k;
}

/** Recompute the exposed lithology of one cell from its strata column. */
export function refreshExposed(w: WorldState, i: number): void {
  w.materialId[i] = w.strataMaterial[i * STRATA_LAYERS + layerAt(w, i, w.bedrockElevationM[i])];
}

export function refreshAllExposed(w: WorldState): void {
  for (let i = 0; i < w.materialId.length; i++) refreshExposed(w, i);
}

/** Make every cell a single-layer column of its current exposed lithology. */
export function setUniformStrata(w: WorldState): void {
  w.strataBoundsM.fill(STRATA_NONE);
  for (let i = 0; i < w.materialId.length; i++) w.strataMaterial.fill(w.materialId[i], i * STRATA_LAYERS, (i + 1) * STRATA_LAYERS);
}
