import { describe, expect, it } from 'vitest';
import { Engine } from '../src/engine/engine';
import { cloneWorld, MM_PER_H } from '../src/engine/world';
import { generateWorld, defaultOptions } from '../src/terrain/generate';

describe('M11-C04 performance: physics does not depend on frame rate', () => {
  it('the same real time at 60, 20 and uneven fps gives bit-identical water, ground and time', () => {
    const base = generateWorld(defaultOptions('river-basin', 11, 48));
    base.water.rainMPerS = 40 * MM_PER_H;
    base.erosion.enabled = true;
    const run = (frames: number[]) => {
      const e = new Engine(cloneWorld(base));
      e.clock.budgetMs = Infinity; // no frame-time cap: compare pure stepping
      e.clock.speed = 60;
      e.clock.playing = true;
      for (const dt of frames) e.tick(dt);
      e.syncWater();
      return e;
    };
    const a = run(Array(600).fill(1 / 60)); // 10 s at 60 fps
    const b = run(Array(200).fill(1 / 20)); // 10 s at 20 fps
    const uneven: number[] = [];
    for (let t = 0, k = 0; t < 10 - 1e-9; k++) {
      const dt = Math.min([0.007, 0.033, 0.05, 0.016][k % 4], 10 - t);
      uneven.push(dt);
      t += dt;
    }
    const c = run(uneven);
    for (const e of [b, c]) {
      expect(e.world.simTimeSeconds).toBeCloseTo(a.world.simTimeSeconds, 6);
      expect(Array.from(e.world.waterDepthM)).toEqual(Array.from(a.world.waterDepthM));
      expect(Array.from(e.surface)).toEqual(Array.from(a.surface));
    }
    expect(a.world.simTimeSeconds).toBeGreaterThan(590); // ~600 s simulated (≤ one step carried over)
  });
});
