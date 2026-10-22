import { describe, expect, it } from 'vitest';
import { analyse, arcZ, factorOfSafety, ground, slumpGeometry, rotate, SOIL_PRESETS, type SlumpParams } from '../src/local/slump/model';

const clay = (saturation: number, faceDeg = 55, heightM = 25): SlumpParams => ({ ...SOIL_PRESETS.clay, heightM, faceDeg, saturation });

describe('M04-C04 rotational slump (guided local model)', () => {
  it('factor of safety falls as the cliff saturates', () => {
    const f = [0, 0.25, 0.5, 0.75, 1].map((s) => analyse(clay(s)).fos);
    for (let k = 1; k < f.length; k++) expect(f[k]).toBeLessThan(f[k - 1]);
  });

  it('a dry gentle slope is stable; a saturated steep clay cliff fails', () => {
    const dry = analyse(clay(0, 25, 15));
    const wet = analyse(clay(1, 60, 30));
    expect(dry.fos).toBeGreaterThan(1);
    expect(dry.failed).toBe(false);
    expect(wet.fos).toBeLessThan(1);
    expect(wet.failed).toBe(true);
    expect(wet.thetaFinal).toBeGreaterThan(0);
  });

  it('the critical surface is a real slip surface below the ground and passes near the toe', () => {
    const r = analyse(clay(1, 60, 30));
    const c = r.critical!;
    for (let k = 1; k < 20; k++) {
      const x = c.xIn + (k / 20) * (c.xOut - c.xIn);
      expect(arcZ(c, x)).toBeLessThanOrEqual(ground(r.params, x) + 1e-6);
    }
    expect(factorOfSafety(r.params, c)).toBeCloseTo(r.fos, 6);
  });

  it('slumping conserves area (block + toe lobe), exposes a back scarp and tilts the block back', () => {
    const r = analyse(clay(1, 60, 30));
    const g = slumpGeometry(r.params, r.critical!, r.thetaFinal);
    expect(Math.abs(g.areaBlock + g.areaLobe - g.areaOriginal) / g.areaOriginal).toBeLessThan(1e-9);
    expect(g.crownDrop).toBeGreaterThan(0.5);
    expect(g.tiltDeg).toBeGreaterThan(0);
  });

  it('no hovering: the moved block’s base stays on the slip circle', () => {
    const r = analyse(clay(1, 60, 30));
    const c = r.critical!;
    // Points of the original arc, rotated, remain at distance R from the centre.
    for (let k = 1; k < 10; k++) {
      const x = c.xIn + (k / 10) * (c.xOut - c.xIn);
      const p = rotate({ x, z: arcZ(c, x) }, c, r.thetaFinal);
      expect(Math.hypot(p.x - c.xc, p.z - c.zc)).toBeCloseTo(c.r, 6);
    }
  });

  it('a stable configuration does not move', () => {
    const r = analyse(clay(0, 25, 15));
    expect(r.thetaFinal).toBe(0);
  });
});
