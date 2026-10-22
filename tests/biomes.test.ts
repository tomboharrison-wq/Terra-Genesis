import { describe, expect, it } from 'vitest';
import { defaultOptions, generateWorld } from '../src/terrain/generate';
import { compareClimate, spinUp } from '../src/terrain/biomes';

const gen = (id: Parameters<typeof defaultOptions>[0], seed = 7) => generateWorld(defaultOptions(id, seed, 96));
const stats = (w: ReturnType<typeof gen>) => spinUp(w, 0); // re-measure without adding ice

describe('M06-C05 biome presets and "what if?" comparisons', () => {
  it('temperate valley: climate on, extensive forest, no ice', () => {
    const w = gen('temperate-valley');
    expect(w.climate.enabled).toBe(true);
    const s = stats(w);
    expect(s.coverPct).toBeGreaterThan(20); // 96² test map; ≈ 50 % at the default 256²
    expect(s.iceM3).toBe(0);
  });

  it('alpine glaciers: ice above the snowline, forest below the treeline', () => {
    const w = gen('alpine-glaciers');
    expect(w.glacier.enabled).toBe(true);
    const s = stats(w);
    expect(s.iceM3).toBeGreaterThan(0);
    expect(s.coverPct).toBeGreaterThan(3);
    expect(s.treelineM).toBeLessThan(s.snowlineM);
    // No plants under the ice.
    for (let i = 0; i < w.vegCover.length; i++) if (w.iceThicknessM[i] > 1) expect(w.vegCover[i]).toBe(0);
  });

  it('rain-shadow desert: plants on the windward (west) side, sparse in the lee (east)', () => {
    const w = gen('rain-shadow');
    const W = w.width;
    let west = 0;
    let east = 0;
    for (let y = 0; y < w.height; y++)
      for (let x = 0; x < W; x++) {
        if (x < W * 0.3) west += w.vegCover[y * W + x];
        if (x > W * 0.7) east += w.vegCover[y * W + x];
      }
    expect(west).toBeGreaterThan(2 * east);
  });

  it('tundra: sparse plants, no forest, ice on the hills', () => {
    const s = stats(gen('tundra'));
    expect(s.forestPct).toBe(0);
    expect(s.coverPct).toBeGreaterThan(0);
    expect(s.coverPct).toBeLessThan(30);
    expect(s.iceM3).toBeGreaterThan(0);
  });

  it('presets are reproducible from their seed', () => {
    const a = gen('alpine-glaciers', 11);
    const b = gen('alpine-glaciers', 11);
    expect(Array.from(a.vegCover)).toEqual(Array.from(b.vegCover));
    expect(Array.from(a.iceThicknessM)).toEqual(Array.from(b.iceThicknessM));
  });

  it('what if: warmer → less ice, higher treeline; wetter → more plants; the world is untouched', () => {
    const w = gen('alpine-glaciers');
    const cover0 = w.vegCover.slice();
    const ice0 = w.iceThicknessM.slice();
    const warm = compareClimate(w, 'warmer');
    expect(warm.whatIf.iceM3).toBeLessThan(warm.now.iceM3);
    expect(warm.whatIf.treelineM).toBeGreaterThan(warm.now.treelineM);
    const t = gen('rain-shadow');
    const wet = compareClimate(t, 'wetter');
    expect(wet.whatIf.coverPct).toBeGreaterThan(wet.now.coverPct);
    let more = 0;
    for (const d of wet.coverDiff) if (d > 0.01) more++;
    expect(more).toBeGreaterThan(0);
    expect(Array.from(w.vegCover)).toEqual(Array.from(cover0));
    expect(Array.from(w.iceThicknessM)).toEqual(Array.from(ice0));
  });
});
