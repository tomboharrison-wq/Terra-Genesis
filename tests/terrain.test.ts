import { describe, expect, it } from 'vitest';
import { generateWorld, defaultOptions, PRESETS } from '../src/terrain/generate';
import { validateWorld, computeSurface } from '../src/engine/world';
import { raycastHeightfield, sampleBilinear, slopeAt } from '../src/terrain/heightfield';

describe('procedural generation', () => {
  it('same seed + options → identical arrays', () => {
    const a = generateWorld(defaultOptions('river-basin', 1234, 64));
    const b = generateWorld(defaultOptions('river-basin', 1234, 64));
    expect(a.bedrockElevationM).toEqual(b.bedrockElevationM);
    expect(a.looseSedimentThicknessM).toEqual(b.looseSedimentThicknessM);
    expect(a.materialId).toEqual(b.materialId);
  });

  it('different seeds differ', () => {
    const a = generateWorld(defaultOptions('island', 1, 64));
    const b = generateWorld(defaultOptions('island', 2, 64));
    let d = 0;
    for (let i = 0; i < a.bedrockElevationM.length; i++) d += Math.abs(a.bedrockElevationM[i] - b.bedrockElevationM[i]);
    expect(d).toBeGreaterThan(0);
  });

  it.each(PRESETS.map((p) => p.id))('%s preset is valid, finite and non-negative sediment', (id) => {
    const w = generateWorld(defaultOptions(id, 99, 96));
    expect(validateWorld(w)).toEqual([]);
    const s = new Float32Array(w.width * w.height);
    computeSurface(w, s);
    let min = Infinity;
    let max = -Infinity;
    for (const v of s) {
      min = Math.min(min, v);
      max = Math.max(max, v);
    }
    if (id === 'flat') expect(max - min).toBeLessThan(1e-3);
    else expect(max - min).toBeGreaterThan(w.meta.reliefM * 0.2);
  });

  it('river basin drains south: outlet edge lower than the northern rim', () => {
    const w = generateWorld(defaultOptions('river-basin', 7, 128));
    const s = new Float32Array(w.width * w.height);
    computeSurface(w, s);
    const rowMean = (y: number) => {
      let t = 0;
      for (let x = 0; x < w.width; x++) t += s[y * w.width + x];
      return t / w.width;
    };
    expect(rowMean(2)).toBeLessThan(rowMean(w.height - 3));
  });

  it('island has sea at edges and land in centre', () => {
    const w = generateWorld(defaultOptions('island', 3, 128));
    const s = new Float32Array(w.width * w.height);
    computeSurface(w, s);
    expect(s[0]).toBeLessThan(w.seaLevelM);
    let landMax = -Infinity;
    for (let y = 48; y < 80; y++) for (let x = 48; x < 80; x++) landMax = Math.max(landMax, s[y * 128 + x]);
    expect(landMax).toBeGreaterThan(w.seaLevelM + 50);
  });

  it('generates 256² quickly', () => {
    const t = performance.now();
    generateWorld(defaultOptions('mountain-range', 5, 256));
    expect(performance.now() - t).toBeLessThan(1500);
  });
});

describe('heightfield sampling and picking', () => {
  const hf = (() => {
    const width = 11;
    const height = 11;
    const z = new Float32Array(width * height);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) z[y * width + x] = x * 2; // slope 2 m per 10 m cell
    return { width, height, cellSizeM: 10, z };
  })();

  it('bilinear interpolates between cells', () => {
    expect(sampleBilinear(hf, 15, 50)).toBeCloseTo(3, 5);
    expect(sampleBilinear(hf, 1000, 50)).toBeCloseTo(20, 5);
  });

  it('slope matches analytic', () => {
    expect(slopeAt(hf, 5, 5)).toBeCloseTo(0.2, 5);
  });

  it('vertical ray hits surface at sampled elevation', () => {
    const hit = raycastHeightfield(hf, [55, 40, 500], [0, 0, -1]);
    expect(hit).not.toBeNull();
    expect(hit!.xM).toBeCloseTo(55, 3);
    expect(hit!.zM).toBeCloseTo(11, 2);
  });

  it('oblique ray hits within half a cell of the analytic intersection', () => {
    // plane z = 0.2x; ray from (0, 50, 100) dir (1, 0, -1): 100 - t = 0.2 t → t = 83.33
    const hit = raycastHeightfield(hf, [0, 50, 100], [1, 0, -1])!;
    expect(hit.xM).toBeCloseTo(83.333, 1);
  });

  it('ray pointing away misses', () => {
    expect(raycastHeightfield(hf, [55, 40, 500], [0, 0, 1])).toBeNull();
    expect(raycastHeightfield(hf, [-50, 40, 500], [-1, 0, 0])).toBeNull();
  });
});
