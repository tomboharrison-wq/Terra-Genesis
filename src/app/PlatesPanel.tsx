import { useState } from 'react';
import { useUi } from '../state/uiStore';
import { engine } from './runtime';
import { PLATE_COLOURS } from '../sim/tectonics/plates';

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;
const fmtVol = (m3: number) => (m3 >= 1e9 ? `${(m3 / 1e9).toFixed(2)} km³` : m3 >= 1e6 ? `${(m3 / 1e6).toFixed(1)} million m³` : `${Math.round(m3).toLocaleString()} m³`);

/** Kinematic plates (spec E9): plate map, motions, boundary deformation. */
export function PlatesPanel() {
  const sim = useUi((s) => s.sim);
  const overlay = useUi((s) => s.terrainOverlay);
  const set = useUi((s) => s.set);
  const [count, setCount] = useState(3);
  const [seed, setSeed] = useState(1);
  if (!sim) return null;
  const t = sim.tectonics;
  const plates = t.plates;
  return (
    <section className="plates-panel">
      <p className="hint small tight">
        Plates are rigid and move at a set speed; where they meet, the ground deforms. Simplified: no mantle is simulated and plate outlines do
        not move.
      </p>
      <h3>Plate map</h3>
      <div className="row">
        <label className="field inline">
          <span className="field-label">Plates {count}</span>
          <input type="range" min={2} max={8} value={count} onChange={(e) => setCount(+e.target.value)} />
        </label>
        <button
          className="small"
          onClick={() => {
            const s = seed + 1;
            setSeed(s);
            engine.newPlates(count, s);
            set({ terrainOverlay: 'plates' });
          }}
        >
          New plates
        </button>
      </div>
      {plates.length < 2 && <p className="hint small tight">Press New plates to divide the map into moving plates.</p>}
      {plates.map((p) => {
        const speed = Math.hypot(p.vxMmYr, p.vyMmYr);
        // Direction the plate moves TOWARDS, as a compass bearing.
        const bearing = (((Math.atan2(p.vxMmYr, p.vyMmYr) * 180) / Math.PI + 360) % 360) || 0;
        const setMotion = (spd: number, brg: number) => {
          const a = (brg * Math.PI) / 180;
          engine.setPlate(p.id, { vxMmYr: Math.round(Math.sin(a) * spd * 10) / 10, vyMmYr: Math.round(Math.cos(a) * spd * 10) / 10 });
        };
        return (
          <div key={p.id} className="plate-row">
            <div className="plate-head">
              <i className="plate-swatch" style={{ background: hex(PLATE_COLOURS[p.id % PLATE_COLOURS.length]) }} />
              <b>{p.name}</b>
              <select value={p.kind} onChange={(e) => engine.setPlate(p.id, { kind: e.target.value as 'continental' | 'oceanic' })} aria-label={`${p.name} type`}>
                <option value="continental">continental</option>
                <option value="oceanic">oceanic</option>
              </select>
            </div>
            <label className="field">
              <span className="field-label">
                Speed <b>{speed.toFixed(0)} mm/yr</b>
              </span>
              <input type="range" min={0} max={100} value={Math.round(speed)} onChange={(e) => setMotion(+e.target.value, bearing)} />
            </label>
            <label className="field">
              <span className="field-label">
                Moving towards <b>{COMPASS[Math.round(bearing / 45) % 8]} ({Math.round(bearing)}°)</b>
              </span>
              <input type="range" min={0} max={359} value={Math.round(bearing)} onChange={(e) => setMotion(Math.max(speed, 1), +e.target.value)} />
            </label>
          </div>
        );
      })}
      <button className="small" onClick={() => set({ dialog: 'subduction' })}>
        Open subduction zone cross-section
      </button>
      <h3>Run</h3>
      <label className="field check">
        <input type="checkbox" checked={t.enabled} disabled={plates.length < 2} onChange={(e) => engine.setTectonicsParams({ enabled: e.target.checked })} />
        <span>Plates move while the simulation plays</span>
      </label>
      <label className="field">
        <span className="field-label">
          Tectonic time <b>{t.yearsPerSimHour.toLocaleString()} years per simulated hour</b>
        </span>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(((Math.log10(t.yearsPerSimHour) - 3) / 3) * 100)}
          onChange={(e) => engine.setTectonicsParams({ yearsPerSimHour: Math.round(Math.pow(10, 3 + (+e.target.value / 100) * 3) / 100) * 100 })}
        />
      </label>
      <label className="field">
        <span className="field-label">
          Mountain belt half-width <b>{(t.beltWidthM / 1000).toFixed(1)} km</b>
        </span>
        <input type="range" min={2} max={100} value={Math.round(t.beltWidthM / 100)} onChange={(e) => engine.setTectonicsParams({ beltWidthM: +e.target.value * 100 })} />
      </label>
      <div className="field">
        <span className="field-label">Map colours</span>
        <div className="seg">
          <button className={overlay === 'plates' ? 'active' : ''} onClick={() => set({ terrainOverlay: overlay === 'plates' ? 'none' : 'plates' })}>
            {overlay === 'plates' ? 'Showing plates' : 'Show plates and boundaries'}
          </button>
        </div>
      </div>
      <p className="hint small tight">
        Boundaries: {t.convergent} cells colliding, {t.divergent} pulling apart, {t.transform} sliding past. After {Math.round(t.years).toLocaleString()} years:
        raised {fmtVol(t.upliftedM3)}, lowered {fmtVol(t.subsidedM3)}; highest point {Math.round(t.maxElevM)} m. Sliding faults have
        moved {(t.slipM / 1000).toFixed(1)} km ({t.shifts} one-cell offsets: rivers and ridges crossing them shift sideways). Rifts sink in
        fault-bounded steps. Where an ocean plate sinks, {t.vents} volcanoes grow inland of the trench ({fmtVol(t.volcanicM3)} of volcanic rock). Use the Profile tool for a
        cross-section with the plates marked.
      </p>
    </section>
  );
}
