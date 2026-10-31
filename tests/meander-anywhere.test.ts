import { describe, expect, it } from 'vitest';
import { createWorld, setUniformStrata, refreshAllExposed, type WorldState } from '../src/engine/world';
import { Engine } from '../src/engine/engine';
import { findMeanderReach } from '../src/sim/geology/meanderReach';
import { sinuosity, floodplainZ } from '../src/sim/geology/meander';
import { Noise2D } from '../src/utils/noise';

/** A winding lowland valley (gradient 1 in 1,000) with `alluvium` m of river sediment, hills either side, sea in the west. */
function windingValley(alluvium: number): WorldState {
  const W = 220;
  const H = 150;
  const cs = 20;
  const w = createWorld({ width: W, height: H, cellSizeM: cs, seed: 4 });
  w.seaLevelM = 0;
  w.water.boundary = 'closed';
  const nz = new Noise2D(4);
  const axis = (x: number) => H / 2 + 22 * Math.sin((x / W) * 2.5 * Math.PI); // the valley winds
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const fp = 4 + Math.max(0, x - 10) * cs * 0.001;
      const off = Math.abs(y - axis(x)) / 40; // 0 on the valley axis, 1 at the valley side
      const hills = 50 * Math.max(0, off - 1) ** 1.3;
      const z = x < 10 ? -12 : fp + hills + 0.3 * nz.fbm(x * 0.08, y * 0.08, 3);
      const sed = x < 10 ? 0 : off < 1 ? alluvium : 0.3;
      w.bedrockElevationM[i] = z - sed;
      w.looseSedimentThicknessM[i] = sed;
    }
  w.materialId.fill(2);
  setUniformStrata(w);
  refreshAllExposed(w);
  return w;
}
const volume = (w: WorldState) => {
  let v = 0;
  for (let i = 0; i < w.bedrockElevationM.length; i++) v += w.bedrockElevationM[i] + w.looseSedimentThicknessM[i];
  return v * w.cellSizeM * w.cellSizeM;
};

describe('meandering river in any world (M13-C05b)', () => {
  it('finds the gentle lower course of the main river and follows its winding valley', () => {
    const w = windingValley(8);
    const r = findMeanderReach(w);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.lengthM).toBeGreaterThan(3000);
    expect(r.gradient).toBeGreaterThan(0.0005);
    expect(r.gradient).toBeLessThan(0.0015);
    // The floodplain level follows the winding valley, falling to the mouth.
    const m = r.meander;
    expect(m.vz![0]).toBeGreaterThan(m.vz![m.vz!.length - 1]);
    const mid = Math.floor(m.xs.length / 2);
    expect(Math.abs(floodplainZ(m, m.xs[mid], m.ys[mid]) - (4 + (m.xs[mid] / 20 - 10) * 20 * 0.001))).toBeLessThan(1);
    expect(sinuosity(m)).toBeLessThan(1.15); // starts nearly straight along its valley
  });

  it('says why not when the valley floor is rock or thin soil', () => {
    const r = findMeanderReach(windingValley(0.3));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/too little river sediment/);
  });

  it('bends grow across the floodplain in geological time; rock + sediment conserved (load from upstream on the map)', () => {
    const e = new Engine(windingValley(8));
    const r = findMeanderReach(e.world);
    if (!r.ok) throw new Error(r.reason);
    e.setMeander(r.meander);
    const s0 = sinuosity(e.geoMeander!);
    const v0 = volume(e.world);
    const st = e.geoStep(3000);
    const m = e.geoMeander!;
    expect(sinuosity(m)).toBeGreaterThan(s0 + 0.1);
    // Volume change = what left the map; the load captured since the last carve is still in the river.
    const err = Math.abs(volume(e.world) - v0 + st.exported - st.uplifted + (m.pendingM3 ?? 0));
    expect(err / Math.max(1, st.bankEroded)).toBeLessThan(0.01);
    expect(st.supplied).toBe(0); // nothing from beyond the map
  }, 120000);
});
