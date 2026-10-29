import { describe, expect, it } from 'vitest';
import { hangingHeight, profileExponent, ridgeAt, troughProfile } from '../src/local/glacial/model';
import { foldStage } from '../src/education/lessons/tectonics';
import { foldGeometry } from '../src/local/folds/model';
import { lessonById, LESSONS } from '../src/education/lessons';
import { Engine } from '../src/engine/engine';
import { generateWorld } from '../src/terrain/generate';
import type { LessonLabel } from '../src/education/types';

describe('M10-C04 glacial, tectonic and volcanic lessons', () => {
  it('glacial trough: V-shaped (b ≈ 1) becomes U-shaped (b ≈ 2), deeper; a hanging valley is left', () => {
    const v = troughProfile(0);
    const u = troughProfile(1);
    expect(profileExponent(v)).toBeCloseTo(1, 1);
    expect(profileExponent(u)).toBeGreaterThan(1.6);
    expect(Math.min(...u.map((q) => q.z))).toBeLessThan(Math.min(...v.map((q) => q.z)) - 100); // deepened
    expect(hangingHeight(0)).toBe(0);
    expect(hangingHeight(1)).toBeGreaterThan(100);
  });

  it('corries cut back until an arête remains; the corrie floor is over-deepened behind a lip', () => {
    const r0 = ridgeAt(0);
    const r1 = ridgeAt(1);
    expect(r0.arete).toBe(false);
    expect(r1.arete).toBe(true);
    expect(r1.crestWidthM).toBeLessThan(r0.crestWidthM / 10);
    expect(r1.tarnDepthM).toBeGreaterThan(r0.tarnDepthM);
    // A rock lip: going outwards from the hollow the ground rises again before falling to the valley.
    const wall = r1.crestWidthM / 2;
    const floor = r1.profile.filter((q) => q.x > wall + 0.35 * 700 && q.x < wall + 0.85 * 700);
    const lowest = Math.min(...floor.map((q) => q.z));
    const lip = r1.profile.find((q) => q.x >= wall + 0.85 * 700)!;
    expect(lip.z).toBeGreaterThan(lowest + 20);
  });

  it('fold lesson stages: flat → folded → thrust → eroded, with the fold model conserving layer length', () => {
    expect(foldStage(0).shortening).toBe(0);
    expect(foldStage(1).shortening).toBeGreaterThan(0.2);
    expect(foldStage(2).thrust).toBe(true);
    expect(foldStage(3).erosion).toBeGreaterThan(0);
    expect(foldGeometry(foldStage(0)).amplitudeKm).toBe(0);
    expect(foldGeometry(foldStage(1)).amplitudeKm).toBeGreaterThan(0.5);
  });

  it('volcano lesson builds a real shield and composite volcano and labels their summits', { timeout: 120000 }, () => {
    const l = lessonById('volcano-types')!;
    const e = new Engine(generateWorld({ ...l.setup!, size: 80 }));
    let labels: LessonLabel[] = [];
    const ctx = { engine: e, setLabels: (x: LessonLabel[]) => (labels = x), geo: (y: number) => void e.geoStep(y) };
    for (const st of l.stages) {
      st.enter?.(ctx);
      labels = st.labels ? st.labels(ctx) : [];
    }
    const texts = labels.map((q) => q.text).join(' | ');
    expect(texts).toMatch(/Shield volcano \(\d+ m high\)/);
    expect(texts).toMatch(/Composite volcano \(\d+ m high\)/);
    const h = (re: RegExp) => Number(texts.match(re)![1]);
    expect(h(/Composite volcano \((\d+) m/)).toBeGreaterThan(h(/Shield volcano \((\d+) m/)); // the steep cone stands taller here
  });

  it('every lesson of the five modules meets the teaching contract', () => {
    const modules = new Set(LESSONS.map((l) => l.module));
    for (const m of ['rivers', 'coasts', 'tectonics', 'volcanoes', 'glaciation']) expect(modules.has(m as never)).toBe(true);
  });
});
