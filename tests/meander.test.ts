import { describe, expect, it } from 'vitest';
import { buildLowlandWorld } from '../src/education/scenarioWorlds';
import { carve, createMeander, migrate, sinuosity, cloneMeander } from '../src/sim/geology/meander';
import { LandscapeEvolution, defaultGeoParams } from '../src/sim/geology/landscapeEvolution';
import { runGeologic } from '../src/sim/geology/run';
import type { WorldState } from '../src/engine/world';

const volume = (w: WorldState) => {
  let v = 0;
  for (let i = 0; i < w.bedrockElevationM.length; i++) v += w.bedrockElevationM[i] + w.looseSedimentThicknessM[i];
  return v * w.cellSizeM * w.cellSizeM;
};

describe('meandering river (Howard & Knutson centreline migration)', () => {
  it('small bends grow into meanders and travel downstream', () => {
    const s = buildLowlandWorld();
    const m = createMeander(s.xs, s.ys, s.zIn, s.zOut);
    const amp = (mm: typeof m) => Math.max(...mm.ys) - Math.min(...mm.ys);
    const a0 = amp(m);
    // Track one growing bend: the node of greatest offset in the middle third.
    const apexX = (mm: typeof m) => {
      let best = 0;
      let bx = 0;
      for (let k = 0; k < mm.xs.length; k++)
        if (mm.xs[k] > 1600 && mm.xs[k] < 3200 && Math.abs(mm.ys[k] - 1600) > best) {
          best = Math.abs(mm.ys[k] - 1600);
          bx = mm.xs[k];
        }
      return bx;
    };
    for (let t = 0; t < 7000; t += 4) migrate(s.world, m, 4);
    expect(sinuosity(m)).toBeGreaterThan(1.1);
    expect(amp(m)).toBeGreaterThan(3 * a0);
    const x1 = apexX(m);
    const m2 = cloneMeander(m);
    for (let t = 0; t < 600; t += 4) migrate(s.world, m2, 4);
    expect(apexX(m2)).toBeLessThan(x1); // the river flows west: bends move downstream
  });

  it('necks are cut off, leaving oxbow loops, and the channel stays on the floodplain', () => {
    const s = buildLowlandWorld();
    const m = createMeander(s.xs, s.ys, s.zIn, s.zOut);
    for (let t = 0; t < 14000 && m.cutoffs === 0; t += 4) migrate(s.world, m, 4);
    expect(m.cutoffs).toBeGreaterThan(0);
    expect(m.oxbows.length).toBeGreaterThan(0);
    expect(m.oxbows[0].xs.length).toBeGreaterThan(10);
    const H = (s.world.height - 1) * s.world.cellSizeM;
    for (const y of m.ys) {
      expect(y).toBeGreaterThan(0.08 * H); // not into the hills on either side
      expect(y).toBeLessThan(0.92 * H);
    }
  });

  it('carving conserves volume: change = supply from upstream − sediment leaving the map', () => {
    const s = buildLowlandWorld();
    const w = s.world;
    const geo = new LandscapeEvolution(w);
    const m = createMeander(s.xs, s.ys, s.zIn, s.zOut);
    carve(w, m, 0);
    const v0 = volume(w);
    const st = runGeologic(geo, 3000, defaultGeoParams(), 5000, m);
    const expected = st.supplied - st.exported + st.uplifted;
    expect(st.supplied).toBeGreaterThan(0);
    expect(st.bankEroded).toBeGreaterThan(0);
    expect(st.overbank).toBeGreaterThan(0);
    expect(Math.abs(volume(w) - v0 - expected) / (st.supplied + st.bankEroded)).toBeLessThan(2e-3);
  });
});
