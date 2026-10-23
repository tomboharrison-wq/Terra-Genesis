import { describe, expect, it } from 'vitest';
import { createWorld, setUniformStrata, type WorldState } from '../src/engine/world';
import { Engine, type VolcanoType } from '../src/engine/engine';
import { lavaClosure, tephraClosure, VOLCANIC_ID } from '../src/sim/lava/lavaSim';

const N = 160;
const CS = 30;

function flat(): WorldState {
  const w = createWorld({ width: N, height: N, cellSizeM: CS, seed: 1, seaLevelM: -1000 });
  w.bedrockElevationM.fill(100);
  setUniformStrata(w);
  return w;
}

/** Radial mean height above the old ground (m) in 1-cell bins around the vent. */
function profile(e: Engine): number[] {
  const sum = new Float64Array(N);
  const cnt = new Float64Array(N);
  const c = N / 2;
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const r = Math.round(Math.hypot(x - c, y - c));
      if (r >= N / 2) continue;
      sum[r] += e.surface[y * N + x] - 100;
      cnt[r]++;
    }
  return Array.from(sum, (s, r) => (cnt[r] ? s / cnt[r] : 0)).slice(0, N / 2);
}

/** Radius (m) where the profile first drops below a fraction of its peak, beyond the peak. */
function radiusAt(p: number[], frac: number): number {
  const peak = Math.max(...p);
  let r = p.indexOf(peak);
  while (r < p.length - 1 && p[r] > frac * peak) r++;
  return r * CS;
}

const deg = (slope: number) => (Math.atan(slope) * 180) / Math.PI;

function build(type: VolcanoType, episodes: number) {
  const e = new Engine(flat());
  const b = e.buildVolcano((N / 2) * CS, (N / 2) * CS, type, episodes);
  while (b.step());
  const p = profile(e);
  const peak = Math.max(...p);
  const r90 = radiusAt(p, 0.9);
  const r50 = radiusAt(p, 0.5);
  const r10 = radiusAt(p, 0.1);
  return {
    e,
    peak,
    upper: deg((0.4 * peak) / Math.max(CS, r50 - r90)),
    lower: deg((0.4 * peak) / Math.max(CS, r10 - r50)),
    mean: deg(peak / Math.max(CS, r10)),
    r10,
  };
}

describe('M08-C03 shield vs composite volcanoes', () => {
  it('repeated runny basalt eruptions build a broad, gentle shield', { timeout: 120000 }, () => {
    const s = build('shield', 6);
    expect(s.peak).toBeGreaterThan(5);
    expect(s.mean).toBeLessThan(8);
    expect(s.r10).toBeGreaterThan(450);
    expect(lavaClosure(s.e.lava)).toBeLessThan(1e-4);
    expect(s.e.world.materialId[(N / 2) * N + N / 2]).toBe(VOLCANIC_ID);
  });

  it('alternating sticky lava and explosive eruptions build a steep, concave composite cone', { timeout: 120000 }, () => {
    const c = build('composite', 6);
    expect(c.upper).toBeGreaterThan(15);
    expect(c.upper).toBeGreaterThan(c.lower); // concave up: steep top, gentle apron — not a straight-sided pyramid
    expect(lavaClosure(c.e.lava)).toBeLessThan(1e-4);
    expect(tephraClosure(c.e.lava)).toBeLessThan(1e-4);
  });

  it('the shield is wider and far gentler than a composite cone built the same way', { timeout: 120000 }, () => {
    const s = build('shield', 4);
    const c = build('composite', 4);
    expect(s.mean).toBeLessThan(c.mean / 4);
    expect(s.r10).toBeGreaterThan(2 * c.r10);
  });

  it('a build is one undoable edit', { timeout: 120000 }, () => {
    const e = new Engine(flat());
    const s0 = Array.from(e.surface);
    const b = e.buildVolcano(2400, 2400, 'composite', 2);
    while (b.step());
    expect(e.history.undoLabel).toBe('Build composite volcano');
    e.undo();
    expect(Array.from(e.surface)).toEqual(s0);
    expect(Math.max(...e.world.tephraM)).toBe(0);
  });
});
