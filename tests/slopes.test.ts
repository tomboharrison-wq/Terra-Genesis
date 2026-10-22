import { describe, expect, it } from 'vitest';
import { createWorld, computeSurface, setUniformStrata, validateWorld } from '../src/engine/world';
import { WaterSim } from '../src/sim/water/waterSim';
import { SedimentSim, TAN_LOOSE } from '../src/sim/sediment/sedimentSim';

function setup(N: number, cs: number, zf: (x: number, y: number) => number, mat = 2) {
  const w = createWorld({ width: N, height: N, cellSizeM: cs, seed: 1, seaLevelM: -1e6 });
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) w.bedrockElevationM[y * N + x] = zf(x, y);
  w.materialId.fill(mat);
  setUniformStrata(w);
  w.erosion.enabled = true;
  w.water.boundary = 'closed';
  const s = new Float32Array(N * N);
  computeSurface(w, s);
  const water = new WaterSim(w, s);
  const sed = new SedimentSim(w, s, water);
  const run = (seconds: number) => {
    let t = 0;
    while (t < seconds) {
      const dt = water.stableDt();
      water.step(dt);
      sed.step(dt);
      t += dt;
    }
  };
  return { w, s, water, sed, run };
}

const solids = (w: ReturnType<typeof setup>['w']) => {
  let v = 0;
  for (let i = 0; i < w.bedrockElevationM.length; i++) v += w.bedrockElevationM[i] + w.looseSedimentThicknessM[i] + w.sedimentSuspendedM[i];
  return v;
};

/** Steepest surface drop to a 4-neighbour anywhere (m per cell). */
function maxDrop(s: Float32Array, N: number) {
  let m = 0;
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N - 1; x++) m = Math.max(m, Math.abs(s[y * N + x] - s[y * N + x + 1]));
  for (let y = 0; y < N - 1; y++) for (let x = 0; x < N; x++) m = Math.max(m, Math.abs(s[y * N + x] - s[(y + 1) * N + x]));
  return m;
}

describe('M04-C02 weathering', () => {
  it('bare rock produces regolith, soil cover slows it, weak rock weathers faster; solids conserved', () => {
    const mk = (mat: number, soil: number) => {
      const r = setup(8, 10, () => 100, mat);
      r.w.erosion.slopeFailure = false;
      r.w.looseSedimentThicknessM.fill(soil);
      computeSurface(r.w, r.s);
      const v0 = solids(r.w);
      r.run(3600);
      expect(Math.abs(solids(r.w) - v0)).toBeLessThan(1e-3);
      return r.sed.ledger.weathered;
    };
    const bareWeak = mk(2, 0);
    const coveredWeak = mk(2, 1);
    const bareHard = mk(0, 0);
    expect(bareWeak).toBeGreaterThan(0);
    expect(coveredWeak).toBeLessThan(bareWeak * 0.2); // exp(−1/0.5) ≈ 0.135
    expect(bareHard).toBeLessThan(bareWeak * 0.2); // granite erodibility 0.1 vs 1.0
  });
});

describe('M04-C03 slope failure', () => {
  it('a steep loose pile avalanches toward the angle of repose, conserving mass', () => {
    const N = 31;
    const r = setup(N, 2, () => 0);
    r.w.erosion.weatherK = 0;
    // 10 m-high sand cone, 45°+ flanks
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) r.w.looseSedimentThicknessM[y * N + x] = Math.max(0, 10 - 1.5 * Math.hypot(x - 15, y - 15) * 2);
    computeSurface(r.w, r.s);
    const v0 = solids(r.w);
    const d0 = maxDrop(r.s, N);
    r.run(600);
    expect(Math.abs(solids(r.w) - v0)).toBeLessThan(1e-3);
    expect(d0).toBeGreaterThan(2 * TAN_LOOSE * 1.5);
    expect(maxDrop(r.s, N)).toBeLessThan(2 * TAN_LOOSE * 1.1);
    expect(validateWorld(r.w)).toEqual([]);
  });

  it('weak clay cliffs collapse to rubble; granite cliffs of the same height stand', () => {
    const cliff = (mat: number) => {
      const r = setup(24, 5, (x) => (x >= 12 ? 20 : 0), mat); // 20 m vertical step over one 5 m cell
      r.w.erosion.weatherK = 0;
      r.run(300);
      return { fall: r.sed.ledger.rockfall, drop: maxDrop(r.s, 24) };
    };
    const clay = cliff(3);
    const granite = cliff(0);
    expect(clay.fall).toBeGreaterThan(100);
    expect(clay.drop).toBeLessThan(10);
    // tan 80° · 5 m = 28 m > 20 m: granite is stable.
    expect(granite.fall).toBe(0);
  });

  it('saturation lowers the stable angle: a wet pile ends flatter than a dry one', () => {
    const pile = (wet: boolean) => {
      const N = 31;
      const r = setup(N, 2, () => 0);
      r.w.erosion.weatherK = 0;
      for (let y = 0; y < N; y++)
        for (let x = 0; x < N; x++) r.w.looseSedimentThicknessM[y * N + x] = Math.max(0, 8 - 1.2 * Math.hypot(x - 15, y - 15));
      computeSurface(r.w, r.s);
      if (wet) r.w.water.rainMPerS = 2e-4;
      r.run(900);
      return maxDrop(r.s, N);
    };
    expect(pile(true)).toBeLessThan(pile(false) * 0.95);
  });
});

describe('M04-C03 landslide event', () => {
  it('saturating a dry-stable slope makes it fail downhill; solids conserved; undo restores exactly', async () => {
    const { Engine } = await import('../src/engine/engine');
    const N = 40;
    const w = createWorld({ width: N, height: N, cellSizeM: 5, seed: 1, seaLevelM: -1e6 });
    // 28° hillside (stable dry for loose sediment at 33°) of mudstone with 2 m of soil
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) w.bedrockElevationM[y * N + x] = x * 5 * Math.tan((28 * Math.PI) / 180);
    w.looseSedimentThicknessM.fill(2);
    w.materialId.fill(2);
    setUniformStrata(w);
    const e = new Engine(w);
    const v0 = solids(w);
    const before = e.surface.slice();
    const r = e.landslide(100, 100, 40);
    expect(r.movedM3).toBeGreaterThan(50);
    expect(Math.abs(solids(w) - v0) / v0).toBeLessThan(1e-6);
    // Upslope part of the zone lowered, downslope (lower x) gained debris.
    let lost = 0;
    let gained = 0;
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        const d = e.surface[y * N + x] - before[y * N + x];
        if (d < 0) lost -= d;
        else gained += d;
      }
    expect(lost).toBeGreaterThan(1);
    expect(Math.abs(lost - gained) / lost).toBeLessThan(1e-3);
    e.undo();
    expect(e.surface).toEqual(before);
  });

  it('gentle ground stays put even when saturated', async () => {
    const { Engine } = await import('../src/engine/engine');
    const w = createWorld({ width: 30, height: 30, cellSizeM: 10, seed: 1 });
    for (let y = 0; y < 30; y++) for (let x = 0; x < 30; x++) w.bedrockElevationM[y * 30 + x] = x * 0.5;
    w.looseSedimentThicknessM.fill(1);
    setUniformStrata(w);
    const e = new Engine(w);
    const r = e.landslide(150, 150, 60);
    expect(r.movedM3 + r.failedRockM3).toBe(0);
    expect(e.history.canUndo).toBe(false);
  });
});
