import { describe, expect, it } from 'vitest';
import { createWorld, setUniformStrata, refreshAllExposed, type WorldState } from '../src/engine/world';
import { LandscapeEvolution, defaultGeoParams, emptyGeoStats, addGeoStats, type GeoParams } from '../src/sim/geology/landscapeEvolution';
import { generateWorld, defaultOptions } from '../src/terrain/generate';
import { mulberry32 } from '../src/utils/rng';

/** A strip draining west into a deep sea column at x = 0 (closed edges elsewhere). */
function strip(W: number, H: number, cs: number): WorldState {
  const w = createWorld({ width: W, height: H, cellSizeM: cs, seed: 1 });
  w.water.boundary = 'closed';
  w.seaLevelM = 0;
  const rnd = mulberry32(7);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) w.bedrockElevationM[y * W + x] = x === 0 ? -1e5 : 1 + x * 0.05 * cs * 0.01 + rnd() * 0.01;
  w.materialId.fill(2); // weak sedimentary, erodibility 1
  setUniformStrata(w);
  refreshAllExposed(w);
  return w;
}
const river = (o: Partial<GeoParams> = {}): GeoParams => ({ ...defaultGeoParams(), diffusivity: 0, soilProduction: 0, slopeFailure: false, soilFactor: 1, ...o });
const surf = (w: WorldState, i: number) => w.bedrockElevationM[i] + w.looseSedimentThicknessM[i];
const volume = (w: WorldState) => {
  let v = 0;
  for (let i = 0; i < w.bedrockElevationM.length; i++) v += surf(w, i);
  return v * w.cellSizeM * w.cellSizeM;
};

describe('geological time: river deposition (ξ–q erosion–deposition model)', () => {
  it('steady state under uplift: river slope = (1 + G) × the detachment-limited slope U / (K A^m)', () => {
    for (const G of [0.5, 1]) {
      const w = strip(80, 3, 100);
      const geo = new LandscapeEvolution(w);
      const p = river({ kRef: 1e-3, upliftMmYr: 1, depositionG: G });
      for (let k = 0; k < 600; k++) geo.step(1000, p);
      geo.route();
      let worst = 0;
      let checked = 0;
      for (let x = 5; x < 75; x++) {
        const i = 80 + x;
        const r = geo.receiver[i];
        if (r < 0 || geo.area[i] < 30 * 100 * 100) continue; // the continuum limit: drainage area ≫ one cell
        const dist = Math.hypot((i % 80) - (r % 80), ((i / 80) | 0) - ((r / 80) | 0)) * 100;
        const S = (surf(w, i) - surf(w, r)) / dist;
        const expected = ((1 + G) * 1e-3) / (1e-3 * Math.sqrt(geo.area[i]));
        worst = Math.max(worst, Math.abs(S / expected - 1));
        checked++;
      }
      expect(checked).toBeGreaterThan(40);
      expect(worst, `G = ${G}`).toBeLessThan(0.05);
    }
  }, 60000);

  it('conserves rock + soil with deposition on (closed and open edges)', () => {
    for (const boundary of ['closed', 'open'] as const) {
      const w = generateWorld(defaultOptions('coastal-headland', 11, 64));
      w.water.boundary = boundary;
      const geo = new LandscapeEvolution(w);
      const v0 = volume(w);
      const tot = emptyGeoStats();
      for (let k = 0; k < 40; k++) addGeoStats(tot, geo.step(500, { ...defaultGeoParams(), kRef: 1e-4, upliftMmYr: 0.5, depositionG: 1 }));
      expect(tot.depositedRivers).toBeGreaterThan(0);
      const err = Math.abs(volume(w) - v0 - (tot.uplifted - tot.exported));
      expect(err / (tot.erodedRock + tot.erodedSoil + tot.weathered + tot.uplifted), boundary).toBeLessThan(2e-3);
    }
  });

  it('an alluvial fan builds where a mountain stream reaches a plain; none without deposition', () => {
    // A steep mountain block (east) above a gently sloping plain draining to an open west edge.
    const run = (G: number) => {
      const W = 90;
      const H = 61;
      const cs = 50;
      const w = createWorld({ width: W, height: H, cellSizeM: cs, seed: 3 });
      w.water.boundary = 'open';
      w.seaLevelM = -1000;
      const rnd = mulberry32(5);
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          const plain = 10 + x * cs * 0.004;
          const mtn = x >= 60 ? (x - 60) * cs * 0.25 : 0;
          w.bedrockElevationM[y * W + x] = plain + mtn + rnd() * 0.5;
        }
      w.materialId.fill(2);
      setUniformStrata(w);
      refreshAllExposed(w);
      const geo = new LandscapeEvolution(w);
      const p = { ...defaultGeoParams(), kRef: 2e-5, depositionG: G };
      for (let k = 0; k < 40; k++) geo.step(1000, p);
      // Mean loose sediment on the plain within 1 km of the mountain front, and 1.5–3 km out.
      const band = (x0: number, x1: number) => {
        let s = 0;
        let c = 0;
        for (let y = 5; y < H - 5; y++)
          for (let x = x0; x < x1; x++) {
            s += w.looseSedimentThicknessM[y * W + x];
            c++;
          }
        return s / c;
      };
      return { near: band(40, 60), far: band(0, 30), deposited: 0 };
    };
    const fan = run(1);
    const none = run(0);
    expect(fan.near).toBeGreaterThan(0.5); // a fan apron at the mountain foot
    expect(fan.near).toBeGreaterThan(2 * fan.far); // thinning away from the mountain
    expect(fan.near).toBeGreaterThan(5 * none.near); // without deposition the plain stays bare (soil only)
  }, 60000);
});
