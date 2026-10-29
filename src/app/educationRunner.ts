import { useUi } from '../state/uiStore';
import { lessonById } from '../education/lessons';
import type { LessonLabel, StageContext } from '../education/types';
import { makeCheckpoint, type Checkpoint } from '../engine/checkpoints';
import { cloneWorld } from '../engine/world';
import { engine, getScene, newWorld, onWorldReplaced, replaceWorld, syncSim } from './runtime';
import { runGeoYears, setGeoMode } from './geoRunner';

/**
 * Lesson player (spec G3/G4). Each stage's world state is kept (privately, not in the user's
 * checkpoint list) when the stage is first reached, so Previous / Next / Reset show the actual
 * simulated state of that stage — physics is never run backwards.
 */
let stageStates: Checkpoint[] = [];
let switching = false;

const ctx = (): StageContext => ({
  engine,
  setLabels: (l) => useUi.getState().set({ lessonLabels: l }),
  geo: (years) => runGeoYears(years),
});

export function startLesson(id: string): void {
  const lesson = lessonById(id);
  if (!lesson) return;
  if (lesson.setup || lesson.build) {
    switching = true;
    if (lesson.build) replaceWorld(lesson.build());
    else if (lesson.setup) newWorld(lesson.setup);
    switching = false;
  }
  engine.setPlaying(false);
  setGeoMode(!!lesson.geological);
  stageStates = [];
  useUi.getState().set({
    dialog: null,
    education: {
      lessonId: id,
      stage: 0,
      level: 'gcse',
      labels: true,
      answer: false,
      busy: false,
    },
    lessonLabels: [],
  });
  goToStage(0);
}

function restore(cp: Checkpoint) {
  switching = true;
  engine.replaceWorld(cloneWorld(cp.world), true);
  switching = false;
}

/** Show stage k: restore its saved state, or (first visit) enter it from stage k − 1 and save it. */
export function goToStage(k: number): void {
  const ed = useUi.getState().education;
  const lesson = ed && lessonById(ed.lessonId);
  if (!ed || !lesson || k < 0 || k >= lesson.stages.length || ed.busy) return;
  const stage = lesson.stages[k];
  if (lesson.guided) {
    // Guided model: no world state; the view animates the model to this stage's time.
    useUi.getState().set({ education: { ...ed, stage: k, answer: false }, lessonLabels: [] });
    return;
  }
  const finish = () => {
    if (lesson.geological && !engine.geoRivers) engine.showGeoRivers(); // rivers and lakes of this stage's landscape
    const labels: LessonLabel[] = stage.labels ? stage.labels(ctx()) : [];
    useUi.getState().set({
      education: {
        ...useUi.getState().education!,
        stage: k,
        busy: false,
        answer: false,
      },
      lessonLabels: labels,
      terrainOverlay: stage.overlay ?? 'none',
    });
    const scene = getScene();
    if (stage.camera === 'top') scene?.topDown(1.5);
    else if (stage.camera === 'oblique') {
      scene?.topDown(1.5); // centre the target on the map first
      scene?.oblique();
    }
    syncSim();
  };
  engine.setPlaying(false);
  if (stageStates[k]) {
    restore(stageStates[k]);
    return finish();
  }
  // First visit: come from the saved end of the previous stage, run this stage's change, save.
  if (k > 0 && stageStates[k - 1]) restore(stageStates[k - 1]);
  useUi.getState().set({ education: { ...ed, busy: true } });
  setTimeout(async () => {
    await stage.enter?.(ctx());
    stageStates[k] = makeCheckpoint(engine.world, k, stage.title);
    stageStates.length = k + 1; // later stages must be re-run from here
    finish();
  }, 30);
}

/**
 * Open a lesson directly at stage k (teacher link). Emergent lessons run every earlier stage in turn,
 * so the state shown is the real result of the stages before it.
 */
export function startLessonAt(id: string, k: number, level?: 'ks3' | 'gcse'): void {
  startLesson(id);
  const lesson = lessonById(id);
  if (!lesson) return;
  const last = Math.max(0, Math.min(lesson.stages.length - 1, k));
  if (level) useUi.getState().set({ education: { ...useUi.getState().education!, level } });
  const step = () => {
    const ed = useUi.getState().education;
    if (!ed || ed.lessonId !== id) return;
    if (ed.busy) return void setTimeout(step, 100);
    if (ed.stage < last) {
      goToStage(ed.stage + 1);
      setTimeout(step, 100);
    }
  };
  setTimeout(step, 100);
}

/** A shareable link that opens this lesson at the current stage and level. */
export function lessonLink(): string {
  const ed = useUi.getState().education;
  if (!ed) return location.href;
  const u = new URL(location.href);
  u.search = '';
  u.searchParams.set('lesson', ed.lessonId);
  u.searchParams.set('stage', String(ed.stage + 1));
  u.searchParams.set('level', ed.level);
  return u.toString();
}

export function resetLesson(): void {
  const ed = useUi.getState().education;
  if (!ed || !stageStates[0]) return;
  stageStates.length = 1;
  goToStage(0);
}

export function exitLesson(): void {
  stageStates = [];
  useUi.getState().set({ education: null, lessonLabels: [] });
}

// Loading another world ends the lesson.
onWorldReplaced((keepCamera) => {
  if (!switching && !keepCamera && useUi.getState().education) exitLesson();
});
