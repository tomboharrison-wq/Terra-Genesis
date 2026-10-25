import { Color } from 'three';
import type { WorldState } from '../engine/world';
import { MATERIALS } from '../terrain/materials';
import { DRY_M, FLOOD_THRESHOLD_M, WET_M } from '../sim/events/hazards';

/**
 * Scientific map overlays (spec F4): each one colours the terrain by a field the simulation really
 * holds, with a legend in real units, and is offered only when that field has data.
 *
 * Generic overlays (this module computes value + colour): elevation (hypsometric tint on land, depth
 * tint at sea), slope, aspect, flow accumulation (D8 upstream area), geology, ice, plant cover, ash.
 * Older overlays (change, temperature, rainfall, waves, plates, shaking, compare) keep their colouring
 * in TerrainScene but share the menu, legend and inspector here.
 *
 * Colour ramps follow the dataviz rules: sequential = one hue light → dark; diverging = two hues about
 * a neutral grey; categorical in fixed order; aspect uses a cyclic 8-sector palette.
 */
export type OverlayId =
  | 'none'
  | 'elevation'
  | 'slope'
  | 'aspect'
  | 'flow'
  | 'geology'
  | 'ice'
  | 'plants'
  | 'ash'
  | 'change'
  | 'temperature'
  | 'rainfall'
  | 'waves'
  | 'plates'
  | 'shaking'
  | 'compare'
  | 'flood'
  | 'drought'
  | 'cp-ground'
  | 'cp-water'
  | 'cp-plants'
  | 'cp-ice';

/** What an overlay needs to read (the Engine satisfies it). */
export interface OverlaySource {
  world: WorldState;
  surface: Float32Array;
  referenceSurface: Float32Array;
  climate: { temperatureC: Float32Array; rainFactor: Float32Array };
  coast: { exposure: Float32Array };
  lastQuake: { shaking: Float32Array } | null;
  /** Depth record of the current / last event: deepest water (storm, surge) or shallowest (drought), and the water when it began. */
  flood: { peak: Float32Array; start: Float32Array; label: string; kind: string } | null;
  compareResult: { coverDiff: Float32Array } | null;
  /** Checkpoint chosen for the 'since checkpoint' difference overlays. */
  compareCheckpoint: {
    label: string;
    surface: Float32Array;
    world: WorldState;
  } | null;
}

export type Legend =
  | {
      kind: 'ramp';
      css: string;
      labels: [string, string, string];
      unit?: string;
    }
  | { kind: 'swatches'; items: { colour: string; label: string }[] };

export interface OverlayDef {
  id: OverlayId;
  label: string;
  group: 'Terrain' | 'Water' | 'Climate' | 'Ice & life' | 'Volcanic' | 'Earth' | 'Coast' | 'What if?' | 'Since checkpoint';
  /** True when the backing field has data. */
  available(s: OverlaySource): boolean;
  /** Inspector text for cell i (real value and unit), or null where the field has no value. */
  describe(s: OverlaySource, i: number, d: OverlayData): string | null;
  legend(s: OverlaySource, d: OverlayData): Legend;
  /** Generic overlays colour cell i into out[o..o+2] (linear RGB); older overlays leave this out. */
  colour?(s: OverlaySource, i: number, d: OverlayData, out: Float32Array, o: number): void;
}

/** Per-overlay derived data (recomputed by the renderer when the overlay or terrain changes). */
export interface OverlayData {
  flow?: Float32Array;
  zMin: number;
  zMax: number;
}

// ---------- derived fields ----------

const NB8: [number, number, number][] = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, Math.SQRT2],
  [1, -1, Math.SQRT2],
  [-1, 1, Math.SQRT2],
  [-1, -1, Math.SQRT2],
];

/**
 * D8 receivers: each cell's steepest downhill neighbour (drop / distance, diagonals at √2 cs), or −1
 * in a hollow (no lower neighbour) or on a sea cell (flow ends there).
 */
export function d8Receivers(z: Float32Array, W: number, H: number, cs: number, isSea?: (i: number) => boolean): Int32Array {
  const rec = new Int32Array(W * H).fill(-1);
  for (let i = 0; i < W * H; i++) {
    if (isSea?.(i)) continue;
    const x = i % W;
    const y = (i / W) | 0;
    let bestS = 0;
    for (const [dx, dy, d] of NB8) {
      const xn = x + dx;
      const yn = y + dy;
      if (xn < 0 || yn < 0 || xn >= W || yn >= H) continue;
      const j = yn * W + xn;
      const s = (z[i] - z[j]) / (d * cs);
      if (s > bestS) {
        bestS = s;
        rec[i] = j;
      }
    }
  }
  return rec;
}

/**
 * D8 flow accumulation: every cell passes its own area plus everything it receives to its steepest
 * downhill neighbour (see d8Receivers). Returns upstream area per cell (m², including the cell
 * itself). Flow stops in hollows (no lower neighbour) and at sea cells.
 */
export function flowAccumulation(z: Float32Array, W: number, H: number, cs: number, isSea?: (i: number) => boolean, receivers?: Int32Array): Float32Array {
  const n = W * H;
  const rec = receivers ?? d8Receivers(z, W, H, cs, isSea);
  const acc = new Float64Array(n).fill(cs * cs);
  const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => z[b] - z[a]);
  for (const i of order) if (rec[i] >= 0) acc[rec[i]] += acc[i];
  return Float32Array.from(acc);
}

/** Ground gentler than this has no meaningful facing direction (shown as flat). */
export const FLAT_SLOPE = Math.tan((0.5 * Math.PI) / 180);

/** Downslope bearing (° clockwise from north) at cell i, or null on (nearly) flat ground (< 0.5°). */
export function aspectAt(z: Float32Array, W: number, H: number, cs: number, i: number): number | null {
  const x = i % W;
  const y = (i / W) | 0;
  const xl = x > 0 ? x - 1 : x;
  const xr = x < W - 1 ? x + 1 : x;
  const yd = y > 0 ? y - 1 : y;
  const yu = y < H - 1 ? y + 1 : y;
  const dzdx = (z[y * W + xr] - z[y * W + xl]) / ((xr - xl) * cs);
  const dzdy = (z[yu * W + x] - z[yd * W + x]) / ((yu - yd) * cs);
  if (Math.hypot(dzdx, dzdy) < FLAT_SLOPE) return null;
  return ((Math.atan2(-dzdx, -dzdy) * 180) / Math.PI + 360) % 360;
}

export function slopeDegAt(z: Float32Array, W: number, H: number, cs: number, i: number): number {
  const x = i % W;
  const y = (i / W) | 0;
  const xl = x > 0 ? x - 1 : x;
  const xr = x < W - 1 ? x + 1 : x;
  const yd = y > 0 ? y - 1 : y;
  const yu = y < H - 1 ? y + 1 : y;
  const dzdx = (z[y * W + xr] - z[y * W + xl]) / ((xr - xl) * cs);
  const dzdy = (z[yu * W + x] - z[yd * W + x]) / ((yu - yd) * cs);
  return (Math.atan(Math.hypot(dzdx, dzdy)) * 180) / Math.PI;
}

/** 8 compass sectors: 0 = N (337.5–22.5°), 1 = NE, … 7 = NW. */
export function aspectSector(deg: number): number {
  return Math.round((((deg % 360) + 360) % 360) / 45) % 8;
}
export const SECTORS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

export function prepareOverlay(id: OverlayId, s: OverlaySource): OverlayData {
  const w = s.world;
  let zMin = Infinity;
  let zMax = -Infinity;
  for (const v of s.surface) {
    if (v < zMin) zMin = v;
    if (v > zMax) zMax = v;
  }
  const d: OverlayData = { zMin, zMax };
  if (id === 'flow') d.flow = flowAccumulation(s.surface, w.width, w.height, w.cellSizeM, (i) => s.surface[i] < w.seaLevelM);
  return d;
}

// ---------- colour ramps ----------

type RGB = [number, number, number];
const lin = (hex: string): RGB => {
  const c = new Color(hex);
  return [c.r, c.g, c.b];
};
/** Piecewise-linear ramp through hex stops (t in 0 … 1), linear RGB. */
function ramp(stops: string[]) {
  const cs = stops.map(lin);
  return (t: number, out: Float32Array, o: number) => {
    const u = Math.min(1, Math.max(0, t)) * (cs.length - 1);
    const k = Math.min(cs.length - 2, Math.floor(u));
    const f = u - k;
    for (let c = 0; c < 3; c++) out[o + c] = cs[k][c] + (cs[k + 1][c] - cs[k][c]) * f;
  };
}
const css = (stops: string[]) => `linear-gradient(90deg, ${stops.join(', ')})`;

// Hypsometric tint (land) and depth tint (sea): the conventional atlas colouring.
const LAND = ['#5d8f4f', '#a7b46a', '#c9a96e', '#8f6a4b', '#efece6'];
const SEA = ['#a9d3ef', '#3b7fc4', '#0d2f63'];
const SLOPE = ['#fff1db', '#ffbf75', '#ff912a', '#b9520b', '#5c2400'];
const FLOW = ['#e8f1fb', '#8fbbe9', '#3a86f0', '#0b4aa8', '#06225a'];
const ICE = ['#eef7fc', '#9fd0ea', '#3f8fc7', '#14507f'];
const PLANTS = ['#f2efd8', '#b9d18a', '#25b755', '#1c6b3c', '#0f3a22'];
const ASH = ['#ecebea', '#b4b1ae', '#76726e', '#3d3a38'];
// Flood: single-hue sequential through Scouts blue (light = shallow, dark = deep).
const FLOOD = ['#d6e8fb', '#7fb3ef', '#006ddf', '#003a7a'];
// Drought: single-hue sequential through Scouts orange (light = little lost, dark = dried up).
const DROUGHT = ['#ffe9d1', '#ffbe80', '#ff912a', '#9c4a00'];
// Aspect: 8 sectors N, NE … NW in a validated categorical order (dataviz validator: lightness band,
// chroma, adjacent CVD ΔE ≥ 9, normal-vision ΔE ≥ 19.6; contrast relief = labelled legend + inspector).
const ASPECT = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'];
const ASPECT_LIN = ASPECT.map(lin);
const FLAT = lin('#b9b6b0');
const NODATA = lin('#8b8f8f');

const landRamp = ramp(LAND);
const seaRamp = ramp(SEA);
const slopeRamp = ramp(SLOPE);
const flowRamp = ramp(FLOW);
const iceRamp = ramp(ICE);
const plantRamp = ramp(PLANTS);
const ashRamp = ramp(ASH);
const floodRamp = ramp(FLOOD);
const droughtRamp = ramp(DROUGHT);
const ROCK_LIN = MATERIALS.map((m) => lin(`#${m.colour.toString(16).padStart(6, '0')}`));

const fmtM = (m: number) => (Math.abs(m) >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${m.toFixed(m < 10 ? 1 : 0)} m`);
const fmtArea = (m2: number) => (m2 >= 1e6 ? `${(m2 / 1e6).toFixed(m2 >= 1e7 ? 0 : 2)} km²` : `${Math.round(m2).toLocaleString()} m²`);
const any = (a: ArrayLike<number>, gt: number) => {
  for (let i = 0; i < a.length; i++) if (a[i] > gt) return true;
  return false;
};
/** log₁₀ position of v between lo and hi (0 … 1). */
const logT = (v: number, lo: number, hi: number) => (v <= lo ? 0 : Math.log10(v / lo) / Math.log10(hi / lo));

// Flow accumulation is shown in cells upstream on a log scale 1 … 10⁴ cells.
const FLOW_MAX_CELLS = 1e4;
// Ash depth log scale 1 cm … 1 m; ice 0 … 100 m.
const ASH_LO = 0.01;
const ASH_HI = 1;
const ICE_HI = 100;

export const OVERLAYS: OverlayDef[] = [
  {
    id: 'elevation',
    label: 'Elevation',
    group: 'Terrain',
    available: () => true,
    describe: (s, i) =>
      `${fmtM(s.surface[i])} (${s.surface[i] >= s.world.seaLevelM ? `${fmtM(s.surface[i] - s.world.seaLevelM)} above sea` : `${fmtM(s.world.seaLevelM - s.surface[i])} below sea`})`,
    legend: (s, d) => ({
      kind: 'ramp',
      css: css(LAND),
      labels: ['sea level', fmtM((Math.max(d.zMax, s.world.seaLevelM) + s.world.seaLevelM) / 2), fmtM(Math.max(d.zMax, s.world.seaLevelM))],
    }),
    colour: (s, i, d, out, o) => {
      const sl = s.world.seaLevelM;
      const z = s.surface[i];
      if (z < sl) seaRamp((sl - z) / Math.max(1, sl - d.zMin), out, o);
      else landRamp((z - sl) / Math.max(1, d.zMax - sl), out, o);
    },
  },
  {
    id: 'slope',
    label: 'Slope',
    group: 'Terrain',
    available: () => true,
    describe: (s, i) => `${slopeDegAt(s.surface, s.world.width, s.world.height, s.world.cellSizeM, i).toFixed(1)}° slope`,
    legend: () => ({
      kind: 'ramp',
      css: css(SLOPE),
      labels: ['0°', '30°', '≥ 60°'],
    }),
    colour: (s, i, _d, out, o) => slopeRamp(slopeDegAt(s.surface, s.world.width, s.world.height, s.world.cellSizeM, i) / 60, out, o),
  },
  {
    id: 'aspect',
    label: 'Aspect (way it faces)',
    group: 'Terrain',
    available: () => true,
    describe: (s, i) => {
      const a = aspectAt(s.surface, s.world.width, s.world.height, s.world.cellSizeM, i);
      return a === null ? 'flat (under 0.5°)' : `faces ${SECTORS[aspectSector(a)]} (${Math.round(a)}°)`;
    },
    legend: () => ({
      kind: 'swatches',
      items: [...SECTORS.map((l, k) => ({ colour: ASPECT[k], label: l })), { colour: '#b9b6b0', label: 'flat (< 0.5°)' }],
    }),
    colour: (s, i, _d, out, o) => {
      const a = aspectAt(s.surface, s.world.width, s.world.height, s.world.cellSizeM, i);
      const c = a === null ? FLAT : ASPECT_LIN[aspectSector(a)];
      out[o] = c[0];
      out[o + 1] = c[1];
      out[o + 2] = c[2];
    },
  },
  {
    id: 'geology',
    label: 'Geology (rock at the surface)',
    group: 'Terrain',
    available: () => true,
    describe: (s, i) => MATERIALS[s.world.materialId[i]]?.name ?? '—',
    legend: (s) => {
      const present = new Set(s.world.materialId);
      return {
        kind: 'swatches',
        items: MATERIALS.filter((m) => present.has(m.id)).map((m) => ({
          colour: `#${m.colour.toString(16).padStart(6, '0')}`,
          label: m.name,
        })),
      };
    },
    colour: (s, i, _d, out, o) => {
      const c = ROCK_LIN[s.world.materialId[i]] ?? NODATA;
      out[o] = c[0];
      out[o + 1] = c[1];
      out[o + 2] = c[2];
    },
  },
  {
    id: 'flow',
    label: 'Flow accumulation (upstream area)',
    group: 'Water',
    available: () => true,
    describe: (_s, i, d) => (d.flow ? `${fmtArea(d.flow[i])} drains through here` : null),
    legend: (s) => {
      const a = s.world.cellSizeM ** 2;
      return {
        kind: 'ramp',
        css: css(FLOW),
        labels: [`1 cell (${fmtArea(a)})`, fmtArea(100 * a), `≥ ${fmtArea(FLOW_MAX_CELLS * a)}`],
      };
    },
    colour: (s, i, d, out, o) => flowRamp(d.flow ? logT(d.flow[i] / s.world.cellSizeM ** 2, 1, FLOW_MAX_CELLS) : 0, out, o),
  },
  {
    id: 'change',
    label: 'Erosion / deposition (change since reference)',
    group: 'Water',
    available: () => true,
    describe: (s, i) => {
      const dz = s.surface[i] - s.referenceSurface[i];
      return Math.abs(dz) < 0.05 ? 'no change (within 5 cm)' : `${dz > 0 ? 'built up' : 'worn down'} ${fmtM(Math.abs(dz))}`;
    },
    legend: () => ({
      kind: 'ramp',
      css: 'linear-gradient(90deg, #ed3f23, #f4a08f, #9aa0a0, #8fb8ef, #006ddf)',
      labels: ['−10 m', '±5 cm', '+10 m'],
    }),
  },
  {
    id: 'temperature',
    label: 'Temperature',
    group: 'Climate',
    available: (s) => s.world.climate.enabled,
    describe: (s, i) => `${s.climate.temperatureC[i].toFixed(1)} °C`,
    legend: () => ({
      kind: 'ramp',
      css: 'linear-gradient(90deg, #2a5fa8, #dedbd2, #c8402a)',
      labels: ['−20 °C', '0', '+30 °C'],
    }),
  },
  {
    id: 'rainfall',
    label: 'Rainfall pattern',
    group: 'Climate',
    available: (s) => s.world.climate.enabled,
    describe: (s, i) => `${s.climate.rainFactor[i].toFixed(2)} × map mean`,
    legend: () => ({
      kind: 'ramp',
      css: 'linear-gradient(90deg, #b4c6d3, #0a3a6b)',
      labels: ['none', '1.5× mean', '3× mean'],
    }),
  },
  {
    id: 'ice',
    label: 'Ice thickness',
    group: 'Ice & life',
    available: (s) => any(s.world.iceThicknessM, 0.5),
    describe: (s, i) => (s.world.iceThicknessM[i] > 0.05 ? `${fmtM(s.world.iceThicknessM[i])} of ice` : 'no ice'),
    legend: () => ({
      kind: 'ramp',
      css: css(ICE),
      labels: ['none', `${ICE_HI / 2} m`, `≥ ${ICE_HI} m`],
    }),
    colour: (s, i, _d, out, o) => {
      const h = s.world.iceThicknessM[i];
      if (h <= 0.05) {
        const g = 0.25 + 0.2 * Math.min(1, Math.max(0, (s.surface[i] - s.world.seaLevelM) / 2000));
        out[o] = out[o + 1] = out[o + 2] = g; // no ice: neutral grey (no data shown as colour)
      } else iceRamp(0.15 + 0.85 * Math.min(1, h / ICE_HI), out, o);
    },
  },
  {
    id: 'plants',
    label: 'Plant cover',
    group: 'Ice & life',
    available: (s) => any(s.world.vegCover, 0.01),
    describe: (s, i) => `${Math.round(100 * s.world.vegCover[i])}% plant cover`,
    legend: () => ({
      kind: 'ramp',
      css: css(PLANTS),
      labels: ['bare', '50%', '100%'],
    }),
    colour: (s, i, _d, out, o) => plantRamp(s.world.vegCover[i], out, o),
  },
  {
    id: 'ash',
    label: 'Volcanic ash depth',
    group: 'Volcanic',
    available: (s) => any(s.world.tephraM, 0.001),
    describe: (s, i) => {
      const a = Math.min(s.world.tephraM[i], s.world.looseSedimentThicknessM[i]);
      return a > 0.001 ? `${a < 1 ? `${Math.round(a * 100)} cm` : fmtM(a)} of ash / cinder` : 'no ash';
    },
    legend: () => ({
      kind: 'ramp',
      css: css(ASH),
      labels: ['1 cm', '10 cm', '≥ 1 m'],
    }),
    colour: (s, i, _d, out, o) => {
      const a = Math.min(s.world.tephraM[i], s.world.looseSedimentThicknessM[i]);
      if (a < ASH_LO * 0.5) {
        out[o] = 0.8;
        out[o + 1] = 0.78;
        out[o + 2] = 0.72;
      } else ashRamp(0.1 + 0.9 * logT(a, ASH_LO, ASH_HI), out, o);
    },
  },
  {
    id: 'plates',
    label: 'Tectonic plates',
    group: 'Earth',
    available: (s) => s.world.tectonics.plates.length > 1,
    describe: (s, i) => s.world.tectonics.plates[s.world.plateId[i]]?.name ?? null,
    legend: () => ({
      kind: 'swatches',
      items: [
        { colour: '#ed3f23', label: 'colliding' },
        { colour: '#006ddf', label: 'pulling apart' },
        { colour: '#ffe627', label: 'sliding past' },
      ],
    }),
  },
  {
    id: 'shaking',
    label: 'Earthquake shaking',
    group: 'Earth',
    available: (s) => s.lastQuake !== null,
    describe: (s, i) => (s.lastQuake ? `intensity ${s.lastQuake.shaking[i].toFixed(1)}` : null),
    legend: () => ({
      kind: 'ramp',
      css: 'linear-gradient(90deg, #ffe627, #ff912a, #ed3f23)',
      labels: ['III felt', 'VI', 'X violent'],
    }),
  },
  {
    id: 'waves',
    label: 'Wave attack',
    group: 'Coast',
    available: (s) => s.world.coast.wavesOn,
    describe: (s, i) => (s.coast.exposure[i] > 0 ? `${(s.coast.exposure[i] / 1000).toFixed(1)} kW/m wave power` : 'not on the coast'),
    legend: () => ({
      kind: 'ramp',
      css: 'linear-gradient(90deg, #ffe627, #ff912a, #ed3f23)',
      labels: ['low', '15', '≥ 30 kW/m'],
    }),
  },
  {
    id: 'flood',
    label: 'Flood extent (deepest water)',
    group: 'Water',
    available: (s) => s.flood !== null && s.flood.kind !== 'drought',
    describe: (s, i) => {
      const f = s.flood;
      if (!f) return null;
      if (s.surface[i] < s.world.seaLevelM) return 'sea';
      const rise = f.peak[i] - f.start[i];
      if (f.peak[i] < 0.005) return 'stayed dry';
      return `deepest ${fmtM(f.peak[i])} (${fmtM(f.start[i])} before) — ${rise >= FLOOD_THRESHOLD_M ? 'flooded' : `rose under ${FLOOD_THRESHOLD_M * 100} cm, not counted`}`;
    },
    legend: () => ({ kind: 'ramp', css: css(FLOOD), labels: [`rose ≥ ${FLOOD_THRESHOLD_M} m`, '1.5 m deep', '≥ 3 m deep'] }),
    colour: (s, i, _d, out, o) => {
      const f = s.flood!;
      if (s.surface[i] < s.world.seaLevelM || f.peak[i] - f.start[i] < FLOOD_THRESHOLD_M) {
        const g = 0.25 + 0.2 * Math.min(1, Math.max(0, (s.surface[i] - s.world.seaLevelM) / 2000));
        out[o] = out[o + 1] = out[o + 2] = g; // not flooded: neutral grey
      } else floodRamp(Math.min(1, f.peak[i] / 3), out, o);
    },
  },
  {
    id: 'drought',
    label: 'Drought (water lost)',
    group: 'Water',
    available: (s) => s.flood?.kind === 'drought',
    describe: (s, i) => {
      const f = s.flood;
      if (!f) return null;
      if (s.surface[i] < s.world.seaLevelM) return 'sea';
      if (f.start[i] < WET_M) return 'no standing water when the drought began';
      const lost = 1 - f.peak[i] / f.start[i];
      return `${fmtM(f.start[i])} → lowest ${fmtM(f.peak[i])} (${Math.round(100 * lost)}% lost${f.peak[i] < DRY_M ? ', dried up' : ''})`;
    },
    legend: () => ({ kind: 'ramp', css: css(DROUGHT), labels: ['little lost', 'half lost', 'dried up'] }),
    colour: (s, i, _d, out, o) => {
      const f = s.flood!;
      if (s.surface[i] < s.world.seaLevelM || f.start[i] < WET_M) {
        const g = 0.25 + 0.2 * Math.min(1, Math.max(0, (s.surface[i] - s.world.seaLevelM) / 2000));
        out[o] = out[o + 1] = out[o + 2] = g; // no water to lose: neutral grey
      } else droughtRamp(f.peak[i] < DRY_M ? 1 : 1 - f.peak[i] / f.start[i], out, o);
    },
  },
  {
    id: 'compare',
    label: 'What-if plant difference',
    group: 'What if?',
    available: (s) => s.compareResult !== null,
    describe: (s, i) =>
      s.compareResult ? `${s.compareResult.coverDiff[i] >= 0 ? '+' : ''}${Math.round(100 * s.compareResult.coverDiff[i])}% plant cover` : null,
    legend: () => ({
      kind: 'ramp',
      css: 'linear-gradient(90deg, #a0522d, #9aa0a0, #25b755)',
      labels: ['fewer plants', 'same', 'more plants'],
    }),
  },
];

// ---------- differences since a checkpoint (diverging: two hues about a neutral grey) ----------

const NEUTRAL = lin('#9aa0a0');
/** Diverging colour for a signed change d with |d| below lo neutral, log scale lo … hi. */
function diverging(neg: string, pos: string, lo: number, hi: number) {
  const n = lin(neg);
  const p = lin(pos);
  return (d: number, out: Float32Array, o: number) => {
    const t = Math.abs(d) < lo ? 0 : 0.3 + 0.7 * logT(Math.abs(d), lo, hi);
    const c = d < 0 ? n : p;
    for (let k = 0; k < 3; k++) out[o + k] = NEUTRAL[k] + (c[k] - NEUTRAL[k]) * Math.min(1, t);
  };
}
const groundDiff = diverging('#ed3f23', '#006ddf', 0.05, 10);
const waterDiff = diverging('#a0522d', '#006ddf', 0.01, 10);
const plantDiff = diverging('#a0522d', '#25b755', 0.02, 1);
const iceDiff = diverging('#ff912a', '#2a5fa8', 0.5, 100);
const signed = (v: number, f: (x: number) => string) => `${v > 0 ? '+' : v < 0 ? '−' : '±'}${f(Math.abs(v))}`;
const since = (s: OverlaySource) => (s.compareCheckpoint ? ` since “${s.compareCheckpoint.label}”` : '');

OVERLAYS.push(
  {
    id: 'cp-ground',
    label: 'Ground change since checkpoint',
    group: 'Since checkpoint',
    available: (s) => s.compareCheckpoint !== null,
    describe: (s, i) => {
      if (!s.compareCheckpoint) return null;
      const dz = s.surface[i] - s.compareCheckpoint.surface[i];
      return Math.abs(dz) < 0.05 ? `no change (within 5 cm)${since(s)}` : `${signed(dz, fmtM)}${since(s)}`;
    },
    legend: () => ({
      kind: 'ramp',
      css: 'linear-gradient(90deg, #ed3f23, #f4a08f, #9aa0a0, #8fb8ef, #006ddf)',
      labels: ['−10 m lower', '±5 cm', '+10 m higher'],
    }),
    colour: (s, i, _d, out, o) => groundDiff(s.compareCheckpoint ? s.surface[i] - s.compareCheckpoint.surface[i] : 0, out, o),
  },
  {
    id: 'cp-water',
    label: 'Water change since checkpoint',
    group: 'Since checkpoint',
    available: (s) => s.compareCheckpoint !== null,
    describe: (s, i) =>
      s.compareCheckpoint
        ? `${signed(s.world.waterDepthM[i] - s.compareCheckpoint.world.waterDepthM[i], (x) => (x < 1 ? `${Math.round(x * 100)} cm` : fmtM(x)))} water${since(s)}`
        : null,
    legend: () => ({
      kind: 'ramp',
      css: 'linear-gradient(90deg, #a0522d, #9aa0a0, #006ddf)',
      labels: ['−10 m drier', '±1 cm', '+10 m wetter'],
    }),
    colour: (s, i, _d, out, o) => waterDiff(s.compareCheckpoint ? s.world.waterDepthM[i] - s.compareCheckpoint.world.waterDepthM[i] : 0, out, o),
  },
  {
    id: 'cp-plants',
    label: 'Plant change since checkpoint',
    group: 'Since checkpoint',
    available: (s) => s.compareCheckpoint !== null && (any(s.world.vegCover, 0.01) || any(s.compareCheckpoint.world.vegCover, 0.01)),
    describe: (s, i) =>
      s.compareCheckpoint
        ? `${signed(100 * (s.world.vegCover[i] - s.compareCheckpoint.world.vegCover[i]), (x) => `${Math.round(x)}%`)} plant cover${since(s)}`
        : null,
    legend: () => ({
      kind: 'ramp',
      css: 'linear-gradient(90deg, #a0522d, #9aa0a0, #25b755)',
      labels: ['fewer plants', 'same', 'more plants'],
    }),
    colour: (s, i, _d, out, o) => plantDiff(s.compareCheckpoint ? s.world.vegCover[i] - s.compareCheckpoint.world.vegCover[i] : 0, out, o),
  },
  {
    id: 'cp-ice',
    label: 'Ice change since checkpoint',
    group: 'Since checkpoint',
    available: (s) => s.compareCheckpoint !== null && (any(s.world.iceThicknessM, 0.5) || any(s.compareCheckpoint.world.iceThicknessM, 0.5)),
    describe: (s, i) => (s.compareCheckpoint ? `${signed(s.world.iceThicknessM[i] - s.compareCheckpoint.world.iceThicknessM[i], fmtM)} ice${since(s)}` : null),
    legend: () => ({
      kind: 'ramp',
      css: 'linear-gradient(90deg, #ff912a, #9aa0a0, #2a5fa8)',
      labels: ['−100 m melted', '±0.5 m', '+100 m grown'],
    }),
    colour: (s, i, _d, out, o) => iceDiff(s.compareCheckpoint ? s.world.iceThicknessM[i] - s.compareCheckpoint.world.iceThicknessM[i] : 0, out, o),
  },
);

export function overlayById(id: OverlayId): OverlayDef | undefined {
  return OVERLAYS.find((o) => o.id === id);
}
