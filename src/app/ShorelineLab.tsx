import { useEffect, useRef, useState } from 'react';
import { Dialog } from './Dialog';
import { useUi } from '../state/uiStore';
import { BAY, CELL_M, defaultShorelineParams, NX, NY, ShorelineModel, type ShorelineParams } from '../local/shoreline/model';
import { Icon } from './icons';

const PX = 6; // canvas pixels per cell
const LAYOUTS: { id: ShorelineParams['layout']; label: string; text: string }[] = [
  { id: 'bay', label: 'Bay mouth (bar and lagoon)', text: 'Drift carries sand past the headland and builds a spit across the bay. When it reaches the far side it becomes a bar and the bay behind it a lagoon.' },
  { id: 'spit', label: 'Coast end (spit)', text: 'Where the coast turns inland, drift carries on in a straight line and builds a spit out into open water. Waves from the other direction curl its end landward (a recurve).' },
  { id: 'cape', label: 'Gentle cape', text: 'A smooth bulge in the coast. Watch how the drift moves sand round it, and how high-angle waves make bumps grow into capes and spits.' },
];

const SEA = [61, 132, 184];
const LAGOON = [92, 160, 150];
const LAND = [122, 140, 88];
const SAND = [232, 212, 154];

/**
 * Beaches, spits and bars — a guided plan-view one-line shoreline model (spec E6). Everything drawn
 * is the sand fill of src/local/shoreline/model.ts.
 */
export function ShorelineLab() {
  const close = () => useUi.getState().set({ dialog: null });
  const model = useRef(new ShorelineModel());
  const canvas = useRef<HTMLCanvasElement>(null);
  const [p, setP] = useState<ShorelineParams>(defaultShorelineParams());
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(2);
  const [, setTick] = useState(0);
  const m = model.current;
  const speedRef = useRef(speed);
  speedRef.current = speed;

  const draw = () => {
    const c = canvas.current;
    if (!c) return;
    const ctx = c.getContext('2d')!;
    const img = ctx.createImageData(NX * PX, NY * PX);
    m.lagoonCells();
    const open = m.lagoonMask;
    for (let y = 0; y < NY; y++)
      for (let x = 0; x < NX; x++) {
        const i = y * NX + x;
        const f = Math.min(1, Math.max(0, m.f[i]));
        const water = f < 0.5 && !open[i] ? LAGOON : SEA;
        const land = m.f0[i] >= 0.5 && f >= 0.5 ? LAND : SAND;
        const col = water.map((w, k) => Math.round(w + (land[k] - w) * f));
        for (let py = 0; py < PX; py++)
          for (let px = 0; px < PX; px++) {
            const o = (((NY - 1 - y) * PX + py) * NX * PX + x * PX + px) * 4;
            img.data[o] = col[0];
            img.data[o + 1] = col[1];
            img.data[o + 2] = col[2];
            img.data[o + 3] = 255;
          }
      }
    ctx.putImageData(img, 0, 0);
    // Original coastline (dashed).
    ctx.strokeStyle = 'rgba(29,26,22,0.55)';
    ctx.setLineDash([5, 4]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let x = 0; x < NX; x++) {
      let yy = 0;
      while (yy < NY && m.f0[yy * NX + x] >= 0.5) yy++;
      const sy = (NY - yy) * PX;
      if (x === 0) ctx.moveTo(0, sy);
      else ctx.lineTo(x * PX, sy);
      ctx.lineTo((x + 1) * PX, sy);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    // Today's waves: arrows travelling landward from the open sea.
    const a = m.waveAngle;
    const dx = Math.sin(a);
    const dy = Math.cos(a); // canvas y down = landward
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    for (const cx of [NX * PX * 0.2, NX * PX * 0.5, NX * PX * 0.8]) {
      const x0 = cx - dx * 28;
      const y0 = 30 - dy * 20;
      const x1 = cx + dx * 28;
      const y1 = 30 + dy * 20;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      const ang = Math.atan2(y1 - y0, x1 - x0);
      ctx.lineTo(x1 - 8 * Math.cos(ang - 0.5), y1 - 8 * Math.sin(ang - 0.5));
      ctx.moveTo(x1, y1);
      ctx.lineTo(x1 - 8 * Math.cos(ang + 0.5), y1 - 8 * Math.sin(ang + 0.5));
      ctx.stroke();
    }
    ctx.font = 'bold 13px Inter, system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText("Today's waves", 8, 16);
  };

  useEffect(() => {
    draw();
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const days = Math.max(1, Math.round((speedRef.current * 365 * (now - last)) / 1000));
      last = now;
      m.step(Math.min(days, 120));
      draw();
      setTick((t) => t + 1);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  const update = (patch: Partial<ShorelineParams>, restart: boolean) => {
    const np = { ...p, ...patch };
    setP(np);
    m.p = np;
    if (restart) {
      setPlaying(false);
      m.reset();
    }
    draw();
    setTick((t) => t + 1);
  };

  const lagoonKm2 = (m.lagoonCells() * CELL_M * CELL_M) / 1e6;
  const spit = m.spitStats();
  const years = m.day / 365;
  const layout = LAYOUTS.find((l) => l.id === p.layout)!;
  const recurved = p.layout === 'spit' && spit.cells > 20 && spit.hookDepth >= 4 && spit.tipX > BAY.x0 + 6;

  return (
    <Dialog title="Beaches, spits and bars lab (guided model)" onClose={close} wide>
      <div className="slump-controls">
        <label className="field">
          <span className="field-label">Coast (restarts)</span>
          <select value={p.layout} onChange={(e) => update({ layout: e.target.value as ShorelineParams['layout'] }, true)}>
            {LAYOUTS.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field-label">
            Waves from the left <b>{Math.round(p.asymmetry * 100)}%</b>
          </span>
          <input type="range" min={50} max={100} value={Math.round(p.asymmetry * 100)} onChange={(e) => update({ asymmetry: +e.target.value / 100 }, false)} />
        </label>
        <label className="field">
          <span className="field-label">
            High-angle waves <b>{Math.round(p.highness * 100)}%</b>
          </span>
          <input type="range" min={0} max={70} value={Math.round(p.highness * 100)} onChange={(e) => update({ highness: +e.target.value / 100 }, false)} />
        </label>
        <label className="field check">
          <input type="checkbox" checked={p.supply} onChange={(e) => update({ supply: e.target.checked }, false)} />
          <span>Sand supplied from up the coast</span>
        </label>
      </div>
      <p className="arch-text">{layout.text}</p>
      <div className="slump-readout">
        <span>
          Year <b>{years.toFixed(1)}</b>
        </span>
        <span>
          Lagoon <b>{lagoonKm2.toFixed(2)} km²</b>
        </span>
        {p.layout === 'bay' && (
          <span>
            Bay mouth <b>{lagoonKm2 > 0.5 ? 'closed by a bar' : 'open'}</b>
          </span>
        )}
        {p.layout === 'spit' && (
          <span>
            Spit <b>{spit.cells ? (((spit.tipX - BAY.x0 + 1) * CELL_M) / 1000).toFixed(1) : '0.0'} km</b>
            {recurved ? ' · recurved tip' : ''}
          </span>
        )}
        <span>
          Sand in <b>{(m.suppliedM3 / 1e6).toFixed(2)}</b> · out <b>{(m.exportedM3 / 1e6).toFixed(2)}</b> million m³
        </span>
      </div>
      <div className="shore-view">
        <canvas ref={canvas} width={NX * PX} height={NY * PX} aria-label="Plan view of the coast" />
        <div className="shore-legend">
          <span>
            <i style={{ background: 'rgb(122,140,88)' }} /> Original land
          </span>
          <span>
            <i style={{ background: 'rgb(232,212,154)' }} /> New sand
          </span>
          <span>
            <i style={{ background: 'rgb(61,132,184)' }} /> Sea
          </span>
          <span>
            <i style={{ background: 'rgb(92,160,150)' }} /> Lagoon (cut off)
          </span>
          <span>
            <i className="dash" /> Original coastline
          </span>
          <span className="muted">Map {(NX * CELL_M) / 1000} × {(NY * CELL_M) / 1000} km</span>
        </div>
      </div>
      <div className="dialog-foot">
        <div className="row">
          <button className="primary" onClick={() => setPlaying(!playing)}>
            <Icon name={playing ? 'pause' : 'play'} size={16} /> {playing ? 'Pause' : 'Play'}
          </button>
          <button
            disabled={playing}
            onClick={() => {
              m.step(365);
              draw();
              setTick((t) => t + 1);
            }}
          >
            +1 year
          </button>
          <button onClick={() => update({}, true)}>Reset</button>
          <label className="field inline">
            <span className="field-label">Speed {speed} yr/s</span>
            <input type="range" min={1} max={6} value={speed} onChange={(e) => setSpeed(+e.target.value)} />
          </label>
        </div>
      </div>
      <p className="muted small">
        Guided model: a one-line shoreline model (after Ashton &amp; Murray). Each day a wave direction is drawn from the climate; sand moves along
        the shore at a rate set by the wave angle, sheltered coast gets none, and waves bend a little round corners. Sand is counted exactly.
        Separate from the world map.
      </p>
    </Dialog>
  );
}
