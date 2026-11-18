import { expect, it } from 'vitest';
import { Engine } from '../src/engine/engine';
import { buildLiveLeveeWorld } from '../src/education/lessons/liveLevees';
import { leveeHeight } from '../src/education/geoFeatures';

it('repeated overbank deposition builds real bank ridges from a conserved sediment supply', () => {
  const e = new Engine(buildLiveLeveeWorld());
  const w = e.world, cs = w.cellSizeM;
  const volume = () => e.surface.reduce((a, v) => a + v * cs * cs, 0);
  const initial = volume();
  const initialSoil = w.looseSedimentThicknessM.slice();
  const before = leveeHeight(w, e.geoMeander!, 100).heightM;
  e.geoStep(200);
  const after = leveeHeight(w, e.geoMeander!, 100).heightM;
  expect(before).toBeLessThan(0.01);
  expect(after).toBeGreaterThan(0.3);
  const i = (y: number) => Math.round(y / cs) * w.width + 64;
  const near = i(192 + 20), far = i(192 + 100);
  expect(w.looseSedimentThicknessM[near] - initialSoil[near]).toBeGreaterThan(w.looseSedimentThicknessM[far] - initialSoil[far]);
  const t = e.geoTotals;
  expect(Math.abs(volume() - initial - t.supplied - t.uplifted + t.exported)).toBeLessThan(1);
  expect(t.overbank).toBeGreaterThan(0);
});
