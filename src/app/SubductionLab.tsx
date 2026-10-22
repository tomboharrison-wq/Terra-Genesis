import { useEffect, useMemo, useRef, useState } from 'react';
import { Dialog } from './Dialog';
import { useUi } from '../state/uiStore';
import { MAX_QUAKE_DEPTH_KM, MELT_DEPTH_KM, subductionGeometry, type Pt, type SubductionParams } from '../local/subduction/model';
import { Icon } from './icons';

const W = 660;
const H = 380;
const X0 = -320; // km
const X1 = 880;
const ZTOP = -70; // km above sea level drawn for the volcano symbol (not to scale)
const ZBOT = 700;

/** Subduction-zone cross-section lab (guided schematic, spec E9). */
export function SubductionLab() {
  const close = () => useUi.getState().set({ dialog: null });
  const [p, setP] = useState<SubductionParams>({ convergenceMmYr: 60, dipDeg: 40, overriding: 'continental' });
  const [tMyr, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const raf = useRef(0);
  const g = useMemo(() => subductionGeometry(p), [p]);

  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    const tick = (now: number) => {
      setT((t) => (t + ((now - last) / 1000) * 0.5) % 10); // 0.5 Myr per second, loops every 10 Myr
      last = now;
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [playing]);

  const s = W / (X1 - X0);
  const X = (x: number) => (x - X0) * s;
  const Z = (z: number) => ((z - ZTOP) / (ZBOT - ZTOP)) * H;
  const poly = (pts: Pt[]) => pts.map((q) => `${X(q.x).toFixed(1)},${Z(q.z).toFixed(1)}`).join(' ');
  const slab = [...g.slabTop, ...[...g.slabBottom].reverse()];
  const oceanPlate: Pt[] = [{ x: X0, z: 0 }, { x: g.trenchX, z: 0 }, ...g.slabBottom.slice(0, 1), { x: X0, z: 80 }];
  const lith = p.overriding === 'continental' ? 120 : 70;
  const over: Pt[] = [{ x: g.trenchX, z: 0 }, { x: X1, z: 0 }, { x: X1, z: lith }];
  for (const q of g.slabTop) if (q.z <= lith) over.push(q);
  over.reverse();
  // Moving stripes on the oceanic plate: plate travels v·t (mm/yr × Myr = km).
  const shift = (p.convergenceMmYr * tMyr) % 80;
  const stripes: Pt[][] = [];
  for (let k = -6; k < 12; k++) {
    const x = X0 + k * 80 + shift;
    if (x < X0 || x > g.trenchX) continue;
    stripes.push([{ x, z: 1 }, { x, z: 79 }]);
  }
  const slabLenTo100 = g.slabTop.reduce((acc, q, k) => (k && q.z <= MELT_DEPTH_KM ? acc + Math.hypot(q.x - g.slabTop[k - 1].x, q.z - g.slabTop[k - 1].z) : acc), 0);
  const myrTo100 = slabLenTo100 / Math.max(1, p.convergenceMmYr); // km / (mm/yr) = Myr

  return (
    <Dialog title="Subduction zone (guided cross-section)" onClose={close} wide>
      <div className="slump-controls">
        <label className="field">
          <span className="field-label">
            Convergence <b>{p.convergenceMmYr} mm/yr</b>
          </span>
          <input type="range" min={10} max={120} value={p.convergenceMmYr} onChange={(e) => setP({ ...p, convergenceMmYr: +e.target.value })} />
        </label>
        <label className="field">
          <span className="field-label">
            Slab dip <b>{p.dipDeg}°</b>
          </span>
          <input type="range" min={15} max={75} value={p.dipDeg} onChange={(e) => setP({ ...p, dipDeg: +e.target.value })} />
        </label>
        <label className="field">
          <span className="field-label">Overriding plate</span>
          <select value={p.overriding} onChange={(e) => setP({ ...p, overriding: e.target.value as SubductionParams['overriding'] })}>
            <option value="continental">Continental (e.g. Andes)</option>
            <option value="oceanic">Oceanic (island arc, e.g. Japan, Lesser Antilles)</option>
          </select>
        </label>
      </div>
      <div className="slump-readout">
        <span>
          Volcanic arc <b>{Math.round(g.arcDistanceKm)} km</b> from the trench
        </span>
        <span>
          Slab takes <b>{myrTo100.toFixed(1)} million years</b> to reach {MELT_DEPTH_KM} km depth
        </span>
        <span>
          Time <b>{tMyr.toFixed(1)} Myr</b>
        </span>
      </div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="slump-svg" role="img" aria-label="Subduction zone cross-section">
        <rect x={0} y={0} width={W} height={H} fill="#e9d2b0" />
        <rect x={0} y={0} width={W} height={Z(0)} fill="#cfe0ec" />
        <text className="slump-label" x={W / 2 + 60} y={H - 10} textAnchor="middle">
          Mantle (hot rock, flows very slowly)
        </text>
        <rect x={0} y={Z(0) - 3} width={X(g.trenchX + 10)} height={3} fill="#3d84b8" />
        <polygon points={poly(oceanPlate)} fill="#5d6b7a" />
        <polygon points={poly(slab)} fill="#5d6b7a" />
        {stripes.map((st, k) => (
          <polyline key={k} points={poly(st)} stroke="#8996a3" strokeWidth={2} />
        ))}
        <polygon points={poly(over)} fill={p.overriding === 'continental' ? '#a8865f' : '#6f7d6a'} />
        <rect x={X(g.trenchX + 30)} y={Z(0)} width={X(X1) - X(g.trenchX + 30)} height={Z(g.crustKm) - Z(0)} fill={p.overriding === 'continental' ? '#c49a6c' : '#7d8b77'} opacity={0.9} />
        {/* Melting in the mantle wedge and rising magma */}
        <ellipse cx={X(g.melt.x)} cy={Z(g.melt.z)} rx={18} ry={10} fill="#ed3f23" opacity={0.85} />
        <path d={`M${X(g.melt.x)},${Z(g.melt.z) - 10} C${X(g.melt.x) - 8},${Z(50)} ${X(g.melt.x) + 8},${Z(20)} ${X(g.arcX)},${Z(0)}`} stroke="#ed3f23" strokeWidth={3} strokeDasharray="6 4" fill="none" />
        <polygon points={`${X(g.arcX) - 18},${Z(0)} ${X(g.arcX)},${Z(ZTOP + 8)} ${X(g.arcX) + 18},${Z(0)}`} fill="#4b4744" />
        <polygon points={`${X(g.arcX) - 4},${Z(ZTOP + 10)} ${X(g.arcX)},${Z(ZTOP + 2)} ${X(g.arcX) + 4},${Z(ZTOP + 10)}`} fill="#ff912a" />
        {/* Benioff-zone earthquakes */}
        {g.quakes.map((q, k) => (
          <circle key={k} cx={X(q.x)} cy={Z(q.z)} r={1 + (q.mag - 4) * 0.9} fill="#ffe627" stroke="#1d1a16" strokeWidth={0.6} />
        ))}
        {/* Motion arrows */}
        <path d={`M${X(X0 + 40)},${Z(40)}l60,0l-8,-5m8,5l-8,5`} stroke="#f4f1ea" strokeWidth={2.5} fill="none" />
        <path d={`M${X(g.slabTop[40].x) + 10},${Z(g.slabTop[40].z) + 10}l${Math.cos((p.dipDeg * Math.PI) / 180) * 40},${Math.sin((p.dipDeg * Math.PI) / 180) * 40}`} stroke="#f4f1ea" strokeWidth={2.5} fill="none" />
        {/* Labels */}
        <text className="slump-label" x={X(g.trenchX)} y={Z(0) + 16} textAnchor="middle">
          Trench
        </text>
        <text className="slump-label" x={X(X0 + 10)} y={Z(0) - 8}>
          Ocean
        </text>
        <text className="slump-label" x={X(X0 + 10)} y={Z(62)} style={{ fill: '#f4f1ea', stroke: 'rgba(0,0,0,0.4)' }}>
          Oceanic plate (dense, sinks)
        </text>
        <text className="slump-label" x={Math.min(X(g.slabTop[35].x) + 14, W - 270)} y={Z(g.slabTop[35].z) - 4}>
          Earthquakes along the slab (Benioff zone)
        </text>
        <text className="slump-label red" x={X(g.melt.x) + 24} y={Z(g.melt.z) + 4}>
          Water from the slab melts the mantle
        </text>
        <text className="slump-label" x={X(g.arcX) + 24} y={Z(ZTOP + 26)}>
          Volcanic arc
        </text>
        <text className="slump-label" x={X(X1) - 8} y={Z(g.crustKm / 2) + 4} textAnchor="end">
          {p.overriding === 'continental' ? 'Continental crust (light, does not sink)' : 'Oceanic crust'}
        </text>
        {[MELT_DEPTH_KM, 300, MAX_QUAKE_DEPTH_KM].map((d) => (
          <g key={d}>
            <line x1={W - 34} x2={W} y1={Z(d)} y2={Z(d)} stroke="#4a463f" strokeDasharray="3 3" />
            <text className="chart-label" x={W - 36} y={Z(d) + 4} textAnchor="end">
              {d} km deep
            </text>
          </g>
        ))}
      </svg>
      <div className="dialog-foot">
        <div className="row">
          <button className="primary" onClick={() => setPlaying(!playing)}>
            <Icon name={playing ? 'pause' : 'play'} size={16} /> {playing ? 'Pause' : 'Play plate motion'}
          </button>
        </div>
        <span className="muted small">
          Guided schematic: depths to scale; the volcano is drawn far taller than life. On the map, Plates places arc volcanoes at the same
          relative position.
        </span>
      </div>
    </Dialog>
  );
}
