import { createWorld, refreshAllExposed, STRATA_BOUNDS, STRATA_LAYERS, type WorldState } from '../engine/world';
import { Noise2D } from '../utils/noise';

/** Rock ids (terrain/materials.ts). */
const SANDSTONE = 1;
const MUDSTONE = 2;
const DOLERITE = 5; // volcanic: a hard igneous sill, like the Whin Sill under High Force

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
