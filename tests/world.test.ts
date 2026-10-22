import { describe, expect, it } from 'vitest';
import { createWorld, computeSurface, validateWorld, cloneWorld } from '../src/engine/world';
import { mulberry32, deriveSeed } from '../src/utils/rng';
import { Noise2D } from '../src/utils/noise';
import { worldToThree, threeToWorld } from '../src/utils/axes';

describe('WorldState contract', () => {
  it('creates SI-unit fields of the right size', () => {
    const w = createWorld({ width: 64, height: 32, cellSizeM: 25, seed: 7 });
    expect(w.bedrockElevationM).toBeInstanceOf(Float32Array);
    expect(w.bedrockElevationM.length).toBe(64 * 32);
    expect(w.looseSedimentThicknessM.length).toBe(64 * 32);
    expect(w.materialId).toBeInstanceOf(Uint8Array);
    expect(validateWorld(w)).toEqual([]);
  });

  it('rejects invalid sizes', () => {
    expect(() => createWorld({ width: 1, height: 10, cellSizeM: 1, seed: 0 })).toThrow();
    expect(() => createWorld({ width: 10, height: 10, cellSizeM: 0, seed: 0 })).toThrow();
  });

  it('derives surface = bedrock + sediment', () => {
    const w = createWorld({ width: 4, height: 4, cellSizeM: 1, seed: 0 });
    w.bedrockElevationM.fill(5);
    w.looseSedimentThicknessM.fill(1.5);
    const s = new Float32Array(16);
    computeSurface(w, s);
    expect(Array.from(s).every((v) => v === 6.5)).toBe(true);
  });

  it('validate catches negative sediment and NaN', () => {
    const w = createWorld({ width: 4, height: 4, cellSizeM: 1, seed: 0 });
    w.looseSedimentThicknessM[3] = -1;
    w.bedrockElevationM[2] = NaN;
    expect(validateWorld(w).length).toBe(2);
  });

  it('clone is deep', () => {
    const w = createWorld({ width: 4, height: 4, cellSizeM: 1, seed: 0 });
    const c = cloneWorld(w);
    c.bedrockElevationM[0] = 9;
    expect(w.bedrockElevationM[0]).toBe(0);
  });
});

describe('determinism', () => {
  it('mulberry32 is reproducible', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 100; i++) expect(a()).toBe(b());
  });
  it('deriveSeed separates salts', () => {
    expect(deriveSeed(1, 'a')).not.toBe(deriveSeed(1, 'b'));
    expect(deriveSeed(1, 'a')).toBe(deriveSeed(1, 'a'));
  });
  it('noise is seeded, bounded and continuous', () => {
    const n1 = new Noise2D(5);
    const n2 = new Noise2D(5);
    const n3 = new Noise2D(6);
    let maxAbs = 0;
    let maxStep = 0;
    let diff = 0;
    for (let k = 0; k < 2000; k++) {
      const x = k * 0.013;
      const y = Math.sin(k) * 3;
      const v = n1.noise(x, y);
      expect(v).toBe(n2.noise(x, y));
      diff += Math.abs(v - n3.noise(x, y));
      maxAbs = Math.max(maxAbs, Math.abs(v));
      maxStep = Math.max(maxStep, Math.abs(n1.noise(x + 1e-3, y) - v));
    }
    expect(maxAbs).toBeLessThanOrEqual(1.01);
    expect(maxStep).toBeLessThan(0.02);
    expect(diff).toBeGreaterThan(10);
  });
});

describe('axes', () => {
  it('round-trips world <-> three coordinates with y up', () => {
    const t = worldToThree(10, 20, 30);
    expect(t).toEqual([10, 30, -20]);
    expect(threeToWorld(...t)).toEqual([10, 20, 30]);
  });
});
