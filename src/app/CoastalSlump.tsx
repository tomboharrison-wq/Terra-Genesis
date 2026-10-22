import { useEffect, useRef, useState } from 'react';
import { debrisWedge, SOIL_PRESETS } from '../local/slump/model';
import { CoastalSlumpModel, defaultCoastalSlumpParams, type CoastalSlumpParams } from '../local/slump/coastal';
import { Icon } from './icons';

const W = 660;
const H = 250;
const CH = 120;

/** Coastal slumping cycle view (inside the slump lab). Everything drawn is CoastalSlumpModel state. */
export function CoastalSlump() {
  const model = useRef(new CoastalSlumpModel());
  const [p, setP] = useState<CoastalSlumpParams>(defaultCoastalSlumpParams());
  const [playing, setPlaying] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  const [, setTick] = useState(0);
  const m = model.current;
  const refresh = () => setTick((t) => t + 1);

  const update = (patch: Partial<CoastalSlumpParams>, restart: boolean) => {
    const np = { ...p, ...patch };
    setP(np);
    m.p = np;
    if (restart) {
      setPlaying(false);
      m.reset();
    }
    refresh();
  };

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const tick = () => {
      if (m.year >= 300) {
        setPlaying(false);
        return;
      }
      m.stepYear();
      refresh();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, m]);

  // Cross-section frame (metres): keep the original cliff and the current one in view.
  const Hm = p.heightM;
  const toe0 = Hm / Math.tan((p.faceDeg * Math.PI) / 180);
  const x0 = Math.min(-2 * Hm, m.crestM - 1.2 * Hm);
  const x1 = toe0 + 2.2 * Hm;
  const z0 = -0.35 * Hm;
  const z1 = 1.3 * Hm;
  const s = Math.min(W / (x1 - x0), H / (z1 - z0));
  const X = (x: number) => (x - x0) * s;
  const Z = (z: number) => H - (z - z0) * s;
  const sp = m.slumpParams();
  const wedge = debrisWedge(sp);
  const off = m.crestM; // slump-model frame has the crest at x = 0
  const cliff = `${X(x0)},${Z(z0)} ${X(x0)},${Z(Hm)} ${X(m.crestM)},${Z(Hm)} ${X(m.toeM)},${Z(0)} ${X(x1)},${Z(0)} ${X(x1)},${Z(z0)}`;
  const apron = wedge ? `${X(off + wedge.x0)},${Z(wedge.h)} ${X(off + wedge.xt)},${Z(wedge.h)} ${X(off + wedge.x1)},${Z(0)} ${X(m.toeM)},${Z(0)}` : '';

  // FoS timeline.
  const years = Math.max(100, m.year);
  const fx = (y: number) => 40 + (y / years) * (W - 56);
  const fmax = Math.max(1.6, Math.min(3, Math.ceil(Math.max(...m.fosHistory.filter(Number.isFinite), 0) * 2) / 2));
  const fz = (f: number) => 8 + (1 - Math.min(fmax, f) / fmax) * (CH - 28);
  const line = m.fosHistory.map((f, y) => `${fx(y).toFixed(1)},${fz(Number.isFinite(f) ? f : fmax).toFixed(1)}`).join(' ');
  const rate = m.year > 0 ? -m.crestM / m.year : 0;
  const hv = hover != null && hover <= m.year ? hover : null;

  return (
    <>
      <div className="slump-controls">
        <label className="field">
          <span className="field-label">Material</span>
          <select value={p.soil} onChange={(e) => update({ soil: e.target.value as CoastalSlumpParams['soil'] }, true)}>
            {Object.entries(SOIL_PRESETS).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field-label">
            Cliff height <b>{p.heightM} m</b> (restarts)
          </span>
          <input type="range" min={8} max={40} value={p.heightM} onChange={(e) => update({ heightM: +e.target.value }, true)} />
        </label>
        <label className="field">
          <span className="field-label">
            Saturation <b>{Math.round(p.saturation * 100)}%</b>
          </span>
          <input type="range" min={0} max={100} value={Math.round(p.saturation * 100)} onChange={(e) => update({ saturation: +e.target.value / 100 }, false)} />
        </label>
        <label className="field">
          <span className="field-label">
            Wave energy <b>{p.waveEnergy.toFixed(1)}×</b>
          </span>
          <input type="range" min={0} max={30} value={Math.round(p.waveEnergy * 10)} onChange={(e) => update({ waveEnergy: +e.target.value / 10 }, false)} />
        </label>
      </div>
      <div className="slump-readout">
        <span>
          Year <b>{m.year}</b>
        </span>
        <span>
          Factor of safety <b style={{ color: m.fos < 1 ? 'var(--scouts-red)' : 'var(--scouts-green)' }}>{Number.isFinite(m.fos) ? m.fos.toFixed(2) : '—'}</b>
        </span>
        <span>
          Toe debris <b>{m.debrisM2.toFixed(0)} m²</b>
        </span>
        <span>
          Slumps <b>{m.events.length}</b>
        </span>
        <span>
          Cliff-top retreat <b>{(-m.crestM).toFixed(1)} m</b> ({rate.toFixed(2)} m/yr)
        </span>
      </div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="slump-svg" role="img" aria-label="Coastal cliff cross-section">
        <rect x={0} y={0} width={W} height={H} fill="#cfe0ec" />
        <rect x={X(m.toeM - (0.12 * Hm) / Math.tan((m.faceDeg * Math.PI) / 180))} y={Z(0.12 * Hm)} width={W} height={H} fill="#3d84b8" opacity={0.55} />
        <polygon points={cliff} fill="#9a7a5c" />
        {apron && <polygon points={apron} fill="#c09a6c" stroke="#5a4330" strokeWidth={1} />}
        <polyline
          points={`${X(x0)},${Z(Hm)} ${X(0)},${Z(Hm)} ${X(toe0)},${Z(0)}`}
          fill="none"
          stroke="#1d1a16"
          strokeWidth={1.5}
          strokeDasharray="5 4"
          opacity={0.7}
        />
        <text className="slump-label" x={X(0) + 4} y={Z(Hm) - 6}>
          Original cliff
        </text>
        {wedge && (
          <text className="slump-label" x={X(off + wedge.xt) + 6} y={Z(wedge.h) - 6}>
            Toe debris (protects the cliff)
          </text>
        )}
        <text className="slump-label blue" x={W - 8} y={Z(0.12 * Hm) - 6} textAnchor="end">
          Sea
        </text>
      </svg>
      <svg
        width="100%"
        viewBox={`0 0 ${W} ${CH}`}
        className="slump-svg fos-chart"
        role="img"
        aria-label="Factor of safety over time"
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const x = ((e.clientX - r.left) / r.width) * W;
          setHover(Math.max(0, Math.min(m.year, Math.round(((x - 40) / (W - 56)) * years))));
        }}
        onMouseLeave={() => setHover(null)}
      >
        <rect x={0} y={0} width={W} height={CH} fill="#f4f1ea" />
        <text className="chart-label" x={6} y={fz(1) + 4}>
          1.0
        </text>
        <text className="chart-label" x={6} y={fz(1.5) + 4}>
          1.5
        </text>
        <text className="chart-label" x={6} y={fz(0.5) + 4}>
          0.5
        </text>
        <line x1={40} x2={W - 16} y1={fz(1.5)} y2={fz(1.5)} stroke="#d8d2c4" />
        <line x1={40} x2={W - 16} y1={fz(0.5)} y2={fz(0.5)} stroke="#d8d2c4" />
        <line x1={40} x2={W - 16} y1={fz(1)} y2={fz(1)} stroke="var(--scouts-red)" strokeWidth={1.5} strokeDasharray="5 4" />
        <text className="chart-label" x={W - 18} y={fz(1) + 13} textAnchor="end">
          fails below 1
        </text>
        {m.events.map((e) => (
          <line key={e.year} x1={fx(e.year)} x2={fx(e.year)} y1={8} y2={CH - 20} stroke="#ff912a" strokeWidth={2} />
        ))}
        <polyline points={line} fill="none" stroke="#006ddf" strokeWidth={2} strokeLinejoin="round" />
        <text className="chart-label" x={40} y={CH - 6}>
          year 0
        </text>
        <text className="chart-label" x={W - 16} y={CH - 6} textAnchor="end">
          year {years}
        </text>
        <text className="chart-label" x={W / 2} y={CH - 6} textAnchor="middle">
          Factor of safety each year · orange = slump
        </text>
        {hv != null && (
          <>
            <line x1={fx(hv)} x2={fx(hv)} y1={8} y2={CH - 20} stroke="#1d1a16" strokeWidth={1} />
            <text className="chart-tip" x={Math.min(fx(hv) + 6, W - 150)} y={20}>
              Year {hv}: FoS {Number.isFinite(m.fosHistory[hv]) ? m.fosHistory[hv].toFixed(2) : '—'}
              {m.events.some((e) => e.year === hv) ? ' · slump' : ''}
            </text>
          </>
        )}
      </svg>
      <div className="dialog-foot">
        <div className="row">
          <button className="primary" onClick={() => setPlaying(!playing)} disabled={m.year >= 300}>
            <Icon name={playing ? 'pause' : 'play'} size={16} /> {playing ? 'Pause' : 'Run years'}
          </button>
          <button
            disabled={playing}
            onClick={() => {
              for (let k = 0; k < 10; k++) m.stepYear();
              refresh();
            }}
          >
            +10 years
          </button>
          <button
            onClick={() => {
              setPlaying(false);
              m.reset();
              refresh();
            }}
          >
            Reset
          </button>
        </div>
        <span className="muted small">
          Guided model: slumped material rests at the toe and buttresses the cliff until waves remove it; then waves cut the toe, the face steepens and the next
          slump follows.
        </span>
      </div>
    </>
  );
}
