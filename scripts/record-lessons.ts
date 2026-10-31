/**
 * Record every geological-time lesson ahead of time (M13-C07): `npm run record-lessons`.
 * Runs each lesson's stages with the same model the app runs live, in the same chunks as the app
 * (app/geoRunner runGeoYears), and writes each stage's end state as a world file to
 * public/lesson-runs, with a manifest carrying the model fingerprint (scripts/modelHash.ts).
 * Re-run after any change to the model or a lesson (tests/recordings.test.ts fails until you do).
 */
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Engine } from '../src/engine/engine';
import { LESSONS } from '../src/education/lessons';
import type { StageContext } from '../src/education/types';
import { RECORDINGS_DIR, worldFingerprint, type RecordingManifest } from '../src/education/recordings';
import { worldToFileBytes } from '../src/persistence/format';
import { modelHash } from './modelHash';

const root = join(__dirname, '..');
const dir = join(root, 'public', RECORDINGS_DIR);
mkdirSync(dir, { recursive: true });
for (const f of readdirSync(dir)) rmSync(join(dir, f));

const manifest: RecordingManifest = { modelHash: modelHash(root), lessons: {} };
let total = 0;
for (const lesson of LESSONS.filter((l) => l.geological && l.build)) {
  const t0 = Date.now();
  const engine = new Engine(lesson.build!());
  engine.beginGeologic(); // as setGeoMode(true) does when the lesson opens
  const ctx: StageContext = {
    engine,
    setLabels: () => {},
    // The app's chunking (geoRunner.runGeoYears): pieces of max(10,000, years / 6).
    geo: (years) => {
      const chunk = Math.max(10000, years / 6);
      for (let left = years; left > 1e-9; ) {
        const y = Math.min(left, chunk);
        left -= y;
        engine.geoStep(y);
      }
    },
  };
  const stages: RecordingManifest['lessons'][string] = [];
  let prevBytes: Buffer | null = null;
  for (let k = 0; k < lesson.stages.length; k++) {
    const before = worldFingerprint(engine);
    await lesson.stages[k].enter?.(ctx);
    const bytes = await worldToFileBytes(engine.world);
    // Carry on with this engine, as a live run in the app does (the file decodes to the same world:
    // tests/recordings.test.ts checks its fingerprint).
    const after = worldFingerprint(engine);
    const prev = stages[k - 1];
    if (prev && prevBytes && Buffer.from(bytes).equals(prevBytes)) {
      stages.push({ ...prev, before, after }); // the stage changed nothing (labels only): reuse the file
      continue;
    }
    prevBytes = Buffer.from(bytes);
    const file = `${lesson.id}-${k + 1}.tgw`;
    writeFileSync(join(dir, file), bytes);
    total += bytes.length;
    stages.push({ file, before, after });
  }
  manifest.lessons[lesson.id] = stages;
  console.log(`${lesson.id}: ${stages.length} stages, ${((Date.now() - t0) / 1000).toFixed(1)} s`);
}
writeFileSync(join(dir, 'index.json'), JSON.stringify(manifest, null, 1) + '\n');
console.log(`model ${manifest.modelHash} · ${(total / 1e6).toFixed(2)} MB in ${dir}`);
