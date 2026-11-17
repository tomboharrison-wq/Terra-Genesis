import { useEffect, useMemo, useState } from 'react';
import { Dialog } from './Dialog';
import { useUi } from '../state/uiStore';
import { engine, getScene, syncSim } from './runtime';
import { cloneWorld, MM_PER_H, type WorldState } from '../engine/world';
import { defaultOptions, generateWorld } from '../terrain/generate';
import { setGeoMode, stepGeo } from './geoRunner';
import {
  INVESTIGATIONS,
  buildEvidenceReport,
  exportEvidenceSheetPng,
  printEvidenceSheetA4,
  type EvidenceStudentMeta,
} from '../education/evidence';
import { TEACHER_SETUPS, type TeacherLessonSetup } from '../education/teacherSetups';
import { MEASURED_VS_TEXTBOOK, MODEL_RELIABILITY, WHY_TIME_ACCELERATION } from '../education/modelReliability';

let savedBaselineWorld: WorldState | null = null;
let savedBeforeImgUrl: string | null = null;
let savedAfterImgUrl: string | null = null;
let savedInvestigationId = 'rivers-meanders';
let savedHypothesis = '';
let savedStudentMeta: EvidenceStudentMeta = {
  studentName: '',
  studentClass: '',
  predictionWhy: '',
  studentExplanation: '',
  selectedMark: 6,
  teacherFeedback: '',
  teacherMark: '',
};
let savedSubmitted = false;

export function EvidenceDialog() {
  const s = useUi();
  const [tab, setTab] = useState<'investigations' | 'teacher' | 'reliability'>('investigations');
  const [peeking, setPeeking] = useState(false);
  const [invId, setInvId] = useState(savedInvestigationId);
  const inv = useMemo(() => INVESTIGATIONS.find((x) => x.id === invId) ?? INVESTIGATIONS[0], [invId]);
  const [hypothesis, setHypothesis] = useState(savedHypothesis || inv.hypotheses[0]);
  const [beforeWorld, setBeforeWorld] = useState<WorldState>(() => savedBaselineWorld ?? cloneWorld(engine.world));
  const [beforeUrl, setBeforeUrl] = useState<string | null>(savedBeforeImgUrl);
  const [afterUrl, setAfterUrl] = useState<string | null>(savedAfterImgUrl);
  const [meta, setMeta] = useState<EvidenceStudentMeta>(savedStudentMeta);
  const [submitted, setSubmitted] = useState(savedSubmitted);
  const [controlVal, setControlVal] = useState<number>(5000);
  const [rev, setRev] = useState(0);

  const updateMeta = (patch: Partial<EvidenceStudentMeta>) => {
    setMeta((prev) => {
      const next = { ...prev, ...patch };
      savedStudentMeta = next;
      return next;
    });
  };

  useEffect(() => {
    savedInvestigationId = invId;
    if (!inv.hypotheses.includes(hypothesis)) {
      const h0 = inv.hypotheses[0];
      setHypothesis(h0);
      savedHypothesis = h0;
    }
    if (inv.topic === 'rivers') setControlVal(5000);
    else if (inv.topic === 'coasts') setControlVal(3.2);
    else if (inv.topic === 'glaciers') setControlVal(-2);
    else if (inv.topic === 'slopes') setControlVal(120);
    else if (inv.topic === 'tectonics') setControlVal(7.4);
    else setControlVal(80);
  }, [invId, inv]);

  useEffect(() => {
    if (!savedBaselineWorld) {
      savedBaselineWorld = cloneWorld(engine.world);
      setBeforeWorld(savedBaselineWorld);
    }
    if (!savedBeforeImgUrl) {
      void getScene()
        ?.captureView()
        .then((blob) => {
          const url = URL.createObjectURL(blob);
          savedBeforeImgUrl = url;
          setBeforeUrl(url);
        })
        .catch(() => {});
    }
  }, []);

  const captureBaseline = async () => {
    const snap = cloneWorld(engine.world);
    savedBaselineWorld = snap;
    setBeforeWorld(snap);
    engine.setReference();
    try {
      const blob = await getScene()?.captureView();
      if (blob) {
        if (savedBeforeImgUrl) URL.revokeObjectURL(savedBeforeImgUrl);
        const url = URL.createObjectURL(blob);
        savedBeforeImgUrl = url;
        setBeforeUrl(url);
      }
    } catch {
      // ignore in headless/non-canvas environments
    }
    s.toast('Captured "Before" baseline snapshot and view image', 'success');
    setRev((r) => r + 1);
  };

  const captureAfterView = async () => {
    try {
      const blob = await getScene()?.captureView();
      if (blob) {
        if (savedAfterImgUrl) URL.revokeObjectURL(savedAfterImgUrl);
        const url = URL.createObjectURL(blob);
        savedAfterImgUrl = url;
        setAfterUrl(url);
      }
    } catch {
      // ignore
    }
    setRev((r) => r + 1);
  };

  const setupRecommendedWorld = async (customSeed?: number) => {
    const size = s.classroom ? 128 : 256;
    if (inv.topic === 'rivers') {
      const w = generateWorld(defaultOptions('river-delta', customSeed ?? 777, size));
      engine.replaceWorld(w);
      setGeoMode(true);
      engine.enableLowlandMeander();
    } else if (inv.topic === 'coasts') {
      const w = generateWorld(defaultOptions('coastal-headland', customSeed ?? 5, size));
      engine.replaceWorld(w);
    } else if (inv.topic === 'glaciers') {
      const w = generateWorld(defaultOptions('alpine-glaciers', customSeed ?? 12, size));
      engine.replaceWorld(w);
    } else if (inv.topic === 'slopes') {
      const w = generateWorld(defaultOptions('plateau', customSeed ?? 31, size));
      engine.replaceWorld(w);
    } else if (inv.topic === 'tectonics') {
      const w = generateWorld(defaultOptions('mountain-range', customSeed ?? 9, size));
      w.tectonics.enabled = true;
      engine.replaceWorld(w);
    } else {
      const w = generateWorld(defaultOptions('rain-shadow', customSeed ?? 19, size));
      engine.replaceWorld(w);
    }
    syncSim();
    await new Promise((r) => setTimeout(r, 80));
    await captureBaseline();
  };

  const launchTeacherSetup = async (setup: TeacherLessonSetup) => {
    setInvId(setup.investigationId);
    savedInvestigationId = setup.investigationId;
    const size = s.classroom ? 128 : 256;
    const w = generateWorld(defaultOptions(setup.presetId, setup.seed, size));
    w.meta.name = `${setup.title.replace(/^\d+\.\s*/, '')} (Seed ${setup.seed})`;
    engine.replaceWorld(w);
    if (setup.presetId === 'river-delta') {
      setGeoMode(true);
      engine.enableLowlandMeander();
    } else if (setup.presetId === 'coastal-headland') {
      engine.world.coast.wavesOn = true;
    } else if (setup.presetId === 'alpine-glaciers') {
      engine.setClimateParams({ enabled: true, seaLevelTempC: -1 });
      engine.setGlacierParams({ enabled: true, slidingCoupling: 3, aspectBalance: 0.3, maxErosionMmYr: 10 });
    } else if (setup.presetId === 'rain-shadow') {
      engine.setClimateParams({ enabled: true });
    }
    syncSim();
    await new Promise((r) => setTimeout(r, 80));
    await captureBaseline();
    setTab('investigations');
    s.toast(`Loaded Teacher Setup: ${setup.title} (Fixed Seed ${setup.seed})`, 'success');
  };

  const runQuickStep = async () => {
    if (inv.topic === 'rivers') {
      if (!s.geo.mode) setGeoMode(true);
      if (!engine.geoMeander) engine.enableLowlandMeander();
      engine.geoStep(Math.max(1000, Math.round(controlVal)));
      s.set({ terrainOverlay: 'change' });
    } else if (inv.topic === 'coasts') {
      engine.world.coast.wavesOn = true;
      engine.world.coast.waveHeightM = Math.max(0.5, Math.min(6, controlVal));
      engine.geoStep(3000);
      s.set({ terrainOverlay: 'waves' });
    } else if (inv.topic === 'glaciers') {
      engine.setClimateParams({ enabled: true, seaLevelTempC: Math.max(-8, Math.min(4, controlVal)) });
      engine.setGlacierParams({ enabled: true, slidingCoupling: 3, aspectBalance: 0.3, maxErosionMmYr: 10 });
      engine.geoStep(8000);
      s.set({ terrainOverlay: 'glacial' });
    } else if (inv.topic === 'slopes') {
      const w = engine.world;
      w.water.rainMPerS = Math.max(20, Math.min(250, controlVal)) * MM_PER_H;
      engine.advance(600);
      engine.landslide((w.width * w.cellSizeM) / 2, (w.height * w.cellSizeM) / 2, w.width * w.cellSizeM * 0.28);
      s.set({ terrainOverlay: 'change' });
    } else if (inv.topic === 'tectonics') {
      const w = engine.world;
      engine.earthquake({
        xM: (w.width * w.cellSizeM) / 2,
        yM: (w.height * w.cellSizeM) / 2,
        mw: Math.max(5.5, Math.min(8.4, controlVal)),
        type: 'reverse',
        strikeDeg: 45,
        landslides: true,
      });
      s.set({ terrainOverlay: 'shaking' });
    } else {
      engine.setClimateParams({ enabled: true });
      engine.world.water.rainMPerS = Math.max(10, Math.min(200, controlVal)) * MM_PER_H;
      engine.advance(1800);
      s.set({ terrainOverlay: 'rainfall' });
    }
    syncSim();
    await new Promise((r) => setTimeout(r, 60));
    await captureAfterView();
  };

  const report = useMemo(() => {
    void rev;
    return buildEvidenceReport(beforeWorld, engine, invId, hypothesis);
  }, [beforeWorld, invId, hypothesis, rev, s.sim?.simTimeS, s.geo.years]);

  // Detect which GCSE vocabulary terms the student has used in their written explanation
  const usedVocabSet = useMemo(() => {
    const text = (meta.studentExplanation ?? '').toLowerCase();
    const used = new Set<string>();
    for (const v of inv.vocabulary) {
      const root = v.term.split('(')[0].trim().toLowerCase();
      if (root && text.includes(root)) used.add(v.term);
    }
    return used;
  }, [meta.studentExplanation, inv.vocabulary]);

  // Cross-section SVG helpers
  const pts = report.profile;
  let zLo = Infinity;
  let zHi = -Infinity;
  for (const p of pts) {
    zLo = Math.min(zLo, p.beforeM, p.afterM);
    zHi = Math.max(zHi, p.beforeM, p.afterM);
  }
  const zSpan = Math.max(5, zHi - zLo);
  zLo -= zSpan * 0.1;
  zHi += zSpan * 0.1;
  const dMax = Math.max(1, pts[pts.length - 1]?.distM ?? 1);
  const svgW = 420;
  const svgH = 140;
  const px = (d: number) => 36 + (d / dMax) * (svgW - 48);
  const py = (z: number) => 12 + (1 - (z - zLo) / (zHi - zLo)) * (svgH - 30);
  const beforePath = pts.map((p, k) => `${k ? 'L' : 'M'}${px(p.distM).toFixed(1)},${py(p.beforeM).toFixed(1)}`).join('');
  const afterPath = pts.map((p, k) => `${k ? 'L' : 'M'}${px(p.distM).toFixed(1)},${py(p.afterM).toFixed(1)}`).join('');

  // Minimized "Peek at 3D Map" bar so students can inspect the 3D world without losing their work
  if (peeking) {
    return (
      <div
        style={{
          position: 'fixed',
          top: 64,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 40,
          background: 'var(--panel-solid)',
          border: '2px solid var(--scouts-yellow)',
          borderRadius: 10,
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          boxShadow: '0 8px 30px rgba(0,0,0,0.55)',
        }}
      >
        <span style={{ fontWeight: 700, color: 'var(--scouts-yellow)' }}>
          🔍 Inspecting 3D Landforms: {inv.title} ({report.elapsedText})
        </span>
        <span className="small" style={{ color: 'var(--muted)' }}>
          Drag to orbit · Scroll to zoom · Hover to measure
        </span>
        <button
          className="small"
          style={{ background: 'var(--scouts-yellow)', color: '#1b2a12', fontWeight: 700 }}
          onClick={() => {
            void captureAfterView();
            setPeeking(false);
          }}
        >
          📋 Return to GCSE Evidence Worksheet
        </button>
      </div>
    );
  }

  const controlLabel =
    inv.topic === 'rivers'
      ? { label: 'Geological Duration to Run (years)', min: 1000, max: 20000, step: 1000 }
      : inv.topic === 'coasts'
        ? { label: 'Significant Wave Height H_s (m)', min: 0.5, max: 5.5, step: 0.5 }
        : inv.topic === 'glaciers'
          ? { label: 'Ice-Age Sea-Level Temp (°C)', min: -6, max: 2, step: 0.5 }
          : inv.topic === 'slopes'
            ? { label: 'Storm Rainfall Intensity (mm/h)', min: 30, max: 200, step: 10 }
            : inv.topic === 'tectonics'
              ? { label: 'Earthquake Magnitude (M_w)', min: 6.0, max: 8.2, step: 0.2 }
              : { label: 'Prevailing Moisture Rainfall (mm/h)', min: 20, max: 160, step: 10 };

  return (
    <Dialog title="GCSE Classroom Investigations, Teacher Setups & Evidence Lab" onClose={() => s.set({ dialog: null })} wide>
      <div className="evidence-lab" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Top Mode Tabs + Peek at 3D Map button */}
        <div className="row" style={{ gap: 6, flexWrap: 'wrap', borderBottom: '1px solid var(--panel-border)', paddingBottom: 8 }}>
          <button
            className={tab === 'investigations' ? 'active-toggle small' : 'small'}
            onClick={() => setTab('investigations')}
          >
            🔬 1. Student Investigations (6 Topics)
          </button>
          <button
            className={tab === 'teacher' ? 'active-toggle small' : 'small'}
            onClick={() => setTab('teacher')}
          >
            👩‍🏫 2. Teacher Lesson Setups (7 Fixed Seeds)
          </button>
          <button
            className={tab === 'reliability' ? 'active-toggle small' : 'small'}
            onClick={() => setTab('reliability')}
          >
            🛡 3. How Reliable Is This Model? (Scientific Trust)
          </button>
          <button
            className="small ghost"
            style={{ marginLeft: 'auto', borderColor: 'var(--scouts-yellow)', color: 'var(--scouts-yellow)' }}
            onClick={() => setPeeking(true)}
            title="Temporarily minimize this worksheet so you can orbit and inspect the 3D landscape and labels"
          >
            🔍 Peek at 3D Map &amp; Labels
          </button>
        </div>

        {/* TAB 2: TEACHER LESSON MODE (M17-C03) */}
        {tab === 'teacher' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ background: 'rgba(255, 230, 39, 0.1)', border: '1px solid rgba(255, 230, 39, 0.35)', padding: 10, borderRadius: 6 }}>
              <b style={{ color: 'var(--scouts-yellow)' }}>Teacher Lesson Mode — Deterministic Fixed-Seed Setups (25-Minute Lesson Plans)</b>
              <div className="small" style={{ marginTop: 4 }}>
                Every setup below uses a fixed random seed so every student laptop or classroom projector generates the exact same starting terrain, rock strata, and expected measurements.
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 12 }}>
              {TEACHER_SETUPS.map((ts) => (
                <div
                  key={ts.id}
                  style={{
                    background: 'rgba(0,0,0,0.24)',
                    border: '1px solid var(--panel-border)',
                    borderRadius: 8,
                    padding: 12,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <div>
                      <b style={{ fontSize: 14, color: 'var(--scouts-yellow)' }}>{ts.title}</b>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>{ts.specRef} · Fixed Seed: {ts.seed}</div>
                    </div>
                    <button
                      className="small"
                      style={{ background: 'var(--scouts-green)', color: '#0b1912', fontWeight: 700 }}
                      onClick={() => void launchTeacherSetup(ts)}
                    >
                      ▶ Launch Setup
                    </button>
                  </div>
                  <div style={{ fontSize: 12 }}>
                    <b>Learning Objectives:</b>
                    <ul style={{ margin: '3px 0 0 16px', padding: 0 }}>
                      {ts.learningObjectives.map((lo, i) => (
                        <li key={i}>{lo}</li>
                      ))}
                    </ul>
                  </div>
                  <div style={{ fontSize: 11.5, background: 'rgba(0,0,0,0.2)', padding: 6, borderRadius: 4 }}>
                    <b>Lesson Timings (25 min total):</b>
                    {ts.timings.map((tm, i) => (
                      <div key={i}>
                        • <b>{tm.phase} ({tm.minutes} min):</b> {tm.activity}
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: 11.5 }}>
                    <b style={{ color: '#5ce080' }}>Expected Measured Outcomes:</b>
                    <ul style={{ margin: '3px 0 0 16px', padding: 0 }}>
                      {ts.expectedOutcomes.map((eo, i) => (
                        <li key={i}>{eo}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: SCIENTIFIC TRUST / MODEL RELIABILITY (M17-C05) */}
        {tab === 'reliability' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 10 }}>
              <div style={{ background: 'rgba(37, 183, 85, 0.12)', border: '1px solid rgba(37, 183, 85, 0.4)', padding: 10, borderRadius: 6 }}>
                <b style={{ color: '#5ce080' }}>{MEASURED_VS_TEXTBOOK.measuredBadge}</b>
                <p className="small" style={{ margin: '4px 0 0 0' }}>{MEASURED_VS_TEXTBOOK.measuredExplanation}</p>
              </div>
              <div style={{ background: 'rgba(0, 109, 223, 0.14)', border: '1px solid rgba(0, 109, 223, 0.45)', padding: 10, borderRadius: 6 }}>
                <b style={{ color: '#8fc5ff' }}>{MEASURED_VS_TEXTBOOK.textbookBadge}</b>
                <p className="small" style={{ margin: '4px 0 0 0' }}>{MEASURED_VS_TEXTBOOK.textbookExplanation}</p>
              </div>
            </div>

            <div style={{ background: 'rgba(0,0,0,0.22)', padding: 10, borderRadius: 6 }}>
              <b style={{ color: 'var(--scouts-yellow)' }}>Why Time Acceleration Is Used in Classroom Simulation</b>
              <ul className="small" style={{ margin: '6px 0 0 18px', padding: 0 }}>
                {WHY_TIME_ACCELERATION.map((line, i) => (
                  <li key={i} style={{ marginBottom: 4 }}>{line}</li>
                ))}
              </ul>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table className="values" style={{ width: '100%', fontSize: 12 }}>
                <thead>
                  <tr>
                    <th>Topic</th>
                    <th>Processes Physically Simulated</th>
                    <th>Processes Simplified</th>
                    <th>SI Units &amp; Timescale</th>
                    <th>Real-World UK / Global Range</th>
                    <th>Peer-Reviewed Equation Sources</th>
                  </tr>
                </thead>
                <tbody>
                  {MODEL_RELIABILITY.map((row, idx) => (
                    <tr key={idx}>
                      <td><b>{row.topic}</b></td>
                      <td>{row.simulated}</td>
                      <td>{row.simplified}</td>
                      <td>{row.unitsAndTimescale}</td>
                      <td>{row.realWorldRange}</td>
                      <td><i>{row.equationSource}</i></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 1: STUDENT INVESTIGATIONS & GCSE ANSWER SUPPORT (M17-C01, C02, C04) */}
        {tab === 'investigations' && (
          <>
            {/* Student Name, Class & Topic Selector */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8, alignItems: 'end', background: 'rgba(0,0,0,0.18)', padding: 10, borderRadius: 6 }}>
              <label>
                <span className="field-label"><b>Student Name</b></span>
                <input
                  type="text"
                  placeholder="e.g. Alex Taylor"
                  value={meta.studentName ?? ''}
                  onChange={(e) => updateMeta({ studentName: e.target.value })}
                />
              </label>
              <label>
                <span className="field-label"><b>Class / Set</b></span>
                <input
                  type="text"
                  placeholder="e.g. 10B / Geog 1"
                  value={meta.studentClass ?? ''}
                  onChange={(e) => updateMeta({ studentClass: e.target.value })}
                />
              </label>
              <label style={{ gridColumn: 'span 2' }}>
                <span className="field-label">
                  <b>1. Choose GCSE Investigation ({inv.estimatedMinutes})</b>
                </span>
                <select
                  value={invId}
                  onChange={(e) => setInvId(e.target.value)}
                  aria-label="Investigation topic"
                >
                  {INVESTIGATIONS.map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.title}
                    </option>
                  ))}
                </select>
              </label>
              <div className="row" style={{ gap: 6 }}>
                <button className="small" onClick={() => void setupRecommendedWorld()} title={inv.setupHint}>
                  Launch preset
                </button>
                <button className="small ghost" onClick={() => void captureBaseline()}>
                  Reset Before
                </button>
              </div>
            </div>

            {/* Step 1 & 2: Enquiry Question, Predict & Inline Run Control */}
            <div style={{ background: 'rgba(0,0,0,0.22)', padding: 12, borderRadius: 6 }}>
              <div style={{ fontWeight: 700, color: 'var(--scouts-yellow)', fontSize: 14, marginBottom: 4 }}>
                Enquiry Question: {inv.question}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 8, marginBottom: 8, fontSize: 12 }}>
                <div style={{ background: 'rgba(255,255,255,0.04)', padding: '6px 8px', borderRadius: 4 }}>
                  <b style={{ color: '#8fc5ff' }}>🎛 What to change:</b> {inv.whatToChange}
                </div>
                <div style={{ background: 'rgba(255,255,255,0.04)', padding: '6px 8px', borderRadius: 4 }}>
                  <b style={{ color: '#5ce080' }}>👁 What to observe:</b> {inv.whatToObserve}
                </div>
              </div>

              <label className="field" style={{ marginTop: 4 }}>
                <span className="field-label">
                  <b>2. Predict — {inv.predictionPrompt}</b>
                </span>
                <select
                  value={inv.hypotheses.includes(hypothesis) ? hypothesis : '__custom'}
                  onChange={(e) => {
                    if (e.target.value !== '__custom') {
                      setHypothesis(e.target.value);
                      savedHypothesis = e.target.value;
                    }
                  }}
                  style={{ width: '100%', marginBottom: 6 }}
                >
                  {inv.hypotheses.map((h, idx) => (
                    <option key={idx} value={h}>
                      Prediction {idx + 1}: {h.slice(0, 105)}…
                    </option>
                  ))}
                </select>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <input
                    type="text"
                    value={hypothesis}
                    onChange={(e) => {
                      setHypothesis(e.target.value);
                      savedHypothesis = e.target.value;
                    }}
                    aria-label="Hypothesis statement"
                    placeholder="Edit or write your own hypothesis..."
                  />
                  <input
                    type="text"
                    value={meta.predictionWhy ?? ''}
                    onChange={(e) => updateMeta({ predictionWhy: e.target.value })}
                    placeholder="Why do you predict this? (Because...)"
                    aria-label="Prediction justification"
                  />
                </div>
              </label>

              {/* Inline Parameter Slider + Run Button */}
              <div className="row" style={{ marginTop: 10, gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, background: 'rgba(0,0,0,0.28)', padding: '4px 10px', borderRadius: 6 }}>
                  <span><b>{controlLabel.label}:</b> {controlVal}</span>
                  <input
                    type="range"
                    min={controlLabel.min}
                    max={controlLabel.max}
                    step={controlLabel.step}
                    value={controlVal}
                    onChange={(e) => setControlVal(+e.target.value)}
                    style={{ width: 110 }}
                  />
                </label>
                <button
                  style={{ background: 'var(--scouts-green)', color: '#0b1912', fontWeight: 700 }}
                  onClick={() => void runQuickStep()}
                >
                  3. Generate Evidence Sheet (Run &amp; Measure)
                </button>
                {s.geo.mode && (
                  <button className="small ghost" onClick={() => stepGeo(2000)}>
                    +2,000 Geo Years
                  </button>
                )}
                <button className="small ghost" onClick={() => void captureAfterView()}>
                  Refresh ‘After’ Snapshot ({report.elapsedText})
                </button>
                <button className="small ghost" onClick={() => setPeeking(true)}>
                  🔍 View Landform on 3D Map
                </button>
              </div>
            </div>

            {/* Step 3: Observe Before/After Maps, Annotated Landforms & Cross-Profile */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
              <div style={{ background: 'rgba(0,0,0,0.2)', padding: 10, borderRadius: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <b>3. Observe — Before &amp; After Annotated Maps</b>
                  <span style={{ fontSize: 10.5, color: '#5ce080' }}>{MEASURED_VS_TEXTBOOK.measuredBadge}</span>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, opacity: 0.8, marginBottom: 3 }}>Before (Baseline)</div>
                    {beforeUrl ? (
                      <img src={beforeUrl} alt="Before simulation" style={{ width: '100%', height: 105, objectFit: 'cover', borderRadius: 4 }} />
                    ) : (
                      <div style={{ height: 105, background: '#0d1f18', borderRadius: 4, display: 'grid', placeItems: 'center', fontSize: 12 }}>Baseline ready</div>
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, opacity: 0.8, marginBottom: 3 }}>After ({report.elapsedText})</div>
                    {afterUrl ? (
                      <img src={afterUrl} alt="After simulation" style={{ width: '100%', height: 105, objectFit: 'cover', borderRadius: 4 }} />
                    ) : (
                      <div style={{ height: 105, background: '#0d1f18', borderRadius: 4, display: 'grid', placeItems: 'center', fontSize: 12 }}>
                        Run step to capture
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ marginTop: 6, fontSize: 11.5 }}>
                  <b style={{ color: 'var(--scouts-yellow)' }}>Annotated Landforms Identified:</b>{' '}
                  {report.annotatedLandforms.join(' · ')}
                </div>
              </div>

              <div style={{ background: 'rgba(0,0,0,0.2)', padding: 10, borderRadius: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <b>{report.profileTitle}</b>
                  <span style={{ fontSize: 10.5, color: '#5ce080' }}>{MEASURED_VS_TEXTBOOK.measuredBadge}</span>
                </div>
                <svg width="100%" viewBox={`0 0 ${svgW} ${svgH}`} style={{ marginTop: 6, background: 'rgba(0,0,0,0.18)', borderRadius: 4 }}>
                  <path d={beforePath} fill="none" stroke="#bf62a8" strokeWidth={2} strokeDasharray="4 3" />
                  <path d={afterPath} fill="none" stroke="#d9781c" strokeWidth={2.2} />
                  <text x={40} y={svgH - 6} fill="#bf62a8" fontSize={11}>
                    --- Before ({Math.round(zLo)}–{Math.round(zHi)} m)
                  </text>
                  <text x={200} y={svgH - 6} fill="#d9781c" fontSize={11}>
                    ─── After
                  </text>
                </svg>
              </div>
            </div>

            {/* Step 4: Results Table */}
            <div style={{ background: 'rgba(0,0,0,0.2)', padding: 10, borderRadius: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <b>4. Measure — Quantitative Results Table</b>
                <span style={{ fontSize: 11, color: '#5ce080' }}>{MEASURED_VS_TEXTBOOK.measuredBadge}</span>
              </div>
              <table className="values" style={{ marginTop: 6, width: '100%' }}>
                <thead>
                  <tr>
                    <th>Measured Indicator (SI Units)</th>
                    <th>Before</th>
                    <th>After</th>
                    <th>Measured Change (Δ) &amp; Process Significance</th>
                  </tr>
                </thead>
                <tbody>
                  {report.metrics.map((m, k) => (
                    <tr key={k}>
                      <td>{m.label}</td>
                      <td>{m.before}</td>
                      <td>
                        <b>{m.after}</b>
                      </td>
                      <td>{m.change}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Step 5 & 6: GCSE Answer Support (Sentence Starters, Vocabulary Checklist, 4-Mark & 6-Mark Questions, Gated Model Answer) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12 }}>
              <div style={{ background: 'rgba(0,0,0,0.2)', padding: 10, borderRadius: 6, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <b>5. Process Sequence, Vocabulary &amp; Sentence Starters</b>
                  <span style={{ fontSize: 10.5, color: '#8fc5ff' }}>{MEASURED_VS_TEXTBOOK.textbookBadge}</span>
                </div>
                <ol style={{ margin: '2px 0 4px 18px', padding: 0, fontSize: 12, lineHeight: 1.4 }}>
                  {report.processSequence.map((step, k) => (
                    <li key={k} style={{ marginBottom: 3 }}>
                      {step.replace(/^\d+\.\s*/, '')}
                    </li>
                  ))}
                </ol>

                <div>
                  <div style={{ fontSize: 11.5, fontWeight: 700, marginBottom: 4 }}>
                    Process Vocabulary Checklist ({usedVocabSet.size}/{inv.vocabulary.length} used in your answer — hover for definition):
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {inv.vocabulary.map((v) => {
                      const used = usedVocabSet.has(v.term);
                      return (
                        <span
                          key={v.term}
                          title={v.definition}
                          style={{
                            background: used ? 'rgba(37, 183, 85, 0.28)' : 'rgba(255, 230, 39, 0.12)',
                            border: `1px solid ${used ? '#5ce080' : 'rgba(255, 230, 39, 0.4)'}`,
                            borderRadius: 4,
                            padding: '2px 6px',
                            fontSize: 11,
                            cursor: 'help',
                          }}
                        >
                          {used ? '✅' : '○'} {v.term}
                        </span>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 11.5, fontWeight: 700, marginBottom: 4 }}>
                    Click a GCSE Sentence Starter to add it to your answer:
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {inv.sentenceStarters.map((st, idx) => (
                      <button
                        key={idx}
                        className="small ghost"
                        style={{ textAlign: 'left', justifyContent: 'flex-start', whiteSpace: 'normal', fontSize: 11.5, padding: '4px 8px' }}
                        onClick={() => {
                          const cur = meta.studentExplanation ?? '';
                          const sep = cur && !cur.endsWith(' ') ? ' ' : '';
                          updateMeta({ studentExplanation: `${cur}${sep}${st} ` });
                        }}
                      >
                        ➕ “{st}”
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Column: 4-Mark & 6-Mark Question, Student Answer, Gated Model Answer & Exports */}
              <div style={{ background: 'rgba(0,0,0,0.2)', padding: 10, borderRadius: 6, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div className="row" style={{ gap: 6, alignItems: 'center', justifyContent: 'space-between' }}>
                  <b>6. Explain — Write Your GCSE Answer</b>
                  <div className="row" style={{ gap: 4 }}>
                    <button
                      className={meta.selectedMark === 4 ? 'active-toggle small' : 'small'}
                      onClick={() => updateMeta({ selectedMark: 4 })}
                    >
                      4-Mark Explain
                    </button>
                    <button
                      className={meta.selectedMark !== 4 ? 'active-toggle small' : 'small'}
                      onClick={() => updateMeta({ selectedMark: 6 })}
                    >
                      6-Mark Assess/Evaluate
                    </button>
                  </div>
                </div>

                <div style={{ background: 'rgba(255, 230, 39, 0.1)', borderLeft: '3px solid var(--scouts-yellow)', padding: '6px 10px', borderRadius: 4 }}>
                  <div style={{ fontWeight: 700, fontSize: 12.5, color: 'var(--scouts-yellow)' }}>
                    {meta.selectedMark === 4 ? inv.question4Mark : inv.question6Mark}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>
                    💡 <b>Command Word Guidance:</b> {meta.selectedMark === 4 ? inv.commandWord4Mark : inv.commandWord6Mark}
                  </div>
                </div>

                <textarea
                  rows={4}
                  value={meta.studentExplanation ?? ''}
                  onChange={(e) => updateMeta({ studentExplanation: e.target.value })}
                  placeholder="Write your GCSE explanation here using the sentence starters, key vocabulary, and at least two measured numbers from the Results Table..."
                  style={{
                    width: '100%',
                    background: 'rgba(0,0,0,0.32)',
                    border: '1px solid var(--panel-border)',
                    borderRadius: 6,
                    color: 'var(--text)',
                    padding: 8,
                    fontFamily: 'inherit',
                    fontSize: 12.5,
                    resize: 'vertical',
                  }}
                />

                <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                  <button
                    className="small"
                    style={{ background: 'var(--scouts-blue)', color: '#fff', fontWeight: 700 }}
                    onClick={() => {
                      setSubmitted(true);
                      savedSubmitted = true;
                      s.toast('Explanation submitted — Model GCSE Answer unlocked for self-assessment!', 'success');
                    }}
                  >
                    ✓ Submit Explanation &amp; Compare Model Answer
                  </button>
                  {!submitted && (
                    <button
                      className="small ghost"
                      onClick={() => {
                        setSubmitted(true);
                        savedSubmitted = true;
                      }}
                    >
                      Teacher: Unlock Model Answer
                    </button>
                  )}
                </div>

                {/* Model GCSE 4-Mark & 6-Mark Answer Box */}
                <div
                  style={{
                    background: 'rgba(0,0,0,0.26)',
                    padding: 10,
                    borderRadius: 4,
                    borderLeft: '3px solid #5ce080',
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: 12, color: '#5ce080', marginBottom: 4 }}>
                    Model GCSE 6-Mark Exam Paragraph &amp; 4-Mark Reference (with your world’s data):
                  </div>
                  {submitted ? (
                    <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.45 }}>
                      {meta.selectedMark === 4 ? report.modelAnswer4Mark : report.examParagraph}
                    </p>
                  ) : (
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                      🔒 Write your answer above and click <b>“Submit Explanation &amp; Compare Model Answer”</b> to reveal the full-mark model paragraph using your world’s measurements ({report.examParagraph.slice(0, 85)}…).
                    </div>
                  )}
                </div>

                {/* Teacher Feedback & Export Row */}
                <div className="row" style={{ gap: 6 }}>
                  <input
                    type="text"
                    placeholder="Teacher feedback (WWW / EBI)..."
                    value={meta.teacherFeedback ?? ''}
                    onChange={(e) => updateMeta({ teacherFeedback: e.target.value })}
                    style={{ flex: 1, fontSize: 12 }}
                  />
                  <input
                    type="text"
                    placeholder={`Mark /${meta.selectedMark === 4 ? 4 : 6}`}
                    value={meta.teacherMark ?? ''}
                    onChange={(e) => updateMeta({ teacherMark: e.target.value })}
                    style={{ width: 90, fontSize: 12 }}
                  />
                </div>

                <div className="row" style={{ marginTop: 'auto', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    onClick={async () => {
                      await captureAfterView();
                      const blob = await exportEvidenceSheetPng(report, savedBeforeImgUrl, savedAfterImgUrl, meta);
                      const a = document.createElement('a');
                      a.href = URL.createObjectURL(blob);
                      a.download = `${(meta.studentName || report.worldName).replace(/[^\w-]+/g, '_')}-GCSE-evidence.png`;
                      a.click();
                      setTimeout(() => URL.revokeObjectURL(a.href), 1500);
                      s.toast('Downloaded Classroom Evidence Sheet PNG', 'success');
                    }}
                  >
                    ⬇ Download Evidence Sheet (PNG)
                  </button>
                  <button
                    className="small"
                    onClick={async () => {
                      await captureAfterView();
                      printEvidenceSheetA4(report, savedBeforeImgUrl, savedAfterImgUrl, meta);
                    }}
                  >
                    🖨 Print / Save Clean A4 PDF
                  </button>
                  <button
                    className="ghost small"
                    onClick={() => {
                      const text = [
                        `# GCSE Geography Evidence Sheet — ${report.investigation.title}`,
                        `Student: ${meta.studentName || '—'} | Class: ${meta.studentClass || '—'}`,
                        `World: ${report.worldName} (${report.elapsedText})`,
                        `Enquiry Question: ${report.investigation.question}`,
                        `Prediction: ${report.hypothesis}`,
                        '',
                        '## Measured Changes',
                        ...report.metrics.map((m) => `- ${m.label}: ${m.before} → ${m.after} (${m.change})`),
                        '',
                        '## Annotated Landforms',
                        ...report.annotatedLandforms.map((l) => `- ${l}`),
                        '',
                        '## Student Explanation',
                        meta.studentExplanation || '(Not entered)',
                        '',
                        '## Model GCSE Exam Explanation',
                        report.examParagraph,
                      ].join('\n');
                      void navigator.clipboard?.writeText(text);
                      s.toast('Copied GCSE Evidence report to clipboard', 'success');
                    }}
                  >
                    Copy Text
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
}
