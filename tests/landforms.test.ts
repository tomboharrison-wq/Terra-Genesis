import { describe, expect, it } from 'vitest';
import { ACTIVE, FORMATIONS, GLOSSARY, SPEC_LANDFORMS, TIMESCALES, TOPICS, yearsAt } from '../src/education/landforms/content';
import { LESSONS } from '../src/education/lessons';
import { SCENES } from '../src/app/landforms/scenes';

const sentences = (t: string) => t.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0);
const words = (s: string) => s.split(/\s+/).filter(Boolean).length;

describe('Landform Show (Edexcel GCSE Geography A, Topic 1 landforms)', () => {
  it('every landform named in 1.4a/b, 1.8a/b/c and 1.12a/b/c has a formation in its topic', () => {
    for (const t of TOPICS) {
      const shown = new Set(FORMATIONS.filter((f) => f.topic === t.id).flatMap((f) => f.landforms));
      const missing = SPEC_LANDFORMS[t.id].filter((l) => !shown.has(l));
      expect(missing, t.title).toEqual([]);
    }
  });

  it('formations are well formed: ordered stages, exam steps, a scene, real lesson links', () => {
    const ids = new Set<string>();
    for (const f of FORMATIONS) {
      expect(ids.has(f.id), f.id).toBe(false);
      ids.add(f.id);
      expect(f.stages[0].at, f.id).toBe(0);
      for (let k = 1; k < f.stages.length; k++) expect(f.stages[k].at, `${f.id} stage ${k}`).toBeGreaterThan(f.stages[k - 1].at);
      expect(f.stages.at(-1)!.at, f.id).toBeLessThan(0.95); // the last stage is on screen long enough to read
      expect(f.examSteps.length, f.id).toBeGreaterThanOrEqual(4);
      expect(f.durationS).toBeGreaterThanOrEqual(20);
      expect(typeof SCENES[f.id], `scene for ${f.id}`).toBe('function');
      if (f.modelLesson) expect(LESSONS.some((l) => l.id === f.modelLesson && l.geological)).toBe(true);
      if (f.lesson)
        expect(
          LESSONS.some((l) => l.id === f.lesson),
          `${f.id} → lesson ${f.lesson}`,
        ).toBe(true);
    }
  });

  it('KS3 wording stays short; GCSE wording uses the named processes', () => {
    for (const f of FORMATIONS) {
      const ks3 = f.stages.flatMap((s) => sentences(s.ks3));
      const mean = ks3.reduce((a, s) => a + words(s), 0) / ks3.length;
      expect(mean, `${f.id} KS3 mean sentence length`).toBeLessThanOrEqual(22);
      const gcse = (f.stages.map((s) => s.gcse).join(' ') + ' ' + f.examSteps.join(' ')).toLowerCase();
      const used = f.processes.filter((p) => gcse.includes(p.toLowerCase().split(' ')[0].slice(0, 5))); // stem: deposition ~ deposited
      expect(used.length, `${f.id} processes in GCSE text`).toBeGreaterThanOrEqual(Math.min(2, f.processes.length));
    }
  });

  it('every formation has a timescale, per-stage active processes, and every process is in the glossary', () => {
    for (const f of FORMATIONS) {
      expect(TIMESCALES[f.id], f.id).toBeDefined();
      expect(yearsAt(f.id, 0), f.id).toBe(0);
      expect(yearsAt(f.id, 1), f.id).toBeGreaterThan(0);
      for (let k = 1; k <= 20; k++) expect(yearsAt(f.id, k / 20)).toBeGreaterThanOrEqual(yearsAt(f.id, (k - 1) / 20)); // clock never runs backwards
      expect(ACTIVE[f.id]?.length, `${f.id} active per stage`).toBe(f.stages.length);
      for (const p of [...f.processes, ...ACTIVE[f.id].flat()]) expect(GLOSSARY[p], `glossary: ${p}`).toBeDefined();
      for (const p of ACTIVE[f.id].flat()) expect(f.processes, `${f.id}: active "${p}" listed in processes`).toContain(p);
    }
  });
});
