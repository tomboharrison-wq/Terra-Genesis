import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Engine } from '../src/engine/engine';
import { LESSONS, lessonById } from '../src/education/lessons';
import type { Lesson, StageContext } from '../src/education/types';
import { RECORDINGS_DIR, worldFingerprint, type RecordingManifest } from '../src/education/recordings';
import { worldFromFileBytes } from '../src/persistence/format';
import { modelHash } from '../scripts/modelHash';

const root = join(__dirname, '..');
const dir = join(root, 'public', RECORDINGS_DIR);
const manifest = JSON.parse(readFileSync(join(dir, 'index.json'), 'utf8')) as RecordingManifest;
const geological = LESSONS.filter((l) => l.geological && l.build);

async function play(lesson: Lesson, k: number, engine: Engine) {
  const st = manifest.lessons[lesson.id][k];
  engine.replaceWorld((await worldFromFileBytes(new Uint8Array(readFileSync(join(dir, st.file))))).world, true);
  engine.showGeoRivers(); // as the lesson player does after showing a stage
}

const ctxFor = (engine: Engine): StageContext => ({
  engine,
  setLabels: () => {},
  geo: (years) => {
    const chunk = Math.max(10000, years / 6); // as app/geoRunner.runGeoYears
    for (let left = years; left > 1e-9; ) {
      const y = Math.min(left, chunk);
      left -= y;
      engine.geoStep(y);
    }
  },
});

describe('recorded lesson runs (M13-C07)', () => {
  it('were recorded by the current model source (else run `npm run record-lessons`)', () => {
    expect(manifest.modelHash, 'recordings are stale: run `npm run record-lessons` and commit public/lesson-runs').toBe(modelHash(root));
    expect(Object.keys(manifest.lessons).sort()).toEqual(geological.map((l) => l.id).sort());
  });

  it('chain from the lesson’s starting world, stage to stage, with every file present', async () => {
    for (const lesson of geological) {
      const stages = manifest.lessons[lesson.id];
      expect(stages.length).toBe(lesson.stages.length);
      const engine = new Engine(lesson.build!());
      engine.beginGeologic();
      expect(worldFingerprint(engine), `${lesson.id}: the starting world rebuilds identically`).toBe(stages[0].before);
      for (let k = 0; k < stages.length; k++) {
        expect(existsSync(join(dir, stages[k].file))).toBe(true);
        if (k > 0) expect(stages[k].before).toBe(stages[k - 1].after);
        await play(lesson, k, engine);
        expect(worldFingerprint(engine)).toBe(stages[k].after);
      }
    }
  }, 60000);

  it('a recorded stage shows the same measured labels as running it live', async () => {
    for (const id of ['waterfall-gorge-model', 'meanders-floodplain-model']) {
      const lesson = lessonById(id)!;
      const live = new Engine(lesson.build!());
      live.beginGeologic();
      const rec = new Engine(lesson.build!());
      for (let k = 0; k < lesson.stages.length; k++) {
        const st = lesson.stages[k];
        await st.enter?.(ctxFor(live));
        await play(lesson, k, rec);
        const text = (e: Engine) => (st.labels ? st.labels(ctxFor(e)).map((l) => l.text) : []);
        expect(text(rec), `${id} stage ${k + 1}`).toEqual(text(live));
        expect(worldFingerprint(rec)).toBe(worldFingerprint(live));
      }
    }
  }, 120000);

  it('the glaciated-upland recording carries what its labels measure (land before the ice, greatest ice)', async () => {
    const lesson = lessonById('glaciated-upland-model')!;
    const e = new Engine(lesson.build!());
    const melted = lesson.stages.findIndex((s) => s.title.startsWith('The ice melts'));
    await play(lesson, melted, e);
    expect(e.lessonField('pre')).not.toBeNull();
    expect(e.lessonField('iceMax')!.some((v) => v > 100)).toBe(true);
    expect(e.geoTotals.glacialEroded).toBeGreaterThan(0);
    const labels = lesson.stages[melted].labels!(ctxFor(e)).map((l) => l.text);
    expect(labels.some((t) => /trough/i.test(t))).toBe(true);
  });
});
