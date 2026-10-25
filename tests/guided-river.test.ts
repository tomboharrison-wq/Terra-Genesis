import { describe, expect, it } from 'vitest';
import { waterfallAt, waterfallGeometry, WATERFALL_DEFAULTS } from '../src/local/waterfall/model';
import { bendSection, CHANNEL_WIDTH_M, CUTOFF_Q, meanderAt, MEANDER_LENGTH_M } from '../src/local/meander/model';

describe('M10-C02 guided river models', () => {
  it('waterfall: the overhang grows until it collapses; each collapse moves the fall upstream; the gorge is the retreat', () => {
    const p = WATERFALL_DEFAULTS;
    let prev = waterfallAt(0);
    expect(prev.retreatM).toBe(0);
    let collapses = 0;
    for (let t = 1; t <= 400; t++) {
      const s = waterfallAt(t);
      expect(s.overhangM).toBeLessThanOrEqual(p.maxOverhangM + 1e-9); // never longer than the cap can hold
      expect(s.retreatM).toBeGreaterThanOrEqual(prev.retreatM); // only ever upstream
      expect(s.poolDepthM).toBeGreaterThanOrEqual(prev.poolDepthM);
      expect(s.poolDepthM).toBeLessThanOrEqual(0.5 * p.heightM);
      if (s.collapses > prev.collapses) {
        collapses++;
        expect(prev.overhangM).toBeGreaterThan(0.9 * p.maxOverhangM); // it was nearly at the limit
        expect(s.retreatM - prev.retreatM).toBeGreaterThan(0.9 * p.maxOverhangM); // the block fell away
      }
      prev = s;
    }
    expect(collapses).toBeGreaterThan(5);
    const g = waterfallGeometry(300);
    expect(g.gorge!.x1 - g.gorge!.x0).toBeCloseTo(g.state.retreatM, 6);
  });

  it('meander: bends grow and the neck narrows until it is cut off, leaving an oxbow and a shorter channel', () => {
    let last = meanderAt(0);
    for (const p of [0.2, 0.4, 0.6, 0.8, 0.99]) {
      const m = meanderAt(p);
      expect(m.sinuosity).toBeGreaterThan(last.sinuosity); // more winding
      expect(m.neckM).toBeLessThan(last.neckM); // narrower neck
      last = m;
    }
    expect(last.neckM).toBeGreaterThan(CHANNEL_WIDTH_M * 0.9);
    expect(CUTOFF_Q).toBeGreaterThan(0.5);
    expect(CUTOFF_Q).toBeLessThan(1.4);
    const cut = meanderAt(1.0);
    expect(cut.cutoff).toBe(true);
    expect(cut.sinuosity).toBeLessThan(meanderAt(0.999).sinuosity); // the river is now shorter
    // The oxbow is a closed loop about one meander long, its ends at the old neck.
    let len = 0;
    for (let k = 1; k < cut.oxbow!.length; k++) len += Math.hypot(cut.oxbow![k].x - cut.oxbow![k - 1].x, cut.oxbow![k].y - cut.oxbow![k - 1].y);
    expect(len).toBeGreaterThan(0.6 * MEANDER_LENGTH_M);
    expect(len).toBeLessThan(1.1 * MEANDER_LENGTH_M);
    const a = cut.oxbow![0];
    const b = cut.oxbow![cut.oxbow!.length - 1];
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeLessThanOrEqual(CHANNEL_WIDTH_M * 1.001); // cut where the neck reached the channel width
    expect(meanderAt(1.9).oxbowInfill).toBeCloseTo(0.9, 6);
  });

  it('bend cross-section: deepest towards the outer bank (river cliff), shallow inner slip-off slope', () => {
    const s = bendSection();
    const inChannel = s.bed.filter((q) => q.x >= 0 && q.x <= CHANNEL_WIDTH_M);
    const deepest = inChannel.reduce((a, b) => (b.z < a.z ? b : a));
    expect(deepest.x).toBeGreaterThan(0.6 * CHANNEL_WIDTH_M);
    const inner = inChannel.find((q) => q.x >= 0.2 * CHANNEL_WIDTH_M)!;
    expect(inner.z).toBeGreaterThan(-1); // shallow point bar
    // Outer bank much steeper than inner bank.
    const steep = (p: { x: number; z: number }, q: { x: number; z: number }) => Math.abs((q.z - p.z) / (q.x - p.x));
    const outer = inChannel.slice(-5);
    expect(steep(outer[0], outer[outer.length - 1])).toBeGreaterThan(3 * steep(inChannel[0], inChannel[5]));
  });
});
