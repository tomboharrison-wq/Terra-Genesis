import { describe, expect, it } from 'vitest';
import { createWorld, setUniformStrata, refreshAllExposed, type WorldState } from '../src/engine/world';
import { LandscapeEvolution, defaultGeoParams, emptyGeoStats, addGeoStats, type GeoParams } from '../src/sim/geology/landscapeEvolution';
import { generateWorld, defaultOptions } from '../src/terrain/generate';
import { mulberry32 } from '../src/utils/rng';

/** A strip draining west into a sea column at x = 0 (closed edges elsewhere). */
function strip(W: number, H: number, cs: number, rock: number): WorldState {
  const w = createWorld({ width: W, height: H, cellSizeM: cs, seed: 1 });
  w.water.boundary = 'closed';
  w.seaLevelM = 0;
  const rnd = mulberry32(7);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) w.bedrockElevationM[y * W + x] = x === 0 ? -1e5 : 1 + x * 0.05 * cs * 0.01 + rnd() * 0.01; // a deep sea that never fills
  w.materialId.fill(rock);
  setUniformStrata(w);
  refreshAllExposed(w);
  return w;
}

const pureRiver = (o: Partial<GeoParams> = {}): GeoParams => ({ ...defaultGeoParams(), diffusivity: 0, soilProduction: 0, slopeFailure: false, ...o });
const volume = (w: WorldState) => {
  let v = 0;
  for (let i = 0; i < w.bedrockElevationM.length; i++) v += w.bedrockElevationM[i] + w.looseSedimentThicknessM[i];
  return v * w.cellSizeM * w.cellSizeM;
};

describe('geological time: landscape evolution model', () => {
  it('reaches the analytic stream-power steady state S = U / (K A^m) (n = 1) under uniform uplift', () => {
    const w = strip(80, 3, 100, 2); // weak sedimentary, erodibility 1
    const geo = new LandscapeEvolution(w);
    const p = pureRiver({ kRef: 1e-3, upliftMmYr: 1 });
    for (let k = 0; k < 400; k++) geo.step(1000, p);
    geo.route();
    let worst = 0;
    let checked = 0;
    for (let x = 5; x < 75; x++) {
      const i = 1 * 80 + x;
      const r = geo.receiver[i];
      if (r < 0) continue;
      const z = (j: number) => w.bedrockElevationM[j] + w.looseSedimentThicknessM[j];
      const dist = Math.hypot((i % 80) - (r % 80), ((i / 80) | 0) - ((r / 80) | 0)) * 100;
      const S = (z(i) - z(r)) / dist;
      const expected = 1e-3 / (1e-3 * Math.sqrt(geo.area[i]));
      worst = Math.max(worst, Math.abs(S / expected - 1));
      checked++;
    }
    expect(checked).toBeGreaterThan(50);
    expect(worst).toBeLessThan(0.02);
  });

  it('harder rock holds a steeper river at steady state (S ∝ 1/K): granite ≈ 10× the relief of mudstone', () => {
    const relief = (rock: number) => {
      const w = strip(60, 3, 100, rock);
      const geo = new LandscapeEvolution(w);
      for (let k = 0; k < 600; k++) geo.step(2000, pureRiver({ kRef: 1e-3, upliftMmYr: 1 }));
      return Math.max(...w.bedrockElevationM);
    };
    const ratio = relief(0) / relief(2); // granite erodibility 0.1, mudstone 1.0
    expect(ratio).toBeGreaterThan(9);
    expect(ratio).toBeLessThan(11);
  });

  it('is unconditionally stable: one 1-million-year step never cuts a cell below the cell it drains to', () => {
    const w = generateWorld(defaultOptions('river-basin', 5, 64));
    const geo = new LandscapeEvolution(w);
    geo.route();
    const rec = geo.receiver.slice();
    geo.step(1e6, pureRiver({ kRef: 1e-3 }));
    const z = (j: number) => w.bedrockElevationM[j] + w.looseSedimentThicknessM[j];
    let below = 0;
    for (let i = 0; i < rec.length; i++) if (rec[i] >= 0 && z(i) < z(rec[i]) - 1e-3 && w.looseSedimentThicknessM[i] === 0) below++;
    expect(below).toBe(0);
    for (const v of w.bedrockElevationM) expect(Number.isFinite(v)).toBe(true);
  });

  it('conserves rock + soil: change = uplift − sediment leaving the map (closed and open edges)', () => {
    for (const boundary of ['closed', 'open'] as const) {
      const w = generateWorld(defaultOptions('coastal-headland', 11, 64));
      w.water.boundary = boundary;
      const geo = new LandscapeEvolution(w);
      const v0 = volume(w);
      const tot = emptyGeoStats();
      for (let k = 0; k < 40; k++) addGeoStats(tot, geo.step(500, { ...defaultGeoParams(), kRef: 1e-4, upliftMmYr: 0.5 }));
      const moved = tot.erodedRock + tot.erodedSoil + tot.weathered + tot.uplifted;
      const err = Math.abs(volume(w) - v0 - (tot.uplifted - tot.exported));
      expect(moved).toBeGreaterThan(0);
      expect(err / moved, boundary).toBeLessThan(2e-3);
      if (boundary === 'closed') expect(tot.exported).toBe(0);
      expect(tot.depositedLakes + tot.depositedSea + tot.exported).toBeCloseTo(tot.erodedRock + tot.erodedSoil, -1);
    }
  });

  it('fills a closed hollow with sediment no higher than its spill point (lake infill)', () => {
    const W = 41;
    const w = createWorld({ width: W, height: W, cellSizeM: 50, seed: 2 });
    w.water.boundary = 'open';
    w.seaLevelM = -1000;
    // A bowl (floor 150 m) inside a rim at r = 15 (225 m); outside the rim the ground falls to the open edges.
    const zOf = (r: number) => (r <= 15 ? 150 + 5 * r : 225 - 8 * (r - 15));
    for (let y = 0; y < W; y++)
      for (let x = 0; x < W; x++) {
        const r = Math.hypot(x - 20, y - 20);
        w.bedrockElevationM[y * W + x] = zOf(r);
        w.materialId[y * W + x] = r < 12 ? 3 : 0; // clay slopes inside a granite rim
      }
    setUniformStrata(w);
    refreshAllExposed(w);
    const geo = new LandscapeEvolution(w);
    geo.route();
    let spill = -Infinity;
    for (let i = 0; i < W * W; i++) if (geo.lake[i] > w.bedrockElevationM[i]) spill = Math.max(spill, geo.lake[i]);
    expect(spill).toBeGreaterThan(200);
    let lakes = 0;
    for (let k = 0; k < 40; k++) lakes += geo.step(1000, pureRiver({ kRef: 5e-5 })).depositedLakes;
    geo.route();
    let spillNow = -Infinity;
    for (let i = 0; i < W * W; i++) if (geo.lake[i] > w.bedrockElevationM[i] + w.looseSedimentThicknessM[i]) spillNow = Math.max(spillNow, geo.lake[i]);
    expect(spillNow).toBeGreaterThan(200); // rim not yet breached
    expect(lakes).toBeGreaterThan(0);
    // Rivers entering the lake drop their load where they meet the water (lake-head deltas), inside the rim.
    let inside = 0;
    for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) if (w.looseSedimentThicknessM[y * W + x] > 0.01 && Math.hypot(x - 20, y - 20) < 15) inside++;
    expect(inside).toBeGreaterThan(0);
    for (let i = 0; i < W * W; i++) if (w.looseSedimentThicknessM[i] > 0) expect(w.bedrockElevationM[i] + w.looseSedimentThicknessM[i]).toBeLessThanOrEqual(spill + 1e-3);
  });

  it('soil creep rounds hilltops but never moves more soil than a cell has (bare rock cliffs stay)', () => {
    const w = strip(40, 3, 30, 0);
    for (let i = 0; i < w.bedrockElevationM.length; i++) if (i % 40 >= 20) w.bedrockElevationM[i] += 30; // a 30 m granite step (below its 52° limit)
    for (let i = 0; i < w.looseSedimentThicknessM.length; i++) w.looseSedimentThicknessM[i] = i % 40 < 30 ? 0 : 1;
    const geo = new LandscapeEvolution(w);
    for (let k = 0; k < 20; k++) geo.step(1000, { ...pureRiver(), kRef: 0, diffusivity: 0.05 });
    for (const s of w.looseSedimentThicknessM) expect(s).toBeGreaterThanOrEqual(0);
    // The bare cliff at x = 20 is still there.
    expect(w.bedrockElevationM[40 + 20] - w.bedrockElevationM[40 + 19]).toBeGreaterThan(29);
  });

  it('over-steep valley sides fail to the critical angle (V-shaped valleys, not canyons); weak rock fails to a gentler slope', () => {
    const wall = (rock: number) => {
      const w = strip(40, 3, 30, rock);
      for (let i = 0; i < w.bedrockElevationM.length; i++) if (i % 40 >= 20) w.bedrockElevationM[i] += 300; // a 300 m vertical wall
      const geo = new LandscapeEvolution(w);
      const v0 = volume(w);
      let failed = 0;
      for (let k = 0; k < 60; k++) failed += geo.step(10, { ...pureRiver(), kRef: 0, slopeFailure: true }).failed;
      let steepest = 0;
      for (let x = 2; x < 39; x++) steepest = Math.max(steepest, (w.bedrockElevationM[40 + x + 1] + w.looseSedimentThicknessM[40 + x + 1] - w.bedrockElevationM[40 + x] - w.looseSedimentThicknessM[40 + x]) / 30);
      expect(failed).toBeGreaterThan(0);
      expect(Math.abs(volume(w) - v0) / (failed + 1)).toBeLessThan(1e-4); // mass conserved
      return (Math.atan(steepest) * 180) / Math.PI;
    };
    const granite = wall(0);
    const mud = wall(2);
    expect(granite).toBeLessThan(60);
    expect(mud).toBeLessThan(granite);
    expect(mud).toBeLessThan(40);
  });

  it('runs a 256² world step fast enough for thousands of years per second', () => {
    const w = generateWorld(defaultOptions('river-basin', 20261022, 256));
    const geo = new LandscapeEvolution(w);
    geo.step(200, defaultGeoParams());
    const t0 = performance.now();
    for (let k = 0; k < 5; k++) geo.step(200, defaultGeoParams());
    const ms = (performance.now() - t0) / 5;
    expect(ms).toBeLessThan(250);
  });
});
