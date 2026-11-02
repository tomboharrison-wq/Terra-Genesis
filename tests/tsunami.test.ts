import { describe, expect, it } from 'vitest';
import { computeSurface, createWorld } from '../src/engine/world';
import { TsunamiSim } from '../src/sim/events/tsunami';

function basin(width = 64, height = 16) {
  const w = createWorld({ width, height, cellSizeM: 10, seaLevelM: 0, seed: 1 });
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      w.bedrockElevationM[i] = x < 4 ? -50 : 1;
    }
  }
  const surface = new Float32Array(width * height);
  computeSurface(w, surface);
  return { w, surface };
}

describe('M15 travelling long-wave tsunami reference model', () => {
  it('propagates at the shallow-water speed and produces land run-up', () => {
    const { w, surface } = basin();
    const sim = new TsunamiSim(w, surface);
    sim.start({ amplitudeM: 4, sourceEdge: 'west', sourceWidthCells: 3, dampingPerS: 0.0001 });
    const initial = sim.volumeM3();
    const dt = sim.stableDt();
    for (let k = 0; k < Math.ceil(40 / dt); k++) sim.step(dt);
    expect(sim.volumeM3()).toBeGreaterThan(0);
    expect(sim.volumeM3()).toBeLessThan(initial * 1.05);
    expect(Math.max(...sim.eta)).toBeGreaterThan(0.1);
    // The wave reaches the shoreline and begins to wet the first land row.
    let runup = 0;
    for (let i = 0; i < surface.length; i++) runup = Math.max(runup, sim.runupDepth(i));
    expect(runup).toBeGreaterThan(0);
  });

  it('is deterministic and remains bounded under a long run', () => {
    const a = basin();
    const b = basin();
    const sa = new TsunamiSim(a.w, a.surface);
    const sb = new TsunamiSim(b.w, b.surface);
    const p = { amplitudeM: 3, sourceEdge: 'west' as const, sourceWidthCells: 2, dampingPerS: 0.0003 };
    sa.start(p);
    sb.start(p);
    const dt = sa.stableDt();
    for (let k = 0; k < Math.ceil(240 / dt); k++) {
      sa.step(dt);
      sb.step(dt);
    }
    expect(Array.from(sa.eta)).toEqual(Array.from(sb.eta));
    expect(Math.max(...sa.eta)).toBeLessThan(20);
    expect(Math.min(...sa.eta)).toBeGreaterThan(-60);
  });
});
