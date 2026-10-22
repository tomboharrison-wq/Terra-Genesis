import { useUi } from '../state/uiStore';
import { engine, syncSim } from './runtime';
import { Icon } from './icons';
import type { WaterView } from '../renderer/waterLayer';

export const SPEEDS = [
  { v: 60, label: '1 min / s' },
  { v: 600, label: '10 min / s' },
  { v: 3600, label: '1 hour / s' },
  { v: 6 * 3600, label: '6 hours / s' },
  { v: 86400, label: '1 day / s' },
];

export function fmtSimTime(s: number) {
  const day = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `Day ${day + 1} · ${pad(h)}:${pad(m)}:${pad(sec)}`;
}

function fmtRate(v: number) {
  if (v >= 86400) return `${(v / 86400).toFixed(1)} d/s`;
  if (v >= 3600) return `${(v / 3600).toFixed(1)} h/s`;
  if (v >= 60) return `${(v / 60).toFixed(1)} min/s`;
  return `${v.toFixed(0)} s/s`;
}

const VIEWS: { v: WaterView; label: string }[] = [
  { v: 'water', label: 'Water' },
  { v: 'depth', label: 'Depth map' },
  { v: 'speed', label: 'Flow speed' },
  { v: 'off', label: 'Hidden' },
];

/** Simulation time controls (spec F3) and water view selector with legend. */
export function TimeBar() {
  const sim = useUi((s) => s.sim);
  const view = useUi((s) => s.waterView);
  const terrainOverlay = useUi((s) => s.terrainOverlay);
  const set = useUi((s) => s.set);
  if (!sim) return null;
  const slow = sim.playing && sim.achievedSpeed < sim.speed * 0.8;
  return (
    <div className="timebar" role="toolbar" aria-label="Simulation time">
      <button className={`play ${sim.playing ? 'on' : ''}`} onClick={() => engine.setPlaying(!sim.playing)} title={sim.playing ? 'Pause (P)' : 'Run simulation (P)'} aria-label={sim.playing ? 'Pause' : 'Play'}>
        <Icon name={sim.playing ? 'pause' : 'play'} />
      </button>
      <button
        className="icon"
        disabled={sim.playing}
        onClick={() => {
          engine.advance(Math.min(sim.speed, 3600));
          syncSim();
        }}
        title={`Step ${fmtRate(Math.min(sim.speed, 3600)).replace('/s', '')} of simulated time (.)`}
        aria-label="Step"
      >
        <Icon name="step" />
      </button>
      <select value={sim.speed} onChange={(e) => engine.setSpeed(+e.target.value)} title="Requested simulation speed (simulated time per real second)">
        {SPEEDS.map((s) => (
          <option key={s.v} value={s.v}>
            {s.label}
          </option>
        ))}
      </select>
      <span className="clock" title="Simulated time since this world was created">
        {fmtSimTime(sim.simTimeS)}
      </span>
      {sim.playing && (
        <span className={`achieved ${slow ? 'slow' : ''}`} title="Achieved speed; lower than requested when the computer cannot keep up">
          {fmtRate(sim.achievedSpeed)}
        </span>
      )}
      <span className={`badge ${sim.backend}`} title={sim.backend === 'gpu' ? 'Water solver running on the graphics card (WebGL2)' : 'Water solver running on the CPU (no WebGL2 float render targets) — slower'}>
        {sim.backend.toUpperCase()}
      </span>
      <span className="sep" />
      <div className="seg">
        {VIEWS.map((v) => (
          <button key={v.v} className={view === v.v ? 'active' : ''} onClick={() => set({ waterView: v.v })}>
            {v.label}
          </button>
        ))}
      </div>
      <button className={`small ${terrainOverlay === 'change' ? 'active-toggle' : ''}`} onClick={() => set({ terrainOverlay: terrainOverlay === 'change' ? 'none' : 'change' })} title="Colour terrain by erosion (red) / deposition (blue) since the reference">
        Change map
      </button>
      {terrainOverlay === 'change' && (
        <div className="legend" aria-label="Elevation change legend">
          <i className="ramp change" />
          <span>−10 m</span>
          <span>±5 cm</span>
          <span>+10 m</span>
        </div>
      )}
      {terrainOverlay === 'waves' && (
        <div className="legend" aria-label="Wave attack legend">
          <i className="ramp waves" />
          <span>low</span>
          <span>15</span>
          <span>≥30 kW/m</span>
        </div>
      )}
      {view === 'depth' && (
        <div className="legend" aria-label="Water depth legend">
          <i className="ramp depth" />
          <span>1 cm</span>
          <span>30 cm</span>
          <span>10 m</span>
        </div>
      )}
      {view === 'speed' && (
        <div className="legend" aria-label="Flow speed legend">
          <i className="ramp speed" />
          <span>0</span>
          <span>1.5</span>
          <span>≥3 m/s</span>
        </div>
      )}
    </div>
  );
}
