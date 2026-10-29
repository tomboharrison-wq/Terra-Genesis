import { describe, expect, it } from 'vitest';
import { createWorld, setUniformStrata } from '../src/engine/world';
import { Engine } from '../src/engine/engine';
import { generateWorld } from '../src/terrain/generate';
import { findBasin } from '../src/education/features';
import { LESSONS } from '../src/education/lessons';
import { d8Receivers } from '../src/renderer/overlays';

describe('M10-C01 education: features found in the simulated landscape', () => {
  it('a valley with one side valley: mouth, confluence, tributary, source and watershed in the right places', () => {
    // 41 × 41, 30 m cells. Main valley along x = 20 falling south to the edge; a side valley from the east joins at y = 25.
    const N = 41;
    const w = createWorld({
      width: N,
      height: N,
      cellSizeM: 30,
      seed: 1,
      seaLevelM: -1000,
    });
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        const main = 4 * Math.abs(x - 20) + 0.6 * y;
        const side = x > 20 ? 4 * Math.abs(y - 25) + 0.6 * (x - 20) + 0.6 * 25 : Infinity;
        w.bedrockElevationM[y * N + x] = 100 + Math.min(main, side);
      }
    setUniformStrata(w);
    const e = new Engine(w);
    const b = findBasin(w, e.surface);
    const f = Object.fromEntries(b.features.map((q) => [q.kind, q]));
    expect(f.mouth.yM).toBe(0); // the outlet on the south edge
    expect(Math.abs(f.mouth.xM - 600)).toBeLessThanOrEqual(30);
    expect(f.confluence).toBeDefined();
    expect(Math.abs(f.confluence.xM - 600)).toBeLessThanOrEqual(30); // on the main valley floor …
    expect(Math.abs(f.confluence.yM - 750)).toBeLessThanOrEqual(60); // … where the side valley comes in
    expect(f.tributary.xM).toBeGreaterThan(600); // up the side valley
    expect(f.source.yM).toBeGreaterThan(f.confluence.yM); // upstream of the confluence
    // The watershed point is on the basin edge and higher than the source.
    expect(f.watershed.value).toBeGreaterThan(f.source.value);
    // Every feature lies in the basin, and areas grow downstream.
    for (const q of b.features) expect(b.basin[Math.round(q.yM / 30) * N + Math.round(q.xM / 30)]).toBe(1);
    expect(f.mouth.value).toBeGreaterThan(f.confluence.value);
    expect(f.confluence.value).toBeGreaterThan(f.tributary.value);
  });

  it('on the river-basin lesson world the labels follow flow routing (source drains to the mouth)', () => {
    const lesson = LESSONS.find((l) => l.id === 'drainage-basin')!;
    const w = generateWorld({ ...lesson.setup!, size: 96 });
    const e = new Engine(w);
    const b = findBasin(w, e.surface);
    const kinds = b.features.map((q) => q.kind);
    expect(kinds).toEqual(expect.arrayContaining(['mouth', 'source', 'confluence', 'watershed']));
    const rec = d8Receivers(e.surface, w.width, w.height, w.cellSizeM, (i) => e.surface[i] < w.seaLevelM);
    const idx = (k: string) => {
      const q = b.features.find((x) => x.kind === k)!;
      return Math.round(q.yM / w.cellSizeM) * w.width + Math.round(q.xM / w.cellSizeM);
    };
    // Follow the flow from the source: it passes the mouth.
    let j = idx('source');
    let steps = 0;
    while (j !== idx('mouth') && rec[j] >= 0 && steps++ < w.width * w.height) j = rec[j];
    expect(j).toBe(idx('mouth'));
    expect(b.areaM2).toBeGreaterThan(0.2 * w.width * w.height * w.cellSizeM ** 2); // the main basin covers much of the map
  });

  it('every lesson meets the teaching contract (objective, stages with KS3 + GCSE text, exam, misconception)', () => {
    for (const l of LESSONS) {
      expect(l.objective.length).toBeGreaterThan(20);
      expect(l.stages.length).toBeGreaterThanOrEqual(3);
      for (const s of l.stages) {
        expect(s.ks3.length).toBeGreaterThan(30);
        expect(s.gcse.length).toBeGreaterThan(30);
      }
      expect(l.exam?.model.length).toBeGreaterThan(50);
      expect(l.kind === 'guided' ? l.guided !== undefined && l.stages.every((s) => s.t !== undefined) : l.setup !== undefined || l.build !== undefined).toBe(true);
      expect(l.misconception).toBeDefined();
    }
  });
});
