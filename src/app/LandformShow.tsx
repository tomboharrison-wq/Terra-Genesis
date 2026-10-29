import { useEffect, useRef, useState } from 'react';
import { useUi } from '../state/uiStore';
import { ACTIVE, FORMATIONS, formationById, GLOSSARY, TIMESCALES, TOPICS, yearsAt, type Formation } from '../education/landforms/content';
import { SCENES } from './landforms/scenes';
import { startLesson } from './educationRunner';
import { Icon } from './icons';

/**
 * Landform Show (Edexcel GCSE Geography A, Topic 1): pick a landform and its formation plays at once,
 * stage by stage, with captions in KS3 or GCSE wording, the processes, and the numbered steps of an
 * exam answer. Animated diagrams of the textbook sequence (or drawn from a tested guided model).
 */
const SPEEDS = [0.25, 0.5, 1, 2, 4, 8, 16];

const fmtYears = (y: number) => (y >= 10000 ? `${Math.round(y / 1000).toLocaleString()},000` : Math.round(y).toLocaleString());

export function LandformShow() {
  const set = useUi((s) => s.set);
  const startId = useUi((s) => s.landformId) ?? FORMATIONS[0].id;
  const seek = useUi((s) => s.landformSeek);
  const [id, setId] = useState(startId);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [level, setLevel] = useState<'ks3' | 'gcse'>('gcse');
  const [exam, setExam] = useState(false);
  const [time, setTime] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const f = formationById(id) ?? FORMATIONS[0];
  const Scene = SCENES[f.id];
  const stageIdx = f.stages.reduce((k, s, i) => (s.at <= t + 1e-6 ? i : k), 0);

  const close = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    set({ dialog: null, landformSeek: null });
  };
  const choose = (fid: string) => {
    setId(fid);
    setT(0);
    setPlaying(true);
    set({ landformId: fid });
  };
  const goStage = (k: number) => {
    const kk = Math.min(f.stages.length - 1, Math.max(0, k));
    setT(f.stages[kk].at + 0.001);
    setPlaying(true);
  };

  // Timeline: t advances with real time × speed; water and ice keep moving while paused.
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      setTime((x) => x + dt);
      if (playing)
        setT((x) => {
          const n = x + (dt * speed) / f.durationS;
          if (n >= 1) {
            setPlaying(false);
            return 1;
          }
          return n;
        });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed, f.durationS]);

  // Scripted seek (tests / teacher links): jump to a point and hold there.
  useEffect(() => {
    if (seek === null || seek === undefined) return;
    setT(seek);
    setPlaying(false);
  }, [seek]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (e.key === ' ') {
        e.preventDefault();
        if (t >= 1) {
          setT(0);
          setPlaying(true);
        } else setPlaying((p) => !p);
      } else if (e.key === 'ArrowRight') goStage(stageIdx + 1);
      else if (e.key === 'ArrowLeft') goStage(stageIdx - 1);
      else if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  });

  const present = () => {
    const el = root.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen?.();
  };
  const copyLink = () => {
    const u = new URL(location.href);
    u.search = `?landform=${f.id}`;
    void navigator.clipboard?.writeText(u.toString());
    useUi.getState().toast('Link copied: it opens this landform straight away', 'success');
  };

  return (
    <div className="lf-show" ref={root} role="dialog" aria-modal="true" aria-label="Landform formation">
      <header className="lf-head">
        <div className="lf-title">
          <b>Landform formation</b>
          <span>Edexcel GCSE Geography A · Component 1, Topic 1</span>
        </div>
        <div className="seg" role="group" aria-label="Wording level">
          <button className={level === 'ks3' ? 'active' : ''} onClick={() => setLevel('ks3')}>
            KS3
          </button>
          <button className={level === 'gcse' ? 'active' : ''} onClick={() => setLevel('gcse')}>
            GCSE
          </button>
        </div>
        <button onClick={copyLink} title="Copy a link that opens this landform">
          Copy link
        </button>
        <button onClick={present} title="Full screen for the projector">
          Present
        </button>
        <button className="icon ghost" onClick={close} aria-label="Close">
          <Icon name="close" size={20} />
        </button>
      </header>
      <nav className="lf-index" aria-label="Landforms">
        {TOPICS.map((tp) => (
          <section key={tp.id}>
            <h3>
              {tp.title} <small>{tp.spec}</small>
            </h3>
            {FORMATIONS.filter((x) => x.topic === tp.id).map((x) => (
              <button key={x.id} className={`lf-item ${x.id === f.id ? 'active' : ''}`} onClick={() => choose(x.id)} aria-pressed={x.id === f.id}>
                <span className="lf-item-title">{x.title}</span>
                <span className="lf-item-spec">{x.spec}</span>
              </button>
            ))}
          </section>
        ))}
      </nav>
      <main className="lf-main">
        <div className="lf-stage">
          <Scene t={t} time={time} />
          <span className={`lf-badge ${f.source}`}>
            {f.source === 'model' ? 'Drawn from a tested guided model' : 'Animated diagram · simplified, not to scale'}
          </span>
        </div>
        <div className="lf-under">
          <Caption f={f} stageIdx={stageIdx} level={level} />
          <div className="lf-clock" aria-live="off">
            <b>Approx. year {fmtYears(yearsAt(f.id, t))}</b>
            <span>
              teaching time-lapse {speed}× · ≈ {fmtYears(yearsAt(f.id, 1))} years in {Math.round(f.durationS / speed)} s
            </span>
            <small>{TIMESCALES[f.id]?.note}</small>
          </div>
        </div>
        <div className="lf-controls">
          <button onClick={() => goStage(stageIdx - 1)} aria-label="Previous step" disabled={stageIdx === 0}>
            ◀
          </button>
          <button
            className="lf-play"
            onClick={() => {
              if (t >= 1) {
                setT(0);
                setPlaying(true);
              } else setPlaying((p) => !p);
            }}
          >
            {t >= 1 ? '↻ Play again' : playing ? '❚❚ Pause' : '▶ Play'}
          </button>
          <button onClick={() => goStage(stageIdx + 1)} aria-label="Next step" disabled={stageIdx === f.stages.length - 1}>
            ▶
          </button>
          <div className="lf-timeline">
            <input
              type="range"
              min={0}
              max={1000}
              value={Math.round(t * 1000)}
              aria-label="Formation timeline"
              onChange={(e) => {
                setT(+e.target.value / 1000);
                setPlaying(false);
              }}
            />
            {f.stages.map((s, k) => (
              <i key={k} style={{ left: `${s.at * 100}%` }} className={k <= stageIdx ? 'done' : ''} />
            ))}
          </div>
          <label className="lf-speed">
            Time-lapse
            <select value={speed} onChange={(e) => setSpeed(+e.target.value)} aria-label="Time-lapse speed">
              {SPEEDS.map((s) => (
                <option key={s} value={s}>
                  {s}× {s === 1 ? `(${f.durationS} s)` : ''}
                </option>
              ))}
            </select>
          </label>
          <button className={exam ? 'active-toggle' : ''} onClick={() => setExam((x) => !x)}>
            Exam answer
          </button>
          {f.lesson && (
            <button
              onClick={() => {
                close();
                startLesson(f.lesson!);
              }}
              title="Open the Education Mode lesson for this landform"
            >
              Explore in the simulator
            </button>
          )}
          {f.modelLesson && (
            <button
              onClick={() => {
                close();
                startLesson(f.modelLesson!);
              }}
              title="Watch this landform form over geological time in the landscape model (real simulated erosion, labels measured on the landscape)"
            >
              Watch it form (landscape model)
            </button>
          )}
        </div>
      </main>
      {exam && (
        <aside className="lf-exam" aria-label="Exam answer">
          <h3>Explain the formation of {f.landforms.slice(0, 3).join(', ')}</h3>
          <ol>
            {f.examSteps.map((s, k) => (
              <li key={k}>{s}</li>
            ))}
          </ol>
          <p className="hint small">Use the key terms: {f.processes.join(', ')}.</p>
        </aside>
      )}
    </div>
  );
}

function Caption({ f, stageIdx, level }: { f: Formation; stageIdx: number; level: 'ks3' | 'gcse' }) {
  const s = f.stages[stageIdx];
  const active = ACTIVE[f.id]?.[stageIdx] ?? [];
  const [term, setTerm] = useState<string | null>(null);
  return (
    <div className="lf-caption" aria-live="polite">
      <div className="lf-step">
        Step {stageIdx + 1} of {f.stages.length} · {f.view}
      </div>
      <h2>{s.title}</h2>
      <p>{level === 'ks3' ? s.ks3 : s.gcse}</p>
      <div className="lf-chips">
        <span className="lf-chips-label">{active.length ? 'Happening now:' : 'Processes:'}</span>
        {f.processes.map((p) => (
          <button
            key={p}
            className={`lf-chip ${active.includes(p) ? 'on' : ''} ${term === p ? 'open' : ''}`}
            onClick={() => setTerm(term === p ? null : p)}
            title="What is this?"
          >
            {p}
          </button>
        ))}
      </div>
      {term && (
        <p className="lf-def">
          <b>{term[0].toUpperCase() + term.slice(1)}:</b> {GLOSSARY[term]}
        </p>
      )}
    </div>
  );
}
