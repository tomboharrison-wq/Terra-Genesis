import { useEffect, useRef, useState } from 'react';
import { useUi } from '../state/uiStore';
import { Dialog } from './Dialog';
import { LESSONS, lessonById } from '../education/lessons';
import type { LessonModule } from '../education/types';
import { exitLesson, goToStage, lessonLink, resetLesson, startLesson } from './educationRunner';
import { printLessonSheet } from './lessonSheet';
import { getScene } from './runtime';
import { MeanderView, WaterfallView } from './GuidedRiver';
import { ArchLessonView, ShorelineLessonView } from './CoastalLessons';
import { RidgeView, TroughView } from './GuidedGlacial';
import { FoldSection } from './FoldLab';
import { foldGeometry } from '../local/folds/model';
import { foldStage } from '../education/lessons/tectonics';
import { STAGE_ORDER } from '../local/arch/model';

const MODULES: Record<LessonModule, string> = {
  rivers: 'Rivers',
  coasts: 'Coasts',
  tectonics: 'Tectonics',
  volcanoes: 'Volcanoes',
  glaciation: 'Glaciation',
};

/** Lesson picker (spec G2). */
export function LessonsDialog() {
  const close = () => useUi.getState().set({ dialog: null });
  const groups = [...new Set(LESSONS.map((l) => l.module))];
  return (
    <Dialog title="Education Mode — lessons" onClose={close}>
      <p className="hint small tight">
        Classroom lessons for KS3 and GCSE (Edexcel A). Each one opens its own world in a full-screen classroom layout with large text and step-by-step stages.
        Starting a lesson replaces the current world — Save first if you want to keep it.
      </p>
      {groups.map((g) => (
        <div key={g}>
          <h3>{MODULES[g]}</h3>
          <ul className="challenge-list">
            {LESSONS.filter((l) => l.module === g).map((l) => (
              <li key={l.id}>
                <div>
                  <b>{l.title}</b> <span className={`mode-badge ${l.kind}`}>{l.kind === 'emergent' ? 'Simulation' : 'Guided model'}</span>
                  <p className="small">{l.objective}</p>
                </div>
                <button className="primary" onClick={() => startLesson(l.id)}>
                  Start
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </Dialog>
  );
}

/** Lesson panel in classroom layout (spec G3/G4): stage text, KS3/GCSE, labels, answers, stage controls. */
export function LessonPanel() {
  const ed = useUi((s) => s.education);
  const set = useUi((s) => s.set);
  const [exam, setExam] = useState(false);
  const active = ed !== null && !ed.hidePanel;
  useEffect(() => {
    // Centre the landscape in the part of the view not covered by this panel.
    getScene()?.setViewInsetLeft(active ? Math.min(480, window.innerWidth * 0.4) : 0);
    return () => getScene()?.setViewInsetLeft(0);
  }, [active]);
  const lesson = ed && lessonById(ed.lessonId);
  if (!ed || !lesson) return null;
  if (ed.hidePanel)
    return (
      <button className="lesson-show-panel primary" onClick={() => set({ education: { ...ed, hidePanel: false } })}>
        Show lesson panel
      </button>
    );
  const st = lesson.stages[ed.stage];
  const last = ed.stage === lesson.stages.length - 1;
  const upd = (p: Partial<typeof ed>) => set({ education: { ...ed, ...p } });
  return (
    <aside className="lesson-panel" aria-label="Lesson">
      <div className="lesson-head">
        <span className="muted">{MODULES[lesson.module]}</span>
        <span
          className={`mode-badge ${lesson.kind}`}
          title={
            lesson.kind === 'emergent'
              ? 'This landscape and its changes come from the simulation’s physics.'
              : 'A controlled demonstration of the process, not formed by the simulation.'
          }
        >
          {lesson.kind === 'emergent' ? 'Simulation' : 'Guided model'}
        </span>
        <button className="ghost small" onClick={exitLesson}>
          Exit lesson
        </button>
      </div>
      <h2>{lesson.title}</h2>
      {ed.stage === 0 && <p className="objective">{lesson.objective}</p>}
      <div className="stage-count">
        Stage {ed.stage + 1} of {lesson.stages.length}
      </div>
      <h3 className="stage-title">{st.title}</h3>
      <div className="seg level" role="group" aria-label="Explanation level">
        <button className={ed.level === 'ks3' ? 'active' : ''} onClick={() => upd({ level: 'ks3' })}>
          KS3
        </button>
        <button className={ed.level === 'gcse' ? 'active' : ''} onClick={() => upd({ level: 'gcse' })}>
          GCSE
        </button>
      </div>
      <p className="stage-text">{ed.level === 'ks3' ? st.ks3 : st.gcse}</p>
      {st.predict && !ed.answer && <p className="predict">Predict: {st.predict}</p>}
      {lesson.geological && ed.recorded?.includes(ed.stage) && !ed.busy && (
        <p className="muted small recorded-note" title="This stage was run ahead of time with exactly this model and starting landscape, then saved, so it appears at once. Open the lesson with ?recorded=0 in the address to run every stage live.">
          Shown from a recorded run of this same model (instant).
        </p>
      )}
      <div className="row wrap presentation" aria-label="Presentation">
        <button className="small" onClick={() => upd({ big: !ed.big })} aria-pressed={!!ed.big} title="Larger text for projectors">
          {ed.big ? 'Normal text' : 'Bigger text'}
        </button>
        <button className="small" onClick={() => upd({ contrast: !ed.contrast })} aria-pressed={!!ed.contrast} title="Solid black and white panel">
          {ed.contrast ? 'Normal colours' : 'High contrast'}
        </button>
        <button className="small" onClick={() => upd({ hidePanel: true })} title="Hide this panel and show only the map or model">
          Hide panel
        </button>
        <button
          className="small"
          title="Copy a link that opens this lesson at this stage"
          onClick={() => {
            const link = lessonLink();
            void navigator.clipboard?.writeText(link).then(
              () => useUi.getState().toast('Link to this stage copied', 'success'),
              () => useUi.getState().toast(link, 'info'),
            );
          }}
        >
          Copy link to this stage
        </button>
        <button
          className="small"
          title="Print a worksheet: every stage's text at this level, the picture and measurements of each stage shown so far, space to predict and the exam question"
          onClick={() => printLessonSheet(lesson, ed.level, false)}
        >
          Print worksheet
        </button>
        <button className="small" title="The same worksheet with the model answer and common mistake (teacher copy)" onClick={() => printLessonSheet(lesson, ed.level, true)}>
          Print with answers
        </button>
      </div>
      <div className="row wrap">
        <button className="small" onClick={() => upd({ labels: !ed.labels })} aria-pressed={ed.labels}>
          {ed.labels ? 'Hide labels' : 'Show labels'}
        </button>
        {st.predict && (
          <button className="small" onClick={() => upd({ answer: !ed.answer })} aria-pressed={ed.answer}>
            {ed.answer ? 'Hide answer' : 'Show answer'}
          </button>
        )}
      </div>
      <div className="lesson-nav">
        <button onClick={() => goToStage(ed.stage - 1)} disabled={ed.stage === 0 || ed.busy}>
          ◀ Previous
        </button>
        <button onClick={resetLesson} disabled={ed.busy}>
          Reset
        </button>
        <button className="primary" onClick={() => goToStage(ed.stage + 1)} disabled={last || ed.busy}>
          {ed.busy ? 'Running…' : 'Next ▶'}
        </button>
      </div>
      {last && lesson.exam && (
        <div className="exam">
          <button className="small" onClick={() => setExam(!exam)}>
            {exam ? 'Hide exam question' : 'Exam question'}
          </button>
          {exam && (
            <>
              <p>
                <b>Q.</b> {lesson.exam.question}
              </p>
              <details>
                <summary>Model answer</summary>
                <p>{lesson.exam.model}</p>
              </details>
              {lesson.misconception && (
                <details>
                  <summary>Common mistake</summary>
                  <p>
                    <b>Not quite:</b> {lesson.misconception.wrong}
                  </p>
                  <p>
                    <b>Better:</b> {lesson.misconception.right}
                  </p>
                </details>
              )}
            </>
          )}
        </div>
      )}
    </aside>
  );
}

/** Lesson labels pinned to world positions, moved every frame with the camera. */
export function LessonLabels() {
  const ed = useUi((s) => s.education);
  const labels = useUi((s) => s.lessonLabels);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const scene = getScene();
    if (!scene || !ref.current) return;
    const place = () => {
      const kids = ref.current?.children;
      if (!kids) return;
      // Place labels bottom-up; a label that would overlap one already placed is lifted on a longer
      // stem, so every label stays readable and still points at its exact spot.
      const placed: { x0: number; x1: number; y0: number; y1: number }[] = [];
      const items = labels.map((l, k) => ({
        k,
        p: scene.project(l.xM, l.yM, 0),
        w: (kids[k] as HTMLElement | undefined)?.firstElementChild?.clientWidth ?? 120,
      }));
      items.sort((a, b) => (b.p?.y ?? 0) - (a.p?.y ?? 0));
      for (const { k, p, w } of items) {
        const el = kids[k] as HTMLElement | undefined;
        if (!el) continue;
        if (!p) {
          el.style.display = 'none';
          continue;
        }
        const h = 36;
        let lift = 0;
        const box = () => ({
          x0: p.x - w / 2 - 4,
          x1: p.x + w / 2 + 4,
          y0: p.y - 18 - lift - h,
          y1: p.y - 18 - lift,
        });
        while (
          lift < 400 &&
          placed.some((q) => {
            const b = box();
            return b.x0 < q.x1 && b.x1 > q.x0 && b.y0 < q.y1 && b.y1 > q.y0;
          })
        )
          lift += h + 4;
        placed.push(box());
        el.style.display = '';
        el.style.setProperty('--lift', `${lift}px`);
        el.style.transform = `translate(${p.x}px, ${p.y}px)`;
      }
    };
    place();
    return scene.addFrameListener(place);
  }, [labels]);
  if (!ed || !ed.labels) return null;
  return (
    <div className="lesson-labels" ref={ref} aria-hidden="false">
      {labels.map((l, k) => (
        <div key={k} className={`lesson-label ${l.answer && !ed.answer ? 'hidden-answer' : ''}`}>
          <span>{l.answer && !ed.answer ? '?' : l.text}</span>
        </div>
      ))}
    </div>
  );
}

/** Guided-model lessons: the model view (animated between stage times) covers the map beside the panel. */
export function GuidedStage() {
  const ed = useUi((s) => s.education);
  const lesson = ed && lessonById(ed.lessonId);
  const target = lesson?.guided ? (lesson.stages[ed!.stage].t ?? 0) : 0;
  const [shown, setShown] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    if (!lesson?.guided) return;
    const start = performance.now();
    const t0 = from.current;
    const dur = Math.min(4000, 800 + Math.abs(target - t0) * (lesson.guided === 'waterfall' ? 12 : 1500));
    let raf = 0;
    const step = (now: number) => {
      const u = Math.min(1, (now - start) / dur);
      const v = t0 + (target - t0) * (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2);
      from.current = v;
      setShown(v);
      if (u < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, lesson?.guided]);
  if (!ed || !lesson?.guided) return null;
  const st = lesson.stages[ed.stage];
  const labels = ed.labels;
  return (
    <div className="guided-stage">
      {lesson.guided === 'waterfall' ? (
        <WaterfallView years={shown} labels={labels} />
      ) : lesson.guided === 'meander' ? (
        <MeanderView p={shown} labels={labels} section={!!st.section} />
      ) : lesson.guided === 'folds' ? (
        <FoldSection g={foldGeometry(foldStage(shown))} />
      ) : lesson.guided === 'trough' ? (
        <TroughView p={shown} labels={labels} />
      ) : lesson.guided === 'ridge' ? (
        <RidgeView p={shown} labels={labels} />
      ) : lesson.guided === 'arch' ? (
        <ArchLessonView stage={STAGE_ORDER[Math.round(target)]} />
      ) : (
        <ShorelineLessonView layout={lesson.guided === 'spit' ? 'spit' : 'bay'} years={target} />
      )}
      <div className="guided-note">Guided model — a controlled demonstration of the process (illustrative rates), not formed by the simulation.</div>
    </div>
  );
}
