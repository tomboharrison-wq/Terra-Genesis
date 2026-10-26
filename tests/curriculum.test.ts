import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LESSONS } from '../src/education/lessons';
import type { LessonModule } from '../src/education/types';

/** Spec G5: curriculum validation fixtures — terminology, KS3 readability, projection legibility. */
const TERMS: Record<LessonModule, string[]> = {
  rivers: [
    'drainage basin',
    'watershed',
    'tributar',
    'confluence',
    'source',
    'mouth',
    'hydraulic action',
    'abrasion',
    'plunge pool',
    'gorge',
    'lateral erosion',
    'deposition',
    'meander',
    'oxbow',
    'river cliff',
    'slip-off slope',
  ],
  coasts: ['hydraulic action', 'abrasion', 'cave', 'arch', 'stack', 'stump', 'longshore drift', 'swash', 'backwash', 'spit', 'bar', 'lagoon'],
  glaciation: ['plucking', 'abrasion', 'U-shape', 'truncat', 'hanging valley', 'moraine', 'misfit', 'corrie', 'arête', 'pyramidal peak', 'tarn'],
  volcanoes: ['viscous', 'basaltic', 'andesitic', 'shield', 'composite', 'destructive', 'constructive', 'crater'],
  tectonics: ['collision', 'anticline', 'syncline', 'thrust', 'fold'],
};

describe('M10-C05 curriculum validation (spec G5)', () => {
  it('each module’s GCSE text uses the Edexcel A terminology', () => {
    for (const [mod, terms] of Object.entries(TERMS)) {
      const text = LESSONS.filter((l) => l.module === mod)
        .flatMap((l) => [...l.stages.map((s) => s.gcse), l.exam?.model ?? ''])
        .join(' ')
        .toLowerCase();
      const missing = terms.filter((t) => !text.includes(t.toLowerCase()));
      expect(missing, `${mod} missing: ${missing.join(', ')}`).toEqual([]);
    }
  });

  it('KS3 explanations stay readable: short sentences', () => {
    for (const l of LESSONS)
      for (const s of l.stages) {
        const sentences = s.ks3.split(/(?<=[.!?])\s+/).filter((x) => x.trim().length);
        const words = sentences.map((x) => x.split(/\s+/).length);
        const mean = words.reduce((a, b) => a + b, 0) / words.length;
        expect(mean, `${l.id} / ${s.title}: mean ${mean.toFixed(1)} words`).toBeLessThanOrEqual(26);
        expect(Math.max(...words), `${l.id} / ${s.title}`).toBeLessThanOrEqual(45);
      }
  });

  it('projection legibility: lesson text sizes and contrast', async () => {
    const css = readFileSync('src/app/styles.css', 'utf8'); // Vitest strips CSS imports, even ?raw
    const px = (selector: string) =>
      Number(css.match(new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{[^}]*font-size:\\s*(\\d+)px`))?.[1] ?? 0);
    expect(px('.lesson-panel')).toBeGreaterThanOrEqual(18);
    expect(px('.lesson-panel .stage-text')).toBeGreaterThanOrEqual(19);
    expect(px('.lesson-label span')).toBeGreaterThanOrEqual(20);
    // WCAG contrast: body text on the solid panel ≥ 7:1 (AAA); muted text ≥ 4.5:1.
    const lum = (hex: string) => {
      const c = [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
      return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    };
    const ratio = (a: string, b: string) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
    const text = css.match(/--text:\s*(#[0-9a-f]{6})/i)![1];
    const panel = css.match(/--panel-solid:\s*(#[0-9a-f]{6})/i)![1];
    expect(ratio(text, panel)).toBeGreaterThanOrEqual(7);
    // Muted = text at 62 % opacity over the panel.
    const mix = (a: string, b: string, t: number) =>
      '#' +
      [1, 3, 5]
        .map((k) =>
          Math.round(parseInt(a.slice(k, k + 2), 16) * t + parseInt(b.slice(k, k + 2), 16) * (1 - t))
            .toString(16)
            .padStart(2, '0'),
        )
        .join('');
    expect(ratio(mix(text, panel, 0.62), panel)).toBeGreaterThanOrEqual(4.5);
    // Yellow stage titles on the panel.
    expect(ratio('#ffe627', panel)).toBeGreaterThanOrEqual(7);
  });
});
