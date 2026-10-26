import { describe, expect, it } from 'vitest';
import { createWorld, computeSurface, validateWorld, MM_PER_H, type WorldState } from '../src/engine/world';
import { WaterSim } from '../src/sim/water/waterSim';
import { closureError } from '../src/sim/water/ledger';
import { SimClock } from '../src/engine/clock';
import { decodeWorld, encodeWorld } from '../src/persistence/format';

function world(size = 16, cs = 10, z = 5): { w: WorldState; s: Float32Array } {
  const w = createWorld({ width: size, height: size, cellSizeM: cs, seed: 1 });
  w.bedrockElevationM.fill(z);
  const s = new Float32Array(size * size);
  computeSurface(w, s);
  return { w, s };
}

describe('M02-C01 water forcing and ledger', () => {
  it('rain adds exactly R·T·N·A of water', () => {
    const { w, s } = world();
    w.water.rainMPerS = 36 * MM_PER_H; // 36 mm/h = 1e-5 m/s
    const sim = new WaterSim(w, s);
    for (let k = 0; k < 100; k++) sim.applyForcing(1);
    const expected = 1e-5 * 100 * 16 * 16 * 100;
    expect(sim.ledger.rainIn).toBeCloseTo(expected, 6);
    expect(sim.storedVolume()).toBeCloseTo(expected, 3);
    expect(closureError(sim.ledger, sim.storedVolume())).toBeLessThan(1e-5);
  });

  it('dry world with no forcing stays dry', () => {
    const { w, s } = world();
    const sim = new WaterSim(w, s);
    for (let k = 0; k < 50; k++) sim.step(sim.stableDt());
    expect(sim.storedVolume()).toBe(0);
    expect(validateWorld(w)).toEqual([]);
  });

  it('no rain on sea cells; sources into sea are ledgered as seaOut', () => {
    const { w, s } = world(8, 10, 5);
    for (let i = 0; i < 8; i++) {
      w.bedrockElevationM[i] = -10;
    }
    computeSurface(w, s);
    w.water.rainMPerS = 1e-4;
    w.water.sources.push({ id: 1, x: 0, y: 0, rateM3PerS: 2 });
    const sim = new WaterSim(w, s);
    sim.applyForcing(10);
    expect(w.waterDepthM[0]).toBe(0);
    expect(sim.ledger.rainIn).toBeCloseTo(1e-4 * 10 * 56 * 100, 6);
    expect(sim.ledger.seaOut).toBeCloseTo(20, 6);
    expect(closureError(sim.ledger, sim.storedVolume())).toBeLessThan(1e-6);
  });

  it('infiltration and evaporation remove water, never below zero, and are ledgered', () => {
    const { w, s } = world();
    w.waterDepthM.fill(0.01);
    w.water.infiltrationMPerS = 3e-4;
    w.water.evaporationMPerS = 1e-4;
    const sim = new WaterSim(w, s);
    for (let k = 0; k < 100; k++) sim.applyForcing(1);
    expect(sim.storedVolume()).toBe(0);
    expect(sim.ledger.infiltrated).toBeCloseTo(0.75 * 0.01 * 256 * 100, 4);
    expect(sim.ledger.evaporated).toBeCloseTo(0.25 * 0.01 * 256 * 100, 4);
    expect(closureError(sim.ledger, 0)).toBeLessThan(1e-5);
  });

  it('rain/drain tool moves water and is ledgered', () => {
    const { w, s } = world();
    const sim = new WaterSim(w, s);
    const added = sim.addWaterDisc(8, 8, 3, 0.5);
    expect(added).toBeGreaterThan(0);
    const removed = sim.addWaterDisc(8, 8, 3, -10);
    expect(removed).toBeCloseTo(-added, 3);
    expect(sim.storedVolume()).toBeCloseTo(0, 6);
    expect(closureError(sim.ledger, sim.storedVolume())).toBeLessThan(1e-6);
  });
});

describe('SimClock', () => {
  function run(frames: number, frameDt: number) {
    const { w, s } = world();
    w.water.rainMPerS = 1e-4;
    const sim = new WaterSim(w, s);
    const clock = new SimClock(1e9);
    clock.playing = true;
    clock.speed = 30;
    for (let k = 0; k < frames; k++) clock.tick(sim, frameDt, () => 0);
    return w.waterDepthM.slice();
  }
  it('same total time at different frame rates gives identical state', () => {
    expect(run(60, 1 / 60)).toEqual(run(15, 1 / 15));
  });
  it('paused clock does nothing', () => {
    const { w, s } = world();
    w.water.rainMPerS = 1e-4;
    const sim = new WaterSim(w, s);
    const clock = new SimClock();
    expect(clock.tick(sim, 1)).toBe(0);
    expect(sim.storedVolume()).toBe(0);
  });
  it('budget cap stops work and drops backlog', () => {
    const { w, s } = world();
    const sim = new WaterSim(w, s);
    const clock = new SimClock(5);
    clock.playing = true;
    clock.speed = 1e6;
    let t = 0;
    const done = clock.tick(sim, 1, () => (t += 1));
    expect(done).toBeGreaterThan(0);
    expect(clock.lastSteps).toBeLessThan(10);
  });
  it('slow real frames shrink the per-frame step cap (slow GPU stays responsive); quick frames grow it back', () => {
    const { w, s } = world();
    const sim = new WaterSim(w, s);
    const clock = new SimClock(1e9);
    clock.playing = true;
    clock.speed = 1e6;
    for (let k = 0; k < 12; k++) clock.tick(sim, 0.5, () => 0); // 2 fps
    expect(clock.stepCap).toBe(1);
    expect(clock.lastSteps).toBeLessThanOrEqual(1);
    for (let k = 0; k < 40; k++) clock.tick(sim, 1 / 60, () => 0);
    expect(clock.stepCap).toBe(clock.maxStepsPerFrame);
  });
});

describe('format v2 water + v1 migration', () => {
  it('round-trips water fields and params', () => {
    const { w } = world();
    w.waterDepthM[5] = 1.25;
    w.waterFluxM3PerS[21] = 0.5;
    w.water.rainMPerS = 2e-5;
    w.water.boundary = 'closed';
    w.water.sources.push({ id: 3, x: 2, y: 4, rateM3PerS: 7 });
    const back = decodeWorld(encodeWorld(w)).world;
    expect(back.waterDepthM).toEqual(w.waterDepthM);
    expect(back.waterFluxM3PerS).toEqual(w.waterFluxM3PerS);
    expect(back.water).toEqual(w.water);
  });

  it('loads a v1 file (no water fields) as dry with default params', () => {
    const { w } = world(4);
    const n = 16;
    const fields = [
      { name: 'bedrockElevationM', type: 'f32', offset: 0, byteLength: n * 4 },
      { name: 'looseSedimentThicknessM', type: 'f32', offset: n * 4, byteLength: n * 4 },
      { name: 'materialId', type: 'u8', offset: n * 8, byteLength: n },
    ];
    const header = { app: 'terra-genesis', formatVersion: 1, endianness: 'LE', width: 4, height: 4, cellSizeM: 10, seaLevelM: 0, seed: 1, simTimeSeconds: 0, meta: w.meta, fields };
    const hb = new TextEncoder().encode(JSON.stringify(header));
    const start = (8 + hb.length + 3) & ~3;
    const bytes = new Uint8Array(start + n * 9 + 4);
    bytes.set(new TextEncoder().encode('TGW1'));
    new DataView(bytes.buffer).setUint32(4, hb.length, true);
    bytes.set(hb, 8);
    bytes.set(new Uint8Array(w.bedrockElevationM.buffer), start);
    const back = decodeWorld(bytes).world;
    expect(back.bedrockElevationM).toEqual(w.bedrockElevationM);
    expect(back.waterDepthM.length).toBe(n);
    expect(back.waterFluxM3PerS.length).toBe(n * 4);
    expect(back.water.boundary).toBe('open');
    expect(validateWorld(back)).toEqual([]);
  });
});
