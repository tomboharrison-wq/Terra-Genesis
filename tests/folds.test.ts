import { describe, expect, it } from 'vitest';
import { foldAmplitude, foldGeometry, L0_KM, LAYERS, polygonArea } from '../src/local/folds/model';

describe('M07-C04 fold mountains (guided model)', () => {
  it('amplitude grows with shortening and the folded layer keeps its original length', () => {
    const a = [0.1, 0.2, 0.4].map((s) => foldGeometry({ shortening: s, wavelengthKm: 12, thrust: false, erosion: 0 }).amplitudeKm);
    expect(a[0]).toBeGreaterThan(0);
    expect(a[1]).toBeGreaterThan(a[0]);
    expect(a[2]).toBeGreaterThan(a[1]);
    // Arc length of the top boundary ≈ L0.
    const g = foldGeometry({ shortening: 0.3, wavelengthKm: 12, thrust: false, erosion: 0 });
    let len = 0;
    const b = g.boundaries[0];
    for (let i = 1; i < b.length; i++) len += Math.hypot(b[i].x - b[i - 1].x, b[i].z - b[i - 1].z);
    expect(len).toBeCloseTo(L0_KM, 0);
    expect(foldAmplitude(60, 60, 12)).toBe(0);
  });

  it('every layer keeps its area (rock is not created or destroyed): the pile thickens', () => {
    for (const s of [0, 0.2, 0.45]) {
      const g = foldGeometry({ shortening: s, wavelengthKm: 12, thrust: false, erosion: 0 });
      g.layers.forEach((parts, i) => expect(parts.reduce((a, q) => a + polygonArea(q), 0) / (LAYERS[i].km * L0_KM)).toBeCloseTo(1, 2));
      expect(g.thickening).toBeCloseTo(1 / (1 - s), 6);
    }
  });

  it('a thrust takes up shortening (gentler folds) and still conserves area within 2 %', () => {
    const folded = foldGeometry({ shortening: 0.45, wavelengthKm: 12, thrust: false, erosion: 0 });
    const thrust = foldGeometry({ shortening: 0.45, wavelengthKm: 12, thrust: true, erosion: 0 });
    expect(thrust.thrust).not.toBeNull();
    expect(thrust.thrustSlipKm).toBeGreaterThan(0);
    expect(thrust.amplitudeKm).toBeLessThan(folded.amplitudeKm);
    thrust.layers.forEach((parts, i) => expect(Math.abs(parts.reduce((a, q) => a + polygonArea(q), 0) / (LAYERS[i].km * L0_KM) - 1)).toBeLessThan(0.01));
    expect(thrust.layers.some((parts) => parts.length === 2)).toBe(true);
  });

  it('anticlines and synclines alternate; erosion cuts below the crests', () => {
    const g = foldGeometry({ shortening: 0.3, wavelengthKm: 12, thrust: false, erosion: 0.3 });
    expect(g.anticlines.length).toBeGreaterThan(0);
    expect(g.synclines.length).toBeGreaterThan(0);
    const crest = Math.max(...g.anticlines.map((q) => q.z));
    expect(g.erosionZ!).toBeLessThan(crest);
  });
});
