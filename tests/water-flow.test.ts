import { describe, expect, it } from 'vitest';
import { createWorld, computeSurface, validateWorld, MM_PER_H } from '../src/engine/world';
import { WaterSim } from '../src/sim/water/waterSim';
import { closureError } from '../src/sim/water/ledger';
import { generateWorld, defaultOptions } from '../src/terrain/generate';

function mk(size: number, cs: number, zf: (x: number, y: number) => number, boundary: 'open' | 'closed' = 'closed', sea = -1e6) {
  const w = createWorld({ width: size, height: size, cellSizeM: cs, seed: 1, seaLevelM: sea });
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) w.bedrockElevationM[y * size + x] = zf(x, y);
  w.water.boundary = boundary;
  const s = new Float32Array(size * size);
  computeSurface(w, s);
  return { w, s, sim: new WaterSim(w, s) };
}

function runFor(sim: WaterSim, seconds: number) {
  let t = 0;
  while (t < seconds) {
    const dt = sim.stableDt();
    sim.step(dt);
    t += dt;
  }
}

function centroidX(w: ReturnType<typeof mk>['w']) {
  let m = 0;
  let mx = 0;
  for (let y = 0; y < w.height; y++)
    for (let x = 0; x < w.width; x++) {
      const d = w.waterDepthM[y * w.width + x];
      m += d;
      mx += d * x;
    }
  return mx / m;
}

describe('M02-C02 pipe-model routing', () => {
  it('water on an inclined plane moves downhill (toward low x)', () => {
    const { w, sim } = mk(32, 10, (x) => x * 1.0); // 10% slope rising east
    for (let y = 10; y < 22; y++) for (let x = 22; x < 28; x++) w.waterDepthM[y * 32 + x] = 0.5;
    sim.resetLedger();
    const c0 = centroidX(w);
    runFor(sim, 120);
    expect(centroidX(w)).toBeLessThan(c0 - 5);
    expect(closureError(sim.ledger, sim.storedVolume())).toBeLessThan(1e-4);
  });

  it('open boundary lets water leave at the low edge; ledger closes', () => {
    const { w, sim } = mk(32, 10, (x) => x * 1.0, 'open');
    w.water.sources.push({ id: 1, x: 28, y: 16, rateM3PerS: 2 });
    runFor(sim, 1800);
    expect(sim.ledger.edgeOut).toBeGreaterThan(0.5 * sim.ledger.sourceIn);
    expect(closureError(sim.ledger, sim.storedVolume())).toBeLessThan(1e-4);
  });

  it('closed bowl fills and settles to a level surface', () => {
    const N = 33;
    const { w, s, sim } = mk(N, 10, (x, y) => 0.02 * ((x - 16) ** 2 + (y - 16) ** 2));
    w.water.rainMPerS = 200 * MM_PER_H;
    runFor(sim, 1800);
    w.water.rainMPerS = 0;
    runFor(sim, 3600);
    const heads: number[] = [];
    for (let i = 0; i < N * N; i++) if (w.waterDepthM[i] > 0.02) heads.push(s[i] + w.waterDepthM[i]);
    const mean = heads.reduce((a, b) => a + b, 0) / heads.length;
    const maxDev = Math.max(...heads.map((h) => Math.abs(h - mean)));
    expect(heads.length).toBeGreaterThan(50);
    expect(maxDev).toBeLessThan(0.02);
    expect(sim.maxSpeed).toBeLessThan(0.02);
    expect(closureError(sim.ledger, sim.storedVolume())).toBeLessThan(1e-4);
  });

  it('a still lake over a bumpy bed stays still (no spurious oscillation)', () => {
    const N = 24;
    const { w, s, sim } = mk(N, 10, (x, y) => Math.sin(x * 0.7) * Math.cos(y * 0.5));
    for (let i = 0; i < N * N; i++) w.waterDepthM[i] = 5 - s[i];
    runFor(sim, 600);
    let maxDev = 0;
    for (let i = 0; i < N * N; i++) maxDev = Math.max(maxDev, Math.abs(s[i] + w.waterDepthM[i] - 5));
    expect(maxDev).toBeLessThan(1e-3);
    expect(sim.maxSpeed).toBeLessThan(1e-3);
  });

  it('depression fills to its saddle and spills into the next basin', () => {
    // Two basins along x separated by a saddle at x=16 (height 3 m); rims at 8 m elsewhere.
    const N = 33;
    const { w, s, sim } = mk(N, 10, (x, y) => {
      const rim = y === 0 || y === N - 1 || x === 0 || x === N - 1 ? 8 : 0;
      const saddle = x === 16 ? (y === 16 ? 3 : 8) : 0;
      return Math.max(rim, saddle, 0.002 * (y - 16) ** 2);
    });
    w.water.sources.push({ id: 1, x: 8, y: 16, rateM3PerS: 20 });
    runFor(sim, 3 * 3600);
    const left = s[16 * N + 8] + w.waterDepthM[16 * N + 8];
    let right = 0;
    for (let x = 18; x < N - 1; x++) right += w.waterDepthM[16 * N + x];
    expect(left).toBeGreaterThan(2.9); // filled to the spill point
    expect(left).toBeLessThan(3.6); // and not far above it
    expect(right).toBeGreaterThan(0.1); // overflowed into the second basin
    expect(closureError(sim.ledger, sim.storedVolume())).toBeLessThan(1e-4);
  });

  it('symmetric bowl with central source stays symmetric (no grid-direction bias)', () => {
    const N = 31;
    const { w, sim } = mk(N, 10, (x, y) => 0.01 * ((x - 15) ** 2 + (y - 15) ** 2));
    w.water.sources.push({ id: 1, x: 15, y: 15, rateM3PerS: 5 });
    runFor(sim, 600);
    let asym = 0;
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) asym = Math.max(asym, Math.abs(w.waterDepthM[y * N + x] - w.waterDepthM[x * N + (N - 1 - y)]));
    expect(asym).toBeLessThan(0.05 * sim.maxDepth);
  });

  it('long rainstorm on generated terrain: finite, non-negative, ledger closes, water reaches sea', () => {
    const w = generateWorld(defaultOptions('island', 5, 64));
    w.water.rainMPerS = 100 * MM_PER_H;
    const s = new Float32Array(64 * 64);
    computeSurface(w, s);
    const sim = new WaterSim(w, s);
    runFor(sim, 4 * 3600);
    expect(validateWorld(w)).toEqual([]);
    expect(sim.ledger.seaOut).toBeGreaterThan(0);
    expect(closureError(sim.ledger, sim.storedVolume())).toBeLessThan(1e-4);
  });
});
