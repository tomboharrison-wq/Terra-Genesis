import { growIsland } from '../sim/lava/build';
import { createWorld, MM_PER_H, STRATA_BOUNDS, STRATA_LAYERS, refreshAllExposed, setUniformStrata, type WorldState } from '../engine/world';
import { Noise2D } from '../utils/noise';
import { deriveSeed } from '../utils/rng';
import { clamp, smoothstep } from '../utils/math';
import { fillDepressions } from './conditioning';
import { settleSlopes } from './settle';
import { applyBiome, type BiomeId } from './biomes';

export type PresetId =
  | 'flat'
  | 'river-delta'
  | 'island'
  | 'archipelago'
  | 'river-basin'
  | 'mountain-range'
  | 'coastal-headland'
  | 'plateau'
  | 'continental'
  | 'temperate-valley'
  | 'alpine-glaciers'
  | 'rain-shadow'
  | 'tundra'
  | 'volcanic-island';

export interface GenerateOptions {
  presetId: PresetId;
  seed: number;
  size: number;
  cellSizeM: number;
  /** Vertical relief scale (m). */
  reliefM: number;
  seaLevelM: number;
  /** 0..1 fine-scale surface roughness. */
  roughness: number;
  /** Initial map-wide rainfall (mm/h). Optional; default 0. */
  rainMmH?: number;
  /** Map-edge water boundary. Optional; default open. */
  boundary?: 'open' | 'closed';
  /** Fill closed depressions with loose sediment so the land drains (default true). */
  drainage?: boolean;
  /** Start with hydraulic erosion enabled (default false). */
  erosion?: boolean;
  /** Start with waves on (default false). */
  waves?: boolean;
  /** Geomorphic acceleration to start with (default: ErosionParams default). */
  speedup?: number;
  /** Climate / plants / glaciers to set up and spin up (biome presets). */
  biome?: BiomeId;
  name?: string;
}

export interface PresetDef {
  id: PresetId;
  name: string;
  description: string;
  defaults: Pick<GenerateOptions, 'cellSizeM' | 'reliefM' | 'seaLevelM' | 'roughness' | 'rainMmH' | 'erosion' | 'waves' | 'speedup' | 'biome'>;
}

export const PRESETS: readonly PresetDef[] = [
  {
    id: 'river-basin',
    name: 'River basin',
    description: 'Horseshoe of ridges draining to a single southern outlet. Starts with heavy rain.',
    defaults: { cellSizeM: 30, reliefM: 900, seaLevelM: -20, roughness: 0.5, rainMmH: 60, erosion: true },
  },
  {
    id: 'river-delta',
    name: 'River to sea',
    description: 'Uplands draining across a coastal plain onto a shallow shelf. Rain and erosion on: watch a delta build.',
    defaults: { cellSizeM: 30, reliefM: 600, seaLevelM: 0, roughness: 0.45, rainMmH: 50, erosion: true },
  },
  {
    id: 'mountain-range',
    name: 'Mountain range',
    description: 'Ridged crystalline range with foothills and a lowland plain.',
    defaults: { cellSizeM: 40, reliefM: 1800, seaLevelM: -50, roughness: 0.6 },
  },
  {
    id: 'island',
    name: 'Island',
    description: 'Single rugged island rising from shallow sea.',
    defaults: { cellSizeM: 30, reliefM: 700, seaLevelM: 0, roughness: 0.5 },
  },
  {
    id: 'archipelago',
    name: 'Archipelago',
    description: 'Scattered islands across a shelf sea.',
    defaults: { cellSizeM: 40, reliefM: 500, seaLevelM: 0, roughness: 0.5 },
  },
  {
    id: 'coastal-headland',
    name: 'Coastal headlands',
    description: 'Straight coast across alternating hard chalk and soft clay bands; waves from the south carve bays in the clay, leaving chalk headlands.',
    defaults: { cellSizeM: 10, reliefM: 60, seaLevelM: 0, roughness: 0.4, erosion: true, waves: true, speedup: 1000 },
  },
  {
    id: 'plateau',
    name: 'Layered plateau',
    description: 'Resistant cap rock over weaker strata with escarpments.',
    defaults: { cellSizeM: 25, reliefM: 400, seaLevelM: -100, roughness: 0.35 },
  },
  {
    id: 'continental',
    name: 'Continental',
    description: 'Large-scale mixed terrain: uplands, lowlands and coast.',
    defaults: { cellSizeM: 120, reliefM: 1500, seaLevelM: 0, roughness: 0.55 },
  },
  {
    id: 'temperate-valley',
    name: 'Temperate valley',
    description: 'Mild, wet climate: forested valley floors and slopes, bare rock only on the highest ridges.',
    defaults: { cellSizeM: 30, reliefM: 900, seaLevelM: -20, roughness: 0.5, biome: 'temperate' },
  },
  {
    id: 'alpine-glaciers',
    name: 'Alpine glaciers',
    description: 'High mountains in a cool climate: glaciers above the snowline flowing into forested valleys.',
    defaults: { cellSizeM: 40, reliefM: 2600, seaLevelM: -50, roughness: 0.55, biome: 'alpine' },
  },
  {
    id: 'rain-shadow',
    name: 'Rain-shadow desert',
    description: 'A ridge across the westerly wind: wet forest on the windward side, dry scrub in its rain shadow.',
    defaults: { cellSizeM: 60, reliefM: 1800, seaLevelM: -50, roughness: 0.45, biome: 'rain-shadow' },
  },
  {
    id: 'tundra',
    name: 'Tundra',
    description: 'Cold lowland: a short summer allows only sparse plants; snow lies long and ice caps the hills.',
    defaults: { cellSizeM: 60, reliefM: 700, seaLevelM: 0, roughness: 0.5, biome: 'tundra' },
  },
  {
    id: 'volcanic-island',
    name: 'Volcanic island',
    description:
      'A new island grown by eruptions from a vent on the sea floor (explosive under water, lava once above it), like Surtsey. Fresh rock and ash, no plants yet.',
    defaults: { cellSizeM: 30, reliefM: 60, seaLevelM: 0, roughness: 0.3 },
  },
  {
    id: 'flat',
    name: 'Flat test world',
    description: 'Level plain 10 m above sea level for controlled tests.',
    defaults: { cellSizeM: 10, reliefM: 0, seaLevelM: 0, roughness: 0 },
  },
];

export function presetById(id: string): PresetDef {
  return PRESETS.find((p) => p.id === id) ?? PRESETS[0];
}

export function defaultOptions(presetId: PresetId, seed: number, size = 256): GenerateOptions {
  return { presetId, seed, size, ...presetById(presetId).defaults };
}

// Material ids (see materials.ts)
const CRYSTALLINE = 0;
const SANDSTONE = 1;
const MUDSTONE = 2;
const CLAY = 3;
const CHALK = 4;
const VOLCANIC = 5;

interface Ctx {
  u: number;
  v: number;
  n: Noise2D;
  n2: Noise2D;
  o: GenerateOptions;
}

/** Elevation in units of relief (≈ -0.3 .. 1) and bedrock material for a sample point. */
type ShapeFn = (c: Ctx) => { e: number; mat: number };

function warp(c: Ctx, amount: number, freq = 2.2): [number, number] {
  return [c.u + amount * c.n2.fbm(c.u * freq + 3.1, c.v * freq + 7.7, 3), c.v + amount * c.n2.fbm(c.u * freq - 5.3, c.v * freq + 1.9, 3)];
}

const shapes: Partial<Record<PresetId, ShapeFn>> = {
  flat: () => ({ e: 0, mat: MUDSTONE }),

  'rain-shadow': (c) => {
    // One north–south range at u ≈ 0.45 between low plains; the westerly wind meets its west face.
    const [wu, wv] = warp(c, 0.06);
    const dx = (wu - 0.45 - 0.05 * Math.sin(wv * Math.PI * 2)) / 0.09;
    const range = Math.exp(-dx * dx);
    const ridge = c.n.ridged(wu * 4, wv * 4, 5);
    const e = 0.04 + range * (0.45 + 0.55 * ridge) + 0.05 * c.n.fbm(wu * 5, wv * 5, 4);
    return { e, mat: range > 0.5 ? CRYSTALLINE : SANDSTONE };
  },

  'river-basin': (c) => {
    const [wu, wv] = warp(c, 0.06);
    // Meandering main valley axis running south (v=0) to north.
    const axis = 0.5 + 0.1 * Math.sin(wv * Math.PI * 1.6 + c.n.noise(0.3, 0.7) * 3);
    const dx = (wu - axis) / 0.2;
    const valley = 1 - Math.exp(-dx * dx);
    // Horseshoe rim: high to the north, east and west.
    const rim = Math.max(smoothstep(0.25, 1, wv), smoothstep(0.3, 0.5, Math.abs(wu - 0.5)));
    const ridges = c.n.ridged(wu * 4, wv * 4, 5);
    const base = 0.04 + 0.3 * wv + 0.35 * valley * (0.35 + 0.65 * wv) + 0.25 * rim;
    const e = base * (0.72 + 0.45 * ridges) + 0.05 * c.n.fbm(wu * 9, wv * 9, 4);
    const mat = e > 0.65 ? CRYSTALLINE : e > 0.35 ? SANDSTONE : ridges > 0.55 ? SANDSTONE : MUDSTONE;
    return { e, mat };
  },

  'river-delta': (c) => {
    const [wu, wv] = warp(c, 0.05);
    // Coast runs east–west at v ≈ 0.3; land rises northward; one main valley feeds the coast.
    const coast = 0.3 + 0.04 * c.n.fbm(wu * 3, 1.7, 3);
    const land = wv - coast;
    const axis = 0.5 + 0.08 * Math.sin(wv * Math.PI * 2 + 1);
    const dx = (wu - axis) / 0.16;
    const valley = 1 - Math.exp(-dx * dx);
    const ridges = c.n.ridged(wu * 4, wv * 4, 5);
    let e: number;
    if (land < 0)
      e = land * 0.25 - 0.004; // shallow shelf
    else e = 0.01 + land * 0.95 * (0.3 + 0.7 * valley) * (0.7 + 0.45 * ridges) + 0.015 * c.n.fbm(wu * 10, wv * 10, 3);
    const mat = e > 0.35 ? CRYSTALLINE : e > 0.15 ? SANDSTONE : MUDSTONE;
    return { e, mat };
  },

  'mountain-range': (c) => {
    const [wu, wv] = warp(c, 0.1);
    // Range runs SW→NE.
    const along = (wu + wv) * 0.7071;
    const across = (wu - wv) * 0.7071 + 0.12 * c.n.fbm(along * 2, 0.5, 3);
    const band = Math.exp(-((across / 0.2) ** 2));
    const ridge = c.n.ridged(wu * 3.5, wv * 3.5, 6);
    const foot = 0.18 * smoothstep(-0.7, 0.2, across) * (0.5 + 0.5 * c.n.fbm(wu * 3, wv * 3, 4));
    const e = 0.03 + foot + band * (0.35 + 0.75 * ridge) + 0.03 * c.n.fbm(wu * 12, wv * 12, 3) - 0.05 * smoothstep(0.2, 0.7, -across);
    const mat = band > 0.55 ? CRYSTALLINE : band > 0.2 ? SANDSTONE : ridge > 0.6 ? SANDSTONE : MUDSTONE;
    return { e, mat };
  },

  island: (c) => {
    const [wu, wv] = warp(c, 0.12, 1.8);
    const d = Math.hypot(wu - 0.5, wv - 0.5);
    const mask = smoothstep(0.46, 0.08, d);
    const ridge = c.n.ridged(wu * 3, wv * 3, 6);
    const e = -0.3 + 0.38 * mask + mask * mask * (0.25 + 0.7 * ridge) + 0.04 * c.n.fbm(wu * 10, wv * 10, 4);
    const mat = mask > 0.75 && ridge > 0.4 ? CRYSTALLINE : e > 0.15 ? SANDSTONE : MUDSTONE;
    return { e, mat };
  },

  // Ocean floor (old basalt) at about −relief, gently undulating; the island itself is grown by
  // real eruptions in generateWorld (growIsland).
  'volcanic-island': (c) => ({ e: -1 + 0.08 * c.n.fbm(c.u * 3, c.v * 3, 3), mat: VOLCANIC }),

  archipelago: (c) => {
    const [wu, wv] = warp(c, 0.1);
    const blobs = c.n.fbm(wu * 3.2, wv * 3.2, 5);
    const edge = smoothstep(0.5, 0.42, Math.max(Math.abs(c.u - 0.5), Math.abs(c.v - 0.5)));
    const land = blobs + 0.2 * edge - 0.12;
    const ridge = c.n.ridged(wu * 6, wv * 6, 4);
    const e = land < 0 ? land * 0.9 : land * (0.8 + 1.2 * ridge);
    return { e: e - 0.03, mat: ridge > 0.6 && land > 0.15 ? CRYSTALLINE : land > 0.08 ? SANDSTONE : CLAY };
  },

  'coastal-headland': (c) => {
    // Straight coastline (sea to the south) cut across alternating north–south bands of hard
    // chalk and soft clay, with cliffs at the waterline and water deepening offshore — waves,
    // not the generator, carve the bays.
    const [wu, wv] = warp(c, 0.02);
    const bandCoord = wu * 4 + 0.1 * c.n.fbm(wv * 2, 1.3, 3);
    const hard = smoothstep(-0.3, 0.4, Math.sin(bandCoord * Math.PI * 2));
    const coastV = 0.32 + 0.01 * c.n.fbm(wu * 6, 2.1, 3);
    const land = wv - coastV;
    let e: number;
    if (land < 0)
      e = -0.06 + land * 1.2; // ~7 m deep at the cliff foot, deepening offshore
    else {
      const top = 0.18 + 0.27 * hard; // chalk headlands stand higher than clay
      const rise = smoothstep(0, 0.02 + 0.06 * (1 - hard), land); // chalk: sheer; clay: slumped
      e = top * rise + 0.25 * smoothstep(0.05, 0.6, land) * (0.6 + 0.4 * c.n.fbm(wu * 3, wv * 3, 4)) + 0.015 * c.n.fbm(wu * 14, wv * 14, 3);
    }
    return { e, mat: hard > 0.5 ? CHALK : CLAY };
  },

  plateau: (c) => {
    const [wu, wv] = warp(c, 0.08);
    const mesa = c.n.fbm(wu * 2.4, wv * 2.4, 5) + 0.25;
    const top = smoothstep(0.18, 0.24, mesa);
    const lower = smoothstep(-0.1, 0.0, mesa);
    const e = 0.1 + 0.25 * lower + 0.55 * top + 0.04 * c.n.fbm(wu * 8, wv * 8, 4);
    // Layered stratigraphy by elevation: chalk cap, sandstone, mudstone base.
    const mat = e > 0.78 ? CHALK : e > 0.32 ? SANDSTONE : MUDSTONE;
    return { e, mat };
  },

  continental: (c) => {
    const [wu, wv] = warp(c, 0.15, 1.5);
    const cont = c.n.fbm(wu * 1.6, wv * 1.6, 6) + 0.15;
    const mount = c.n.ridged(wu * 2.5, wv * 2.5, 6) * smoothstep(0.1, 0.45, cont);
    const e = cont < 0 ? cont * 0.8 : cont * 0.35 + mount * 0.75;
    const mat = mount > 0.35 ? CRYSTALLINE : cont > 0.25 ? SANDSTONE : cont > 0.05 ? MUDSTONE : CLAY;
    return { e, mat };
  },
};

// Biome presets reuse existing landform shapes with their own climate.
shapes['temperate-valley'] = shapes['river-basin'];
shapes['alpine-glaciers'] = shapes['mountain-range'];
shapes.tundra = shapes['river-delta'];

/** Deterministically generate a world. Same options → bit-identical arrays. */
export function generateWorld(o: GenerateOptions): WorldState {
  const size = Math.round(o.size);
  const world = createWorld({
    width: size,
    height: size,
    cellSizeM: o.cellSizeM,
    seaLevelM: o.seaLevelM,
    seed: o.seed,
    meta: { name: o.name ?? presetById(o.presetId).name, presetId: o.presetId, reliefM: o.reliefM },
  });
  const n = new Noise2D(deriveSeed(o.seed, 'shape'));
  const n2 = new Noise2D(deriveSeed(o.seed, 'warp'));
  const nd = new Noise2D(deriveSeed(o.seed, 'detail'));
  world.water.rainMPerS = (o.rainMmH ?? 0) * MM_PER_H;
  world.water.boundary = o.boundary ?? 'open';
  world.erosion.enabled = o.erosion ?? false;
  world.coast.wavesOn = o.waves ?? false;
  if (o.speedup) world.erosion.speedup = o.speedup;
  const shape = (shapes[o.presetId] ?? shapes.flat)!;
  const surf = new Float32Array(size * size);
  const ctx: Ctx = { u: 0, v: 0, n, n2, o };
  const inv = 1 / (size - 1);
  const flatBase = o.presetId === 'flat' ? 10 : 0;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      ctx.u = x * inv;
      ctx.v = y * inv;
      const { e, mat } = shape(ctx);
      const detail = o.roughness * 0.012 * nd.fbm(ctx.u * 40, ctx.v * 40, 3);
      const i = y * size + x;
      surf[i] = flatBase + (e + detail) * o.reliefM;
      world.materialId[i] = mat;
    }
  }

  // Loose sediment (regolith/soil): thicker on gentle, low ground; thin on steep or high ground.
  const nsed = new Noise2D(deriveSeed(o.seed, 'sediment'));
  const cs = o.cellSizeM;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const xl = Math.max(0, x - 1);
      const xr = Math.min(size - 1, x + 1);
      const yd = Math.max(0, y - 1);
      const yu = Math.min(size - 1, y + 1);
      const sx = (surf[y * size + xr] - surf[y * size + xl]) / ((xr - xl) * cs);
      const sy = (surf[yu * size + x] - surf[yd * size + x]) / ((yu - yd) * cs);
      const slope = Math.hypot(sx, sy);
      const relH = o.reliefM > 0 ? (surf[i] - o.seaLevelM) / o.reliefM : 0;
      const gentle = clamp(1 - slope / 0.7, 0, 1);
      const altitudeFactor = clamp(1 - relH * 0.8, 0.25, 1);
      const sed = 2.0 * gentle * gentle * altitudeFactor * (0.7 + 0.3 * nsed.noise(x * 0.05, y * 0.05));
      const thickness = o.presetId === 'flat' ? 1 : Math.max(0, sed);
      world.looseSedimentThicknessM[i] = thickness;
      world.bedrockElevationM[i] = surf[i] - thickness;
    }
  }

  // Stratigraphy: single-layer columns by default; the plateau gets real horizontal strata.
  setUniformStrata(world);
  if (o.presetId === 'plateau') applyPlateauStrata(world, o, nd);
  refreshAllExposed(world);

  // Settle over-steep slopes to the dry stability limits the simulator uses (talus aprons).
  if (o.presetId !== 'flat') {
    settleSlopes(world);
    for (let i = 0; i < surf.length; i++) surf[i] = world.bedrockElevationM[i] + world.looseSedimentThicknessM[i];
  }

  // Drainage conditioning: fill closed hollows with alluvium so rain organises into rivers.
  if (o.drainage !== false && o.presetId !== 'flat') {
    // 0.2 % down-valley gradient on filled ground: alluvial plains slope gently to their outlet.
    const eps = Math.max(2e-3, 2e-3 * cs);
    const sl = o.seaLevelM;
    const filled = fillDepressions(surf, size, size, eps, (i) => surf[i] < sl);
    for (let i = 0; i < surf.length; i++) {
      const add = filled[i] - surf[i];
      if (add > 0) world.looseSedimentThicknessM[i] += add;
    }
  }
  if (o.presetId === 'volcanic-island') growIsland(world, 3);
  if (o.biome) applyBiome(world, o.biome);
  return world;
}

/**
 * Layered plateau: resistant sandstone cap over weak mudstone over clay, with a gentle dip and
 * slight undulation, so erosion through the cap exposes weaker rock and scarps retreat.
 */
function applyPlateauStrata(w: WorldState, o: GenerateOptions, n: Noise2D) {
  const R = o.reliefM;
  const size = w.width;
  const inv = 1 / (size - 1);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const u = x * inv;
      const v = y * inv;
      const undulate = 0.015 * R * n.fbm(u * 2.5 + 11, v * 2.5 - 4, 3);
      const dip = 0.04 * R * (u - 0.5);
      const ob = i * STRATA_BOUNDS;
      w.strataBoundsM[ob] = 0.6 * R + dip + undulate; // base of cap rock
      w.strataBoundsM[ob + 1] = 0.25 * R + dip + undulate; // base of mudstone
      w.strataBoundsM[ob + 2] = -1e9;
      const om = i * STRATA_LAYERS;
      w.strataMaterial[om] = SANDSTONE;
      w.strataMaterial[om + 1] = MUDSTONE;
      w.strataMaterial[om + 2] = CLAY;
      w.strataMaterial[om + 3] = CLAY;
    }
  }
}
