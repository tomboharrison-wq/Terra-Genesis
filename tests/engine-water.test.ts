import { describe, expect, it } from 'vitest';
import { Engine } from '../src/engine/engine';
import { createWorld, MM_PER_H } from '../src/engine/world';
import { generateWorld, defaultOptions } from '../src/terrain/generate';
import { closureError } from '../src/sim/water/ledger';

function flat() {
  const w = createWorld({ width: 32, height: 32, cellSizeM: 10, seed: 1, seaLevelM: -100 });
  w.bedrockElevationM.fill(10);
  w.water.boundary = 'closed';
  return new Engine(w);
}

describe('Engine water integration (CPU backend)', () => {
  it('paused tick does not advance; playing tick advances sim time', () => {
    const e = flat();
    e.setWaterParams({ rainMPerS: 10 * MM_PER_H });
    expect(e.tick(0.1)).toBe(0);
    e.setSpeed(60);
    e.setPlaying(true);
    const done = e.tick(0.5);
    expect(done).toBeGreaterThan(0);
    expect(e.world.simTimeSeconds).toBeCloseTo(done);
    expect(e.water.storedVolume()).toBeGreaterThan(0);
  });

  it('advance() runs an exact amount of simulated time', () => {
    const e = flat();
    e.setWaterParams({ rainMPerS: 36 * MM_PER_H });
    const done = e.advance(600);
    expect(done).toBeGreaterThan(590);
    expect(done).toBeLessThanOrEqual(600);
    expect(e.water.ledger.rainIn).toBeCloseTo(1e-5 * done * 32 * 32 * 100, 3);
  });

  it('addWater / sources / clearWater are ledgered', () => {
    const e = flat();
    const v = e.addWater(160, 160, 50, 1);
    expect(v).toBeGreaterThan(0);
    const s = e.addSource(100, 100, 2);
    e.advance(100);
    expect(e.water.ledger.sourceIn).toBeGreaterThan(190);
    e.removeSource(s.id);
    expect(e.world.water.sources).toHaveLength(0);
    e.clearWater();
    expect(e.water.storedVolume()).toBe(0);
    expect(closureError(e.water.ledger, 0)).toBeLessThan(1e-6);
  });

  it('lowering terrain below sea level turns it into sea on the next tick (water ledgered)', () => {
    const e = flat();
    e.addWater(160, 160, 60, 0.5);
    e.beginStroke({ kind: 'lower', radiusM: 80, rate: 200, hardness: 1 }, 160, 160);
    e.strokeStep(160, 160, 1);
    e.endStroke();
    e.advance(1);
    expect(e.water.sea[16 * 32 + 16]).toBe(1);
    expect(e.water.ledger.seaOut).toBeGreaterThan(0);
    expect(closureError(e.water.ledger, e.water.storedVolume())).toBeLessThan(1e-5);
  });

  it('replacing the world resets clock and water sim', () => {
    const e = flat();
    e.setPlaying(true);
    e.replaceWorld(generateWorld(defaultOptions('island', 1, 32)));
    expect(e.clock.playing).toBe(false);
    expect(e.water.storedVolume()).toBe(0);
    expect(e.backend).toBe('cpu');
  });
});

describe('Engine erosion integration (CPU backend)', () => {
  it('playing with erosion changes terrain, marks it dirty, and the sediment ledger closes', async () => {
    const { sedimentClosure } = await import('../src/sim/sediment/sedimentSim');
    const w = createWorld({ width: 32, height: 32, cellSizeM: 10, seed: 1, seaLevelM: -100 });
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) w.bedrockElevationM[y * 32 + x] = x * 0.8;
    w.looseSedimentThicknessM.fill(0.5);
    const e = new Engine(w);
    e.setErosionParams({ enabled: true, speedup: 50 });
    e.addSource(290, 160, 5);
    const z0 = e.surface.slice();
    e.takeDirty();
    e.advance(1800);
    expect(e.takeDirty()).not.toBeNull();
    let changed = 0;
    for (let i = 0; i < z0.length; i++) if (Math.abs(e.surface[i] - z0[i]) > 1e-4) changed++;
    expect(changed).toBeGreaterThan(10);
    expect(sedimentClosure(e.sediment.ledger, e.sediment.suspendedVolume())).toBeLessThan(1e-4);
    // Reference snapshot for the change map follows setReference().
    e.setReference();
    expect(e.referenceSurface).toEqual(e.surface);
  });
});
