import { MM_PER_H, type WorldState } from '../engine/world';
import { materialById } from './materials';
import { sampleBilinear } from './heightfield';

/**
 * Field measurements (spec F4 "Position inspector reads actual values … line-transect elevation
 * profile, slope, distance … layer inspection. Do not invent datapoint values"). Every value here is
 * read from the authoritative world arrays (nearest cell, or bilinear along a transect); nothing is
 * estimated or smoothed.
 */
export interface MeasureSource {
  world: WorldState;
  surface: Float32Array;
  water: { vx: Float32Array; vy: Float32Array; sea: Uint8Array };
  climate: { temperatureC: Float32Array; rainFactor: Float32Array };
}

export interface CellReading {
  cellX: number;
  cellY: number;
  elevationM: number;
  bedrockM: number;
  soilM: number;
  /** Steepest slope (degrees) by central differences. */
  slopeDeg: number;
  /** Direction the ground faces (downslope bearing, ° clockwise from north), null when flat. */
  aspectDeg: number | null;
  rock: string;
  sea: boolean;
  waterDepthM: number;
  waterSpeedMS: number;
  /** Total pipe outflow from the cell (m³/s). */
  outflowM3S: number;
  temperatureC: number | null;
  rainMmH: number;
  plantsPct: number;
  ashM: number;
  lavaM: number;
  lavaC: number | null;
  iceM: number;
  snowMm: number;
}

/** Nearest cell to world (xM, yM), clamped to the map. */
export function cellAt(w: WorldState, xM: number, yM: number): { x: number; y: number; i: number } {
  const x = Math.min(w.width - 1, Math.max(0, Math.round(xM / w.cellSizeM)));
  const y = Math.min(w.height - 1, Math.max(0, Math.round(yM / w.cellSizeM)));
  return { x, y, i: y * w.width + x };
}

export function readCell(s: MeasureSource, xM: number, yM: number): CellReading {
  const w = s.world;
  const { x, y, i } = cellAt(w, xM, yM);
  const W = w.width;
  const xl = x > 0 ? x - 1 : x;
  const xr = x < W - 1 ? x + 1 : x;
  const yd = y > 0 ? y - 1 : y;
  const yu = y < w.height - 1 ? y + 1 : y;
  const z = s.surface;
  const dzdx = (z[y * W + xr] - z[y * W + xl]) / ((xr - xl) * w.cellSizeM);
  const dzdy = (z[yu * W + x] - z[yd * W + x]) / ((yu - yd) * w.cellSizeM);
  const g = Math.hypot(dzdx, dzdy);
  // Downslope direction is −∇z; bearing from north (y) clockwise towards east (x).
  const aspect = g < 1e-6 ? null : ((Math.atan2(-dzdx, -dzdy) * 180) / Math.PI + 360) % 360;
  const F = w.waterFluxM3PerS;
  const clim = w.climate.enabled;
  return {
    cellX: x,
    cellY: y,
    elevationM: z[i],
    bedrockM: w.bedrockElevationM[i],
    soilM: w.looseSedimentThicknessM[i],
    slopeDeg: (Math.atan(g) * 180) / Math.PI,
    aspectDeg: aspect,
    rock: materialById(w.materialId[i]).name,
    sea: s.water.sea[i] === 1,
    waterDepthM: w.waterDepthM[i],
    waterSpeedMS: Math.hypot(s.water.vx[i], s.water.vy[i]),
    outflowM3S: F[i * 4] + F[i * 4 + 1] + F[i * 4 + 2] + F[i * 4 + 3],
    temperatureC: clim ? s.climate.temperatureC[i] : null,
    rainMmH: (w.water.rainMPerS / MM_PER_H) * (clim ? s.climate.rainFactor[i] : 1),
    plantsPct: 100 * w.vegCover[i],
    ashM: Math.min(w.tephraM[i], w.looseSedimentThicknessM[i]),
    lavaM: w.lavaDepthM[i],
    lavaC: w.lavaDepthM[i] > 0 ? w.lavaTempC[i] : null,
    iceM: w.iceThicknessM[i],
    snowMm: 1000 * w.snowSweM[i],
  };
}

export interface PinPair {
  /** Horizontal distance (m). */
  distanceM: number;
  /** Bearing from the first point to the second (° clockwise from north). */
  bearingDeg: number;
  /** Second minus first ground elevation (m). */
  riseM: number;
  /** Mean gradient rise / distance (dimensionless) and in degrees. */
  gradient: number;
  gradientDeg: number;
}

export function pinPair(s: MeasureSource, ax: number, ay: number, bx: number, by: number): PinPair {
  const d = Math.hypot(bx - ax, by - ay);
  const hf = { width: s.world.width, height: s.world.height, cellSizeM: s.world.cellSizeM, z: s.surface };
  const rise = sampleBilinear(hf, bx, by) - sampleBilinear(hf, ax, ay);
  const grad = d > 0 ? rise / d : 0;
  return {
    distanceM: d,
    bearingDeg: ((Math.atan2(bx - ax, by - ay) * 180) / Math.PI + 360) % 360,
    riseM: rise,
    gradient: grad,
    gradientDeg: (Math.atan(grad) * 180) / Math.PI,
  };
}

/** One transect sample: elevations of each layer's top (m) at distance d along the line. */
export interface TransectSample {
  distM: number;
  xM: number;
  yM: number;
  bedrockM: number;
  surfaceM: number;
  referenceM: number;
  /** Top of ice / lava on the ground (equal to surface where none). */
  iceTopM: number;
  lavaTopM: number;
  /** Water surface (m) or null where dry; sea cells report sea level. */
  waterM: number | null;
  plate: number;
}

/** n bilinear samples from A to B (world metres). */
export function transect(s: MeasureSource, reference: Float32Array, ax: number, ay: number, bx: number, by: number, n = 160): TransectSample[] {
  const w = s.world;
  const base = { width: w.width, height: w.height, cellSizeM: w.cellSizeM };
  const at = (z: Float32Array, x: number, y: number) => sampleBilinear({ ...base, z }, x, y);
  const len = Math.hypot(bx - ax, by - ay);
  const out: TransectSample[] = [];
  for (let k = 0; k < n; k++) {
    const t = n > 1 ? k / (n - 1) : 0;
    const x = ax + (bx - ax) * t;
    const y = ay + (by - ay) * t;
    const surf = at(s.surface, x, y);
    const d = at(w.waterDepthM, x, y);
    const ice = at(w.iceThicknessM, x, y);
    const lava = at(w.lavaDepthM, x, y);
    const c = cellAt(w, x, y);
    out.push({
      distM: len * t,
      xM: x,
      yM: y,
      bedrockM: at(w.bedrockElevationM, x, y),
      surfaceM: surf,
      referenceM: at(reference, x, y),
      iceTopM: surf + ice,
      lavaTopM: surf + lava,
      waterM: surf < w.seaLevelM ? w.seaLevelM : d > 0.01 ? surf + d : null,
      plate: w.plateId[c.i],
    });
  }
  return out;
}

const CSV_COLUMNS: [keyof TransectSample, string][] = [
  ['distM', 'distance_m'],
  ['xM', 'x_east_m'],
  ['yM', 'y_north_m'],
  ['bedrockM', 'bedrock_top_m'],
  ['surfaceM', 'ground_surface_m'],
  ['referenceM', 'reference_surface_m'],
  ['iceTopM', 'ice_top_m'],
  ['lavaTopM', 'lava_top_m'],
  ['waterM', 'water_surface_m'],
];

/** CSV of a transect: header row of named columns with units, one row per sample, '' for no water. */
export function transectCsv(samples: TransectSample[]): string {
  const lines = [CSV_COLUMNS.map((c) => c[1]).join(',')];
  for (const s of samples) lines.push(CSV_COLUMNS.map(([k]) => (s[k] === null ? '' : (s[k] as number).toFixed(3))).join(','));
  return lines.join('\n') + '\n';
}

/** Parse a transect CSV back into rows of numbers (null for empty cells), keyed by column name. */
export function parseCsv(text: string): Record<string, number | null>[] {
  const [head, ...rows] = text.trim().split('\n');
  const cols = head.split(',');
  return rows.map((r) => {
    const v = r.split(',');
    return Object.fromEntries(cols.map((c, k) => [c, v[k] === '' ? null : Number(v[k])]));
  });
}

/** Compass point for a bearing. */
export function compass(deg: number): string {
  return ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(deg / 45) % 8];
}
