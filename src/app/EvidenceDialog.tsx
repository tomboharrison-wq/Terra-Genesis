import { useEffect, useMemo, useState } from 'react';
import { Dialog } from './Dialog';
import { useUi } from '../state/uiStore';
import { engine, getScene, syncSim } from './runtime';
import { cloneWorld, type WorldState } from '../engine/world';
import { defaultOptions, generateWorld } from '../terrain/generate';
import { setGeoMode, stepGeo } from './geoRunner';
import { INVESTIGATIONS, buildEvidenceReport, exportEvidenceSheetPng } from '../education/evidence';

let savedBaselineWorld: WorldState | null = null;
let savedBeforeImgUrl: string | null = null;
let savedAfterImgUrl: string | null = null;
let savedInvestigationId = 'rivers-meanders';
let savedHypothesis = '';

export function EvidenceDialog() {
  const s = useUi();
  const [invId, setInvId] = useState(savedInvestigationId);
  const inv = useMemo(() => INVESTIGATIONS.find((x) => x.id === invId) ?? INVESTIGATIONS[0], [invId]);
  const [hypothesis, setHypothesis] = useState(savedHypothesis || inv.hypotheses[0]);
  const [beforeWorld, setBeforeWorld] = useState<WorldState>(() => savedBaselineWorld ?? cloneWorld(engine.world));
  const [beforeUrl, setBeforeUrl] = useState<string | null>(savedBeforeImgUrl);
  const [afterUrl, setAfterUrl] = useState<string | null>(savedAfterImgUrl);
  const [rev, setRev] = useState(0);

  useEffect(() => {
    savedInvestigationId = invId;
    if (!inv.hypotheses.includes(hypothesis)) {
      const h0 = inv.hypotheses[0];
      setHypothesis(h0);
      savedHypothesis = h0;
    }
  }, [invId, inv]);

  // Capture initial baseline if none exists yet
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

  const setupRecommendedWorld = async () => {
    const size = s.classroom ? 128 : 256;
    if (inv.topic === 'rivers') {
      const w = generateWorld(defaultOptions('river-delta', 777, size));
      engine.replaceWorld(w);
      setGeoMode(true);
      engine.enableLowlandMeander();
    } else if (inv.topic === 'coasts') {
      const w = generateWorld(defaultOptions('coastal-headland', 5, size));
      engine.replaceWorld(w);
    } else if (inv.topic === 'glaciers') {
      const w = generateWorld(defaultOptions('alpine-glaciers', 12, size));
      engine.replaceWorld(w);
    } else if (inv.topic === 'slopes') {
      const w = generateWorld(defaultOptions('plateau', 31, size));
      engine.replaceWorld(w);
    } else if (inv.topic === 'tectonics') {
      const w = generateWorld(defaultOptions('mountain-range', 9, size));
      w.tectonics.enabled = true;
      engine.replaceWorld(w);
    } else {
      const w = generateWorld(defaultOptions('rain-shadow', 19, size));
      engine.replaceWorld(w);
    }
    syncSim();
    await new Promise((r) => setTimeout(r, 80));
    await captureBaseline();
  };

  const runQuickStep = async () => {
    if (inv.topic === 'rivers') {
      if (!s.geo.mode) setGeoMode(true);
      if (!engine.geoMeander) engine.enableLowlandMeander();
      engine.geoStep(3000);
    } else if (inv.topic === 'coasts') {
      engine.world.coast.wavesOn = true;
      engine.geoStep(2000);
    } else if (inv.topic === 'glaciers') {
      engine.setClimateParams({ enabled: true, seaLevelTempC: -1 });
      engine.setGlacierParams({ enabled: true, slidingCoupling: 3, aspectBalance: 0.3, maxErosionMmYr: 10 });
      engine.geoStep(8000);
    } else if (inv.topic === 'slopes') {
      const w = engine.world;
      engine.landslide((w.width * w.cellSizeM) / 2, (w.height * w.cellSizeM) / 2, w.width * w.cellSizeM * 0.25);
    } else if (inv.topic === 'tectonics') {
      const w = engine.world;
      engine.earthquake({
        xM: (w.width * w.cellSizeM) / 2,
        yM: (w.height * w.cellSizeM) / 2,
        mw: 7.4,
        type: 'reverse',
        strikeDeg: 45,
        landslides: true,
      });
    } else {
      engine.advance(1800);
    }
    syncSim();
    await new Promise((r) => setTimeout(r, 60));
    await captureAfterView();
  };

  const report = useMemo(() => {
    void rev;
    return buildEvidenceReport(beforeWorld, engine, invId, hypothesis);
  }, [beforeWorld, invId, hypothesis, rev, s.sim?.simTimeS, s.geo.years]);

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

  return (
    <Dialog title="GCSE Geography Inquiry & Evidence Lab" onClose={() => s.set({ dialog: null })} wide>
      <div className="evidence-lab" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <label style={{ flex: 1, minWidth: 260 }}>
            <span className="field-label">
              <b>1. Choose Classroom Investigation Topic</b>
            </span>
            <select
              value={invId}
              onChange={(e) => setInvId(e.target.value)}
              style={{ width: '100%', marginTop: 4 }}
              aria-label="Investigation topic"
            >
              {INVESTIGATIONS.map((it) => (
                <option key={it.id} value={it.id}>
                  {it.title}
                </option>
              ))}
            </select>
          </label>
          <button className="small" onClick={() => void setupRecommendedWorld()} title={inv.setupHint}>
            Load topic world &amp; capture Before
          </button>
          <button className="small ghost" onClick={() => void captureBaseline()}>
            Reset ‘Before’ to current world
          </button>
        </div>

        <div style={{ background: 'rgba(0,0,0,0.22)', padding: 12, borderRadius: 6 }}>
          <div style={{ fontWeight: 700, color: 'var(--scouts-yellow)', marginBottom: 4 }}>
            Inquiry Question: {inv.question}
          </div>
          <label className="field" style={{ marginTop: 6 }}>
            <span className="field-label">
              <b>2. Predict (Hypothesis before running)</b>
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
                  Hypothesis {idx + 1}: {h.slice(0, 95)}…
                </option>
              ))}
            </select>
            <input
              type="text"
              value={hypothesis}
              onChange={(e) => {
                setHypothesis(e.target.value);
                savedHypothesis = e.target.value;
              }}
              aria-label="Hypothesis statement"
              style={{ width: '100%' }}
            />
          </label>

          <div className="row" style={{ marginTop: 8, gap: 8, alignItems: 'center' }}>
            <button onClick={() => void runQuickStep()}>
              ▶ Run Investigation Step &amp; Measure
            </button>
            {s.geo.mode && (
              <button className="small ghost" onClick={() => stepGeo(2000)}>
                +2,000 Geological Years
              </button>
            )}
            <button className="small ghost" onClick={() => void captureAfterView()}>
              Refresh ‘After’ Snapshot ({report.elapsedText})
            </button>
            <span className="hint small" style={{ marginLeft: 'auto' }}>
              Tip: You can also close this dialog, run or sculpt the world freely, and reopen Evidence at any time.
            </span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
          <div style={{ background: 'rgba(0,0,0,0.2)', padding: 10, borderRadius: 6 }}>
            <b>3. Observe — Before vs. After Views</b>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, opacity: 0.8, marginBottom: 3 }}>Before (Baseline)</div>
                {beforeUrl ? (
                  <img src={beforeUrl} alt="Before simulation" style={{ width: '100%', height: 110, objectFit: 'cover', borderRadius: 4 }} />
                ) : (
                  <div style={{ height: 110, background: '#0d1f18', borderRadius: 4, display: 'grid', placeItems: 'center', fontSize: 12 }}>Baseline ready</div>
                )}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, opacity: 0.8, marginBottom: 3 }}>After ({report.elapsedText})</div>
                {afterUrl ? (
                  <img src={afterUrl} alt="After simulation" style={{ width: '100%', height: 110, objectFit: 'cover', borderRadius: 4 }} />
                ) : (
                  <div style={{ height: 110, background: '#0d1f18', borderRadius: 4, display: 'grid', placeItems: 'center', fontSize: 12 }}>
                    Click ‘Refresh After’
                  </div>
                )}
              </div>
            </div>
          </div>

          <div style={{ background: 'rgba(0,0,0,0.2)', padding: 10, borderRadius: 6 }}>
            <b>{report.profileTitle}</b>
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

        <div style={{ background: 'rgba(0,0,0,0.2)', padding: 10, borderRadius: 6 }}>
          <b>4. Measure — Quantitative Evidence From Your World</b>
          <table className="values" style={{ marginTop: 6, width: '100%' }}>
            <thead>
              <tr>
                <th>Measured Indicator</th>
                <th>Before</th>
                <th>After</th>
                <th>Change / Process Significance</th>
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

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
          <div style={{ background: 'rgba(0,0,0,0.2)', padding: 10, borderRadius: 6 }}>
            <b>5. Physical Process Sequence &amp; Vocabulary</b>
            <ol style={{ margin: '6px 0 8px 18px', padding: 0, fontSize: 12.5, lineHeight: 1.45 }}>
              {report.processSequence.map((step, k) => (
                <li key={k} style={{ marginBottom: 4 }}>
                  {step.replace(/^\d+\.\s*/, '')}
                </li>
              ))}
            </ol>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
              {inv.vocabulary.map((v) => (
                <span
                  key={v.term}
                  title={v.definition}
                  style={{
                    background: 'rgba(255, 230, 39, 0.14)',
                    border: '1px solid rgba(255, 230, 39, 0.4)',
                    borderRadius: 4,
                    padding: '2px 6px',
                    fontSize: 11,
                    cursor: 'help',
                  }}
                >
                  ✓ {v.term}
                </span>
              ))}
            </div>
          </div>

          <div style={{ background: 'rgba(0,0,0,0.2)', padding: 10, borderRadius: 6, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <b>6. Explain — Suggested GCSE Exam Answer (with your data)</b>
            <p
              style={{
                margin: 0,
                fontSize: 13,
                lineHeight: 1.5,
                background: 'rgba(0,0,0,0.25)',
                padding: 10,
                borderRadius: 4,
                borderLeft: '3px solid var(--scouts-yellow)',
              }}
            >
              {report.examParagraph}
            </p>
            <div className="row" style={{ marginTop: 'auto', gap: 8 }}>
              <button
                onClick={async () => {
                  await captureAfterView();
                  const blob = await exportEvidenceSheetPng(report, savedBeforeImgUrl, savedAfterImgUrl);
                  const a = document.createElement('a');
                  a.href = URL.createObjectURL(blob);
                  a.download = `${report.worldName.replace(/[^\w-]+/g, '_')}-GCSE-evidence.png`;
                  a.click();
                  setTimeout(() => URL.revokeObjectURL(a.href), 1500);
                  s.toast('Downloaded GCSE Evidence Sheet PNG', 'success');
                }}
              >
                Download Evidence Sheet (PNG)
              </button>
              <button
                className="ghost small"
                onClick={() => {
                  const text = [
                    `# GCSE Geography Evidence Sheet — ${report.investigation.title}`,
                    `World: ${report.worldName} (${report.elapsedText})`,
                    `Hypothesis: ${report.hypothesis}`,
                    '',
                    '## Measured Changes',
                    ...report.metrics.map((m) => `- ${m.label}: ${m.before} → ${m.after} (${m.change})`),
                    '',
                    '## Process Sequence',
                    ...report.processSequence,
                    '',
                    '## GCSE Exam Explanation',
                    report.examParagraph,
                  ].join('\n');
                  void navigator.clipboard?.writeText(text);
                  s.toast('Copied GCSE Evidence report to clipboard', 'success');
                }}
              >
                Copy Report Text
              </button>
            </div>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
