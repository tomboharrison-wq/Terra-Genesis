import { describe, expect, it } from 'vitest';
import { createWorld, setUniformStrata } from '../src/engine/world';
import { Engine } from '../src/engine/engine';
import { aspectAt, aspectSector, flowAccumulation, OVERLAYS, overlayById, prepareOverlay, slopeDegAt } from '../src/renderer/overlays';

describe('M09-C02 map overlays', () => {
  it('D8 flow accumulation: a plane tilted east passes each row along; a V-valley gathers the whole map', () => {
    const W = 12;
    const H = 9;
    const cs = 10;
    const plane = new Float32Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) plane[y * W + x] = 100 - x;
    const a = flowAccumulation(plane, W, H, cs);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) expect(a[y * W + x]).toBeCloseTo((x + 1) * 100, 6);
    const c = 4;
    const valley = new Float32Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) valley[y * W + x] = 3 * Math.abs(y - c) + 0.5 * (W - x);
    const v = flowAccumulation(valley, W, H, cs);
    expect(v[c * W + W - 1]).toBeCloseTo(W * H * 100, 3); // every cell drains out through the valley mouth
    // Sea cells take water in but pass none on.
    const s = flowAccumulation(plane, W, H, cs, (i) => i % W >= 6);
    expect(s[7]).toBeCloseTo(100, 6);
    expect(s[6]).toBeCloseTo(700, 6);
  });

  it('aspect: compass sectors and the way a slope faces', () => {
    expect([0, 22, 23, 44, 90, 180, 270, 337, 338, 359].map(aspectSector)).toEqual([0, 0, 1, 1, 2, 4, 6, 7, 0, 0]);
    const W = 5;
    const z = new Float32Array(25);
    for (let i = 0; i < 25; i++) z[i] = 2 * (i % W); // rises east
    expect(aspectAt(z, W, 5, 10, 12)).toBeCloseTo(270, 6); // faces west
    expect(slopeDegAt(z, W, 5, 10, 12)).toBeCloseTo((Math.atan(0.2) * 180) / Math.PI, 6);
    expect(aspectAt(new Float32Array(25), W, 5, 10, 12)).toBeNull(); // flat
  });

  it('overlays are offered only when their data exists, and colour within range', () => {
    const w = createWorld({ width: 30, height: 30, cellSizeM: 20, seed: 1, seaLevelM: 0 });
    for (let i = 0; i < 900; i++) w.bedrockElevationM[i] = (i % 30) * 3 - 10;
    setUniformStrata(w);
    const e = new Engine(w);
    const ids = () => OVERLAYS.filter((o) => o.available(e)).map((o) => o.id);
    expect(ids()).toEqual(expect.arrayContaining(['elevation', 'slope', 'aspect', 'geology', 'flow', 'change']));
    for (const missing of ['ice', 'plants', 'ash', 'temperature', 'rainfall', 'shaking', 'compare', 'plates', 'waves', 'flood']) expect(ids()).not.toContain(missing);
    w.iceThicknessM[100] = 30;
    w.vegCover[200] = 0.5;
    w.tephraM[300] = 0.2;
    w.looseSedimentThicknessM[300] = 0.2;
    e.setClimateParams({ enabled: true });
    e.startStorm(50, 1);
    e.advance(600);
    expect(ids()).toEqual(expect.arrayContaining(['ice', 'plants', 'ash', 'temperature', 'rainfall', 'flood']));
    // Every generic overlay produces finite colours in 0 … 1 for every cell.
    const out = new Float32Array(3);
    for (const o of OVERLAYS.filter((q) => q.colour)) {
      const d = prepareOverlay(o.id, e);
      for (let i = 0; i < 900; i++) {
        o.colour!(e, i, d, out, 0);
        for (const c of out) expect(c >= 0 && c <= 1).toBe(true);
      }
    }
    // Inspector text carries real values and units.
    const d = prepareOverlay('elevation', e);
    expect(overlayById('elevation')!.describe(e, 5, d)).toBe('5.0 m (5.0 m above sea)');
    expect(overlayById('elevation')!.describe(e, 1, d)).toMatch(/below sea/);
    expect(overlayById('ice')!.describe(e, 100, d)).toBe('30 m of ice');
    expect(overlayById('ash')!.describe(e, 300, d)).toBe('20 cm of ash / cinder');
    const f = prepareOverlay('flow', e);
    expect(overlayById('flow')!.describe(e, 29, f)).toMatch(/drains through here/);
    // Higher ground is coloured differently from the shore (sequential ramp moves).
    const lo = new Float32Array(3);
    const hi = new Float32Array(3);
    overlayById('elevation')!.colour!(e, 4, d, lo, 0);
    overlayById('elevation')!.colour!(e, 29, d, hi, 0);
    expect(Math.abs(lo[0] - hi[0]) + Math.abs(lo[1] - hi[1]) + Math.abs(lo[2] - hi[2])).toBeGreaterThan(0.2);
  });
});
