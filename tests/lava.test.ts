import { describe, expect, it } from 'vitest';
import { createWorld, setUniformStrata, validateWorld, type WorldState } from '../src/engine/world';
import { Engine } from '../src/engine/engine';
import { lavaClosure, LAVA_KINDS, VOLCANIC_ID } from '../src/sim/lava/lavaSim';
import { decodeWorld, encodeWorld } from '../src/persistence/format';

/** n × n world of 10 m cells, ground z(x, y), granite. */
function world(n: number, z: (x: number, y: number) => number): WorldState {
  const w = createWorld({ width: n, height: n, cellSizeM: 10, seed: 1, seaLevelM: -1000 });
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) w.bedrockElevationM[y * n + x] = z(x, y);
  w.materialId.fill(0);
  setUniformStrata(w);
  return w;
}

const lavaVolume = (w: WorldState, x0: number, x1: number) => {
  let v = 0;
  for (let y = 0; y < w.height; y++) for (let x = x0; x < x1; x++) v += w.lavaDepthM[y * w.width + x];
  return v * w.cellSizeM * w.cellSizeM;
};

describe('M08-C01 lava flows', () => {
  it('lava runs downhill and pools in a hollow', () => {
    // Slope falling 10 % to the east, with a 6 m deep hollow at x = 28 … 33.
    const e = new Engine(world(48, (x, y) => 200 - x - (x >= 28 && x <= 33 && y >= 20 && y <= 27 ? 6 : 0)));
    e.addVent(80, 235, 20, 'basalt', 1800);
    e.advance(1800);
    const w = e.world;
    expect(lavaVolume(w, 0, 8)).toBeLessThan(lavaVolume(w, 9, 48)); // mostly downhill of the vent
    let pit = 0;
    let beside = 0;
    for (let y = 20; y <= 27; y++) {
      pit = Math.max(pit, w.lavaDepthM[y * 48 + 30]);
      beside = Math.max(beside, w.lavaDepthM[y * 48 + 26]);
    }
    expect(pit).toBeGreaterThan(1); // the hollow fills
    expect(pit).toBeGreaterThan(beside);
    expect(lavaClosure(e.lava)).toBeLessThan(1e-4);
  });

  it('sticky andesite stays put on a gentle slope where runny basalt flows (yield strength)', () => {
    // A 3 m slab across the whole map width (no side edges) at eruption temperature.
    const run = (kind: 'basalt' | 'andesite', slope: number) => {
      const e = new Engine(world(40, (x) => 300 - slope * 10 * x));
      const w = e.world;
      for (let y = 0; y < 40; y++)
        for (let x = 5; x < 10; x++) {
          const i = y * 40 + x;
          w.lavaDepthM[i] = 3;
          w.lavaTempC[i] = LAVA_KINDS[kind].eruptC;
          w.lavaKind[i] = kind === 'basalt' ? 0 : 1;
        }
      e.lava.refresh();
      e.lava.ledger.erupted = e.lava.flowingVolume();
      e.advance(600);
      return 1 - lavaVolume(w, 5, 10) / (200 * 3 * 100); // share that left the slab
    };
    expect(run('basalt', 0.03)).toBeGreaterThan(0.2);
    expect(run('andesite', 0.03)).toBe(0); // 3 m < critical thickness ≈ 70 m on 3 %
    expect(run('andesite', 1)).toBeGreaterThan(0); // on 45° the critical thickness ≈ 2.9 m: it creeps
  });

  it('a flow cools, stops and becomes volcanic rock; volume ledger closes', () => {
    const e = new Engine(world(40, (x) => 100 - 0.5 * x));
    const w = e.world;
    w.looseSedimentThicknessM.fill(0.5);
    e.surface.forEach((_, i) => (e.surface[i] = w.bedrockElevationM[i] + 0.5));
    const b0 = Float64Array.from(w.bedrockElevationM, (b, i) => b + w.looseSedimentThicknessM[i]);
    e.addVent(50, 200, 5, 'basalt', 1200);
    e.advance(1200);
    expect(e.lava.maxTemp()!).toBeGreaterThan(LAVA_KINDS.basalt.solidC);
    e.advance(3 * 86400);
    expect(e.lava.active).toBe(false);
    expect(e.lava.flowingVolume()).toBe(0);
    let added = 0;
    let volcanic = 0;
    for (let i = 0; i < 1600; i++) {
      added += w.bedrockElevationM[i] + w.looseSedimentThicknessM[i] - b0[i];
      if (w.materialId[i] === VOLCANIC_ID) volcanic++;
    }
    expect(added * 100).toBeCloseTo(6000, -1); // 5 m³/s × 1200 s became rock (ground surface rose by it)
    expect(volcanic).toBeGreaterThan(3);
    expect(lavaClosure(e.lava)).toBeLessThan(1e-4);
    expect(validateWorld(w)).toEqual([]);
  });

  it('thin lava cools faster than thick lava', () => {
    const cool = (h: number) => {
      // A uniform sheet over the whole (flat) map: no flow, cooling only.
      const e = new Engine(world(10, () => 0));
      const i = 55;
      e.world.lavaDepthM.fill(h);
      e.world.lavaTempC.fill(1150);
      e.lava.refresh();
      e.advance(600);
      return 1150 - e.world.lavaTempC[i];
    };
    expect(cool(0.5)).toBeGreaterThan(3 * cool(5));
  });

  it('lava and vents survive save / load', () => {
    const e = new Engine(world(30, (x) => 100 - x));
    e.addVent(100, 150, 10, 'andesite', 3600);
    e.advance(300);
    const { world: w2 } = decodeWorld(encodeWorld(e.world));
    expect(Array.from(w2.lavaDepthM)).toEqual(Array.from(e.world.lavaDepthM));
    expect(Array.from(w2.lavaTempC)).toEqual(Array.from(e.world.lavaTempC));
    expect(w2.lava.vents).toEqual(e.world.lava.vents);
    expect(w2.lavaKind[15 * 30 + 10]).toBe(1);
  });
});
