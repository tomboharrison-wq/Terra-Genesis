import type { Engine } from '../engine/engine';
import type { WorldState } from '../engine/world';
import { worldFromFileBytes } from '../persistence/format';

/**
 * Recorded lesson runs (M13-C07). Each geological lesson's stages were run ahead of time with this
 * same model (scripts/record-lessons.ts) and saved as world files in public/lesson-runs. A stage is
 * played from its recording only when (1) the recording was made by exactly this model source
 * (__MODEL_HASH__) and (2) the world on screen is exactly the one the recorded stage started from
 * (same terrain to the centimetre, same climate, glacier, wave and geological settings). Otherwise the
 * stage runs live, as before — a recording is never shown for a world it was not made from.
 */
export interface RecordedStage {
  file: string;
  /** Fingerprint of the world the stage starts from / ends at. */
  before: string;
  after: string;
}
export interface RecordingManifest {
  modelHash: string;
  lessons: Record<string, RecordedStage[]>;
}

export const RECORDINGS_DIR = 'lesson-runs';

/** FNV-1a over terrain (cm), rock, ice (cm) and every setting that changes what geological time does. */
export function worldFingerprint(engine: Engine): string {
  const w = engine.world;
  let h = 0x811c9dc5;
  const mix = (v: number) => {
    h ^= v & 0xff;
    h = Math.imul(h, 0x01000193);
    h ^= (v >>> 8) & 0xff;
    h = Math.imul(h, 0x01000193);
    h ^= (v >>> 16) & 0xff;
    h = Math.imul(h, 0x01000193);
    h ^= v >>> 24;
    h = Math.imul(h, 0x01000193);
  };
  for (const f of [w.bedrockElevationM, w.looseSedimentThicknessM, w.iceThicknessM]) for (let i = 0; i < f.length; i++) mix(Math.round(f[i] * 100));
  for (let i = 0; i < w.materialId.length; i++) mix(w.materialId[i]);
  const settings = JSON.stringify([w.width, w.height, w.cellSizeM, w.seaLevelM, w.climate, w.glacier, w.coast, engine.geoParams, w.meta.geologicYears ?? 0]);
  for (let i = 0; i < settings.length; i++) mix(settings.charCodeAt(i));
  return (h >>> 0).toString(16).padStart(8, '0');
}

let manifest: Promise<RecordingManifest | null> | null = null;
function loadManifest(): Promise<RecordingManifest | null> {
  manifest ??= fetch(`${RECORDINGS_DIR}/index.json`)
    .then((r) => (r.ok ? (r.json() as Promise<RecordingManifest>) : null))
    .then((m) => (m && m.modelHash === __MODEL_HASH__ ? m : null))
    .catch(() => null);
  return manifest;
}

/** Recordings can be switched off with ?recorded=0 (always run live). */
export const recordingsEnabled = () => typeof location === 'undefined' || new URLSearchParams(location.search).get('recorded') !== '0';

/** The recorded end of stage k of this lesson, if one applies to the world on screen now; else null. */
export async function recordedStage(lessonId: string, k: number, engine: Engine): Promise<WorldState | null> {
  if (!recordingsEnabled()) return null;
  const m = await loadManifest();
  const st = m?.lessons[lessonId]?.[k];
  if (!st || worldFingerprint(engine) !== st.before) return null;
  try {
    const r = await fetch(`${RECORDINGS_DIR}/${st.file}`);
    if (!r.ok) return null;
    return (await worldFromFileBytes(new Uint8Array(await r.arrayBuffer()))).world;
  } catch {
    return null;
  }
}
