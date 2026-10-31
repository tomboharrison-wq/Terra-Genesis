import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * Fingerprint of every source file that decides what a lesson's simulated stages come out as
 * (physics, terrain, engine, world building, lesson stage code, world file format). Recorded lesson
 * runs (public/lesson-runs) carry it; the app only plays a recording whose fingerprint matches its own.
 */
const SOURCES = ['src/sim', 'src/terrain', 'src/engine', 'src/utils', 'src/education/lessons', 'src/education/scenarioWorlds.ts', 'src/persistence/format.ts'];

function files(root: string, p: string): string[] {
  const abs = join(root, p);
  if (statSync(abs).isFile()) return [abs];
  return readdirSync(abs)
    .sort()
    .flatMap((n) => files(root, join(p, n)));
}

export function modelHash(root: string): string {
  const h = createHash('sha256');
  for (const f of SOURCES.flatMap((s) => files(root, s)).filter((f) => f.endsWith('.ts'))) {
    h.update(relative(root, f).replaceAll('\\', '/'));
    h.update(readFileSync(f, 'utf8').replaceAll('\r\n', '\n'));
  }
  return h.digest('hex').slice(0, 16);
}
