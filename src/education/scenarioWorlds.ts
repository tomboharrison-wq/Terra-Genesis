import { createWorld, refreshAllExposed, STRATA_BOUNDS, STRATA_LAYERS, type WorldState } from '../engine/world';
import { Noise2D } from '../utils/noise';

/** Rock ids (terrain/materials.ts). */
const SANDSTONE = 1;
const MUDSTONE = 2;
const DOLERITE = 5; // volcanic: a hard igneous sill, like the Whin Sill under High Force
const VOLCANIC_ROCK = 5;
const CLAY = 3;
const CHALK = 4; // chalk / limestone (like the Purbeck limestone and chalk of Swanage)

/**
 * Waterfall world: a plateau 4 km long sloping gently west to the sea, ending at a coastal slope.
 * Horizontal rock layers like upper Teesdale: sandstone on top, a 28 m band of hard dolerite
 * (112–140 m), soft mudstone (shale) beneath. A broad shallow trough gathers the drainage into one
 * main river crossing the band.
 */
export function buildWaterfallWorld(seed = 3): WorldState {
  const W = 160;
  const H = 96;
  const cs = 25;
  const w = createWorld({ width: W, height: H, cellSizeM: cs, seed, meta: { name: 'Lesson: waterfall and gorge', presetId: 'scenario-waterfall', reliefM: 260 } });
  w.seaLevelM = 0;
  w.water.boundary = 'closed';
  const n = new Noise2D(seed);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const plateau = 150 + 0.012 * x * cs + 0.004 * Math.abs(y - H / 2) * cs + 6 * n.fbm(x * 0.05, y * 0.05, 4);
      w.bedrockElevationM[i] = x < 18 ? -60 : x < 26 ? -10 + (plateau + 10) * ((x - 18) / 8) : plateau;
      const ob = i * STRATA_BOUNDS;
      const om = i * STRATA_LAYERS;
      w.strataBoundsM[ob] = 140;
      w.strataBoundsM[ob + 1] = 112;
      w.strataBoundsM[ob + 2] = -1e9;
      w.strataMaterial[om] = SANDSTONE;
      w.strataMaterial[om + 1] = DOLERITE;
      w.strataMaterial[om + 2] = MUDSTONE;
      w.strataMaterial[om + 3] = MUDSTONE;
    }
  refreshAllExposed(w);
  return w;
}

/**
 * Upland world: hills of mudstone and sandstone (the upper course of a river) rising east from a sea
 * on the west, with winding initial valleys (noise) so the river has bends to cut spurs from.
 */
export function buildUplandWorld(seed = 11): WorldState {
  const W = 192;
  const H = 128;
  const cs = 25;
  const w = createWorld({ width: W, height: H, cellSizeM: cs, seed, meta: { name: 'Lesson: V-shaped valley and interlocking spurs', presetId: 'scenario-upland', reliefM: 400 } });
  w.seaLevelM = 0;
  w.water.boundary = 'closed';
  const n = new Noise2D(seed);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const u = x / W;
      const v = y / H;
      const meanderY = 0.5 + 0.12 * Math.sin(u * 9 + 1) + 0.05 * n.fbm(u * 3, 7.1, 3);
      const trough = 60 * Math.min(1, Math.abs(v - meanderY) / 0.35);
      const land = 20 + 340 * Math.pow(u, 0.8) + trough + 25 * n.fbm(u * 5, v * 5, 5);
      w.bedrockElevationM[i] = x < 14 ? -60 : x < 22 ? -10 + (land + 10) * ((x - 14) / 8) : land;
      const ob = i * STRATA_BOUNDS;
      const om = i * STRATA_LAYERS;
      w.strataBoundsM[ob] = 250 + 40 * n.fbm(u * 2 + 5, v * 2, 3);
      w.strataBoundsM[ob + 1] = -1e9;
      w.strataBoundsM[ob + 2] = -1e9;
      w.strataMaterial[om] = SANDSTONE;
      w.strataMaterial[om + 1] = MUDSTONE;
      w.strataMaterial[om + 2] = MUDSTONE;
      w.strataMaterial[om + 3] = MUDSTONE;
    }
  refreshAllExposed(w);
  return w;
}

/**
 * Lowland world: a floodplain 4.8 km long and ~2.4 km wide of thick alluvium (8 m of loose sediment
 * over mudstone), gradient 1 : 1,250 down to the sea on the west, between low sandstone hills. A large
 * river enters at the east edge (its catchment lies beyond the map). Returns the world and an initial,
 * gently winding centreline (meanders grow from such irregularities).
 */
export function buildLowlandWorld(seed = 21): { world: WorldState; xs: number[]; ys: number[]; zIn: number; zOut: number } {
  const W = 240;
  const H = 160;
  const cs = 20;
  const w = createWorld({ width: W, height: H, cellSizeM: cs, seed, meta: { name: 'Lesson: meanders, oxbow lakes, floodplain and levees', presetId: 'scenario-lowland', reliefM: 80 } });
  w.seaLevelM = 0;
  w.water.boundary = 'closed';
  const n = new Noise2D(seed);
  const sea = 12;
  const zOut = 4; // the channel bed (3 m down) stays above sea level until the mouth
  const zIn = zOut + (W - 1 - sea) * cs * 0.0008;
  const fp = (x: number) => zOut + Math.max(0, x - sea) * cs * 0.0008;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const dy = Math.abs(y - H / 2) / (H / 2); // 0 at the valley axis, 1 at the map edge
      const hills = 60 * Math.max(0, (dy - 0.75) / 0.25) ** 1.5 * (0.8 + 0.4 * n.fbm(x * 0.03, y * 0.03, 3));
      const ground = fp(x) + 0.3 * n.fbm(x * 0.08, y * 0.08, 3) + hills;
      const z = x < sea ? -15 + (x / sea) * 10 : ground;
      const alluvium = x < sea ? 0 : dy < 0.78 ? 8 : 0.3;
      w.bedrockElevationM[i] = z - alluvium;
      w.looseSedimentThicknessM[i] = alluvium;
      const ob = i * STRATA_BOUNDS;
      const om = i * STRATA_LAYERS;
      w.strataBoundsM[ob] = fp(x) - 4;
      w.strataBoundsM[ob + 1] = -1e9;
      w.strataBoundsM[ob + 2] = -1e9;
      w.strataMaterial[om] = SANDSTONE;
      w.strataMaterial[om + 1] = MUDSTONE;
      w.strataMaterial[om + 2] = MUDSTONE;
      w.strataMaterial[om + 3] = MUDSTONE;
    }
  refreshAllExposed(w);
  const xs: number[] = [];
  const ys: number[] = [];
  const y0 = (H / 2) * cs;
  for (let x = (W - 1) * cs; x >= sea * cs; x -= 20) {
    xs.push(x);
    ys.push(y0 + 25 * Math.sin((x * 2 * Math.PI) / 700) + 20 * n.fbm(x * 0.003, 3.3, 2)); // gently winding (amplitude ~ half a channel width)
  }
  return { world: w, xs, ys, zIn, zOut };
}

/**
 * Mountain world for glaciation: a massif of hard volcanic rock (like the Borrowdale Volcanics of the
 * Lake District) rising to ~1,100 m from lowland at ~150 m, with ridges and hollows from noise. Open
 * map edges. River valleys are cut into it in the lesson's first stage (geological time).
 */
export function buildMountainWorld(seed = 31): WorldState {
  const W = 110;
  const H = 88;
  const cs = 60;
  const w = createWorld({ width: W, height: H, cellSizeM: cs, seed, meta: { name: 'Lesson: glaciated upland', presetId: 'scenario-mountains', reliefM: 1100 } });
  w.seaLevelM = -200;
  w.water.boundary = 'open';
  const n = new Noise2D(seed);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const u = x / (W - 1) - 0.5;
      const v = y / (H - 1) - 0.5;
      const r = Math.hypot(u / 0.42, v / 0.36);
      const dome = Math.exp(-r * r * 1.6);
      const ridges = n.ridged(u * 3 + 7, v * 3 + 2, 5);
      w.bedrockElevationM[i] = 150 + 850 * dome + 260 * dome * ridges + 25 * n.fbm(u * 9, v * 9, 3);
      w.looseSedimentThicknessM[i] = 0.5;
      w.materialId[i] = VOLCANIC_ROCK;
    }
  setUniformStrataLocal(w);
  return w;
}

function setUniformStrataLocal(w: WorldState) {
  w.strataBoundsM.fill(-1e9);
  for (let i = 0; i < w.materialId.length; i++) w.strataMaterial.fill(w.materialId[i], i * STRATA_LAYERS, (i + 1) * STRATA_LAYERS);
  refreshAllExposed(w);
}

/**
 * Discordant coast (like Swanage Bay, Dorset): land on the west, sea on the east, an initially straight
 * north–south coastline with 20–35 m cliffs. The rock comes in bands at right angles to the coast —
 * resistant chalk / limestone alternating with soft clay — so waves from the east wear the clay back
 * faster. Bands: chalk, clay, chalk, clay, chalk (south to north).
 */
export function buildDiscordantCoastWorld(seed = 41): WorldState {
  const W = 150;
  const H = 130;
  const cs = 20;
  const w = createWorld({ width: W, height: H, cellSizeM: cs, seed, meta: { name: 'Lesson: headlands and bays', presetId: 'scenario-coast', reliefM: 60 } });
  w.seaLevelM = 0;
  w.water.boundary = 'closed';
  const n = new Noise2D(seed);
  const coastX = 0.6 * W;
  const bands = [CHALK, CLAY, CHALK, CLAY, CHALK];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const inland = (coastX - x) * cs; // m from the initial coast
      const shore = coastX + 1.5 * n.fbm(y * 0.05, 1.7, 3); // a slightly irregular line
      const land = 22 + Math.min(40, Math.max(0, inland) * 0.012) + 3 * n.fbm(x * 0.03, y * 0.03, 4);
      const seaFloor = -4 - Math.max(0, x - shore) * cs * 0.01; // gently shelving: 1 % gradient
      w.bedrockElevationM[i] = x < shore ? land : seaFloor;
      w.looseSedimentThicknessM[i] = x < shore ? 0.4 : 0;
      w.materialId[i] = bands[Math.min(bands.length - 1, Math.floor((y / H) * bands.length))];
    }
  setUniformStrataLocal(w);
  w.coast.wavesOn = true;
  w.coast.waveFromDeg = 100;
  w.coast.waveHeightM = 2;
  w.coast.wavePeriodS = 8;
  return w;
}
