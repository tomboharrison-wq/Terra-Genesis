import { useEffect, useMemo, useRef, useState } from 'react';
import { Dialog } from './Dialog';
import { useUi } from '../state/uiStore';
import { foldGeometry, L0_KM, LAYERS, type FoldGeometry, type FoldParams, type Pt } from '../local/folds/model';
import { Icon } from './icons';

const W = 660;
const H = 300;
const ZMAX = 24; // km drawn

/** Fold mountains lab (guided cross-section, spec E9 "fold mountain formation"). */
export function FoldLab() {
  const close = () => useUi.getState().set({ dialog: null });
  const [p, setP] = useState<FoldParams>({
    shortening: 0.3,
    wavelengthKm: 12,
    thrust: false,
    erosion: 0,
  });
  const [playing, setPlaying] = useState(false);
  const raf = useRef(0);
  const g = useMemo(() => foldGeometry(p), [p]);

  useEffect(() => {
    if (!playing) return;
    const t0 = performance.now();
    const target = Math.max(0.3, p.shortening);
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / 4000);
      setP((q) => ({ ...q, shortening: target * t }));
      if (t < 1) raf.current = requestAnimationFrame(tick);
      else setPlaying(false);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  const pct = Math.round(p.shortening * 100);
  const sx = (W - 80) / L0_KM; // as in FoldSection (for the 'heights drawn ×' note)
  const sz = (H - 30) / ZMAX;

  return (
    <Dialog title="Fold mountains (guided cross-section)" onClose={close} wide>
      <div className="slump-controls">
        <label className="field">
          <span className="field-label">
            Squeezed by <b>{pct}%</b>
          </span>
          <input type="range" min={0} max={60} value={pct} onChange={(e) => setP({ ...p, shortening: +e.target.value / 100 })} />
        </label>
        <label className="field">
          <span className="field-label">
            Fold spacing <b>{p.wavelengthKm} km</b>
          </span>
          <input type="range" min={6} max={24} value={p.wavelengthKm} onChange={(e) => setP({ ...p, wavelengthKm: +e.target.value })} />
        </label>
        <label className="field">
          <span className="field-label">
            Erode the top <b>{Math.round(p.erosion * 100)}%</b>
          </span>
          <input type="range" min={0} max={60} value={Math.round(p.erosion * 100)} onChange={(e) => setP({ ...p, erosion: +e.target.value / 100 })} />
        </label>
        <label className="field check">
          <input type="checkbox" checked={p.thrust} onChange={(e) => setP({ ...p, thrust: e.target.checked })} />
          <span>Allow a thrust fault (from 25%)</span>
        </label>
      </div>
      <div className="slump-readout">
        <span>
          Belt <b>{g.lengthKm.toFixed(0)} km</b> wide (was {L0_KM})
        </span>
        <span>
          Layers <b>{g.thickening.toFixed(2)}×</b> thicker
        </span>
        <span>
          Fold height <b>{(2 * g.amplitudeKm).toFixed(1)} km</b> crest to trough
        </span>
        {g.thrust && (
          <span>
            Thrust slip <b>{g.thrustSlipKm.toFixed(1)} km</b>
          </span>
        )}
      </div>
      <FoldSection g={g} />
      <div className="legend swatches" style={{ marginTop: 6 }}>
        {LAYERS.map((l, i) => (
          <span key={l.name}>
            <i style={{ background: l.colour }} />
            {l.name}
            {i === 0 ? ' (youngest)' : i === LAYERS.length - 1 ? ' (oldest)' : ''}
          </span>
        ))}
      </div>
      <div className="dialog-foot">
        <div className="row">
          <button className="primary" disabled={playing} onClick={() => setPlaying(true)}>
            <Icon name="play" size={16} /> Play the collision
          </button>
        </div>
        <span className="muted small">
          Guided model: each layer keeps its length (it buckles) and its area (it thickens). Heights drawn ×{(sz / sx).toFixed(1)}. On the map, colliding
          continents fold their rock layers the same way.
        </span>
      </div>
    </Dialog>
  );
}

/** The fold-mountain cross-section drawing (shared by the lab and the tectonics lessons). */
export function FoldSection({ g }: { g: FoldGeometry }) {
  const pad = 40;
  const sx = (W - 2 * pad) / L0_KM;
  const sz = (H - 30) / ZMAX;
  const off = (L0_KM - g.lengthKm) / 2; // keep the belt centred as it shortens
  const X = (x: number) => pad + (x + off) * sx;
  const Z = (z: number) => H - 10 - z * sz;
  const poly = (pts: Pt[]) => pts.map((q) => `${X(q.x).toFixed(1)},${Z(q.z).toFixed(1)}`).join(' ');
  const ant = g.anticlines[Math.floor(g.anticlines.length / 2)];
  const syn = g.synclines[0];
  const er = g.erosionZ;
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="slump-svg" role="img" aria-label="Fold mountains cross-section">
      <rect x={0} y={0} width={W} height={H} fill="#cfe0ec" />
      {/* Deeper crust below the thrust's sole (fills under the lifted hanging wall) */}
      <rect x={X(0)} y={Z(g.thrustSlipKm / 2 + 1)} width={X(g.lengthKm) - X(0)} height={H} fill="#6d6560" />
      {/* Basement (crystalline rock under the sedimentary pile) */}
      {g.basement.map((q, k) => (
        <polygon key={`b${k}`} points={poly(q)} fill="#6d6560" />
      ))}
      {/* Converging continents */}
      <rect x={0} y={Z(10)} width={X(0)} height={H} fill="#8a7a66" />
      <rect x={X(g.lengthKm)} y={Z(10)} width={W - X(g.lengthKm)} height={H} fill="#8a7a66" />
      <path d={`M8,${Z(12)}l24,0l-6,-4m6,4l-6,4`} stroke="#1d1a16" strokeWidth={2} fill="none" />
      <path d={`M${W - 8},${Z(12)}l-24,0l6,-4m-6,4l6,4`} stroke="#1d1a16" strokeWidth={2} fill="none" />
      {g.layers.map((parts, i) =>
        parts.map((q, k) => <polygon key={`${i}-${k}`} points={poly(q)} fill={LAYERS[i].colour} stroke="#3b2a1c" strokeWidth={0.6} />),
      )}
      {er !== null && <rect x={0} y={0} width={W} height={Z(er)} fill="#cfe0ec" />}
      {er !== null && <line x1={X(0)} x2={X(g.lengthKm)} y1={Z(er)} y2={Z(er)} stroke="#205b41" strokeWidth={2} />}
      {g.thrust && <polyline points={poly(g.thrust)} stroke="#ed3f23" strokeWidth={2.5} strokeDasharray="6 4" fill="none" />}
      {ant && (er === null || er > ant.z - 1) && (
        <text className="slump-label" x={X(ant.x)} y={Z(Math.min(ant.z, er ?? ant.z)) - 8} textAnchor="middle">
          Anticline (arch)
        </text>
      )}
      {syn && (
        <text className="slump-label" x={X(syn.x)} y={Z(Math.min(syn.z, er ?? syn.z)) - 8} textAnchor="middle">
          Syncline (trough)
        </text>
      )}
      {er !== null && (
        <text className="slump-label" x={X(g.lengthKm) - 4} y={Z(er) - 6} textAnchor="end">
          Erosion surface: old rock in anticline cores, young rock in synclines
        </text>
      )}
      {g.thrust && (
        <text className="slump-label red" x={X(g.thrust[1].x) + 6} y={Z(g.thrust[1].z) + 14}>
          Thrust fault
        </text>
      )}
    </svg>
  );
}
