import { describe, expect, it } from 'vitest';
import { fillDepressions } from '../src/terrain/conditioning';
import { generateWorld, defaultOptions } from '../src/terrain/generate';
import { computeSurface } from '../src/engine/world';

/** Every cell must reach an outlet by a non-ascending 8-neighbour path. */
function allDrain(z: Float32Array, W: number, H: number, isOutlet: (i: number) => boolean) {
  const reach = new Uint8Array(W * H);
  const stack: number[] = [];
  for (let i = 0; i < W * H; i++) {
    const x = i % W;
    const y = (i / W) | 0;
    if (x === 0 || y === 0 || x === W - 1 || y === H - 1 || isOutlet(i)) {
      reach[i] = 1;
      stack.push(i);
    }
  }
  while (stack.length) {
    const c = stack.pop()!;
    const cx = c % W;
    const cy = (c / W) | 0;
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const j = ny * W + nx;
        if (!reach[j] && z[j] >= z[c]) {
          reach[j] = 1;
          stack.push(j);
        }
      }
  }
  return reach.every((r) => r === 1);
}

describe('priority-flood drainage conditioning', () => {
  it('fills a pit to its spill level and leaves drained terrain untouched', () => {
    const W = 7;
    const z = new Float32Array(W * W).fill(10);
    z[3 * W + 3] = 2; // pit
    z[0 * W + 3] = 5; // outlet notch on the border
    const f = fillDepressions(z, W, W, 0.01);
    expect(f[3 * W + 3]).toBeGreaterThanOrEqual(10);
    expect(f[0]).toBe(10);
    expect(allDrain(f, W, W, () => false)).toBe(true);
  });

  it('never lowers terrain', () => {
    const W = 32;
    const z = new Float32Array(W * W).map((_, i) => Math.sin(i * 0.37) * 5 + Math.cos(i * 0.11) * 3);
    const f = fillDepressions(z, W, W, 0.001);
    for (let i = 0; i < z.length; i++) expect(f[i]).toBeGreaterThanOrEqual(z[i]);
    expect(allDrain(f, W, W, () => false)).toBe(true);
  });

  it('generated presets drain everywhere; filled volume is loose sediment', () => {
    for (const id of ['river-basin', 'island', 'mountain-range'] as const) {
      const raw = generateWorld({ ...defaultOptions(id, 9, 96), drainage: false });
      const w = generateWorld(defaultOptions(id, 9, 96));
      expect(w.bedrockElevationM).toEqual(raw.bedrockElevationM);
      const s = new Float32Array(96 * 96);
      computeSurface(w, s);
      expect(allDrain(s, 96, 96, (i) => s[i] < w.seaLevelM)).toBe(true);
      let added = 0;
      for (let i = 0; i < s.length; i++) added += w.looseSedimentThicknessM[i] - raw.looseSedimentThicknessM[i];
      expect(added).toBeGreaterThanOrEqual(0);
    }
  });
});
