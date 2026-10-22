import { useUi } from '../state/uiStore';
import { engine } from './runtime';
import { MM_PER_H } from '../engine/world';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

/** Season phase (0 = mid-winter ≈ mid-January) → month name. */
const monthOf = (phase: number) => MONTHS[Math.floor((((phase + 0.5 / 12) % 1) + 1) % 1 * 12) % 12];

/** Temperature, seasons, wind and orographic rain (spec E7). */
export function ClimatePanel() {
  const sim = useUi((s) => s.sim);
  const overlay = useUi((s) => s.terrainOverlay);
  const set = useUi((s) => s.set);
  if (!sim) return null;
  const c = sim.climate;
  const on = c.enabled;
  const setC = engine.setClimateParams.bind(engine);
  const seasonal = -c.seasonalAmpC * Math.cos(2 * Math.PI * c.seasonPhase);
  const freezeM = ((c.seaLevelTempC + seasonal) / c.lapseRateCPerKm) * 1000;
  const windRad = (c.windFromDeg * Math.PI) / 180;
  return (
    <section className="climate-panel">
      <label className="field check">
        <input type="checkbox" checked={on} onChange={(e) => setC({ enabled: e.target.checked })} />
        <span>Climate on: rain and evaporation vary with height, wind and season</span>
      </label>
      {!on && <p className="hint small tight">Off: the same rain falls everywhere and evaporation is uniform (as in the Water panel).</p>}
      <h3>Rain and evaporation</h3>
      <label className="field">
        <span className="field-label">
          Rainfall (map average) <b>{sim.rainMmH < 10 ? sim.rainMmH.toFixed(1) : Math.round(sim.rainMmH)} mm/h</b>
        </span>
        <input type="range" min={0} max={300} step={1} value={sim.rainMmH} onChange={(e) => engine.setWaterParams({ rainMPerS: +e.target.value * MM_PER_H })} />
      </label>
      <label className="field">
        <span className="field-label">
          Evaporation at sea level <b>{sim.evapMmH.toFixed(1)} mm/h</b>
        </span>
        <input type="range" min={0} max={10} step={0.5} value={sim.evapMmH} onChange={(e) => engine.setWaterParams({ evaporationMPerS: +e.target.value * MM_PER_H })} />
      </label>
      <fieldset disabled={!on} className="plain">
        <h3>Temperature</h3>
        <label className="field">
          <span className="field-label">
            Sea-level average <b>{c.seaLevelTempC.toFixed(0)} °C</b>
          </span>
          <input type="range" min={-15} max={30} value={c.seaLevelTempC} onChange={(e) => setC({ seaLevelTempC: +e.target.value })} />
        </label>
        <label className="field">
          <span className="field-label">
            Lapse rate <b>{c.lapseRateCPerKm.toFixed(1)} °C per km</b>
          </span>
          <input type="range" min={4} max={10} step={0.5} value={c.lapseRateCPerKm} onChange={(e) => setC({ lapseRateCPerKm: +e.target.value })} />
        </label>
        <label className="field">
          <span className="field-label">
            Time of year <b>{monthOf(c.seasonPhase)}</b>
          </span>
          <input type="range" min={0} max={100} value={Math.round(c.seasonPhase * 100)} onChange={(e) => setC({ seasonPhase: +e.target.value / 100 })} />
        </label>
        <label className="field check">
          <input type="checkbox" checked={c.seasonsRun} onChange={(e) => setC({ seasonsRun: e.target.checked })} />
          <span>Seasons follow simulated time (one year = 365 simulated days)</span>
        </label>
        <label className="field">
          <span className="field-label">
            Summer–winter swing <b>±{c.seasonalAmpC.toFixed(0)} °C</b>
          </span>
          <input type="range" min={0} max={25} value={c.seasonalAmpC} onChange={(e) => setC({ seasonalAmpC: +e.target.value })} />
        </label>
        <p className="hint small tight">
          Now: land from {Number.isFinite(c.landTempMinC) ? c.landTempMinC.toFixed(1) : '—'} to {Number.isFinite(c.landTempMaxC) ? c.landTempMaxC.toFixed(1) : '—'} °C ·
          freezing level {freezeM > 0 ? `${Math.round(freezeM)} m above sea level` : 'below sea level'}. No evaporation below 0 °C; snow is planned
          (rain stays liquid for now).
        </p>
        <h3>Wind and rain shadow</h3>
        <div className="compass-row">
          <svg className="compass" viewBox="-30 -30 60 60" aria-hidden="true">
            <circle r={26} fill="none" stroke="currentColor" opacity={0.35} />
            <text y={-17} textAnchor="middle" fontSize={9} fill="currentColor">
              N
            </text>
            <line x1={Math.sin(windRad) * 22} y1={-Math.cos(windRad) * 22} x2={-Math.sin(windRad) * 14} y2={Math.cos(windRad) * 14} stroke="var(--scouts-yellow)" strokeWidth={3} />
            <circle cx={-Math.sin(windRad) * 14} cy={Math.cos(windRad) * 14} r={4} fill="var(--scouts-yellow)" />
          </svg>
          <label className="field" style={{ flex: 1 }}>
            <span className="field-label">
              Wind from <b>{COMPASS[Math.round(c.windFromDeg / 45) % 8]} ({Math.round(c.windFromDeg)}°)</b>
            </span>
            <input type="range" min={0} max={359} value={c.windFromDeg} onChange={(e) => setC({ windFromDeg: +e.target.value })} />
          </label>
        </div>
        <label className="field">
          <span className="field-label">
            Extra rain on windward slopes <b>{c.orographic.toFixed(1)}×</b>
          </span>
          <input type="range" min={0} max={30} value={Math.round(c.orographic * 10)} onChange={(e) => setC({ orographic: +e.target.value / 10 })} />
        </label>
        <label className="field">
          <span className="field-label">
            Rain-shadow strength <b>{Math.round(100000 / c.shadowScaleM) / 100}</b>
          </span>
          <input type="range" min={0} max={100} value={Math.round(100 - (Math.log10(c.shadowScaleM) - 2) * 50)} onChange={(e) => setC({ shadowScaleM: Math.pow(10, 2 + (100 - +e.target.value) / 50) })} />
        </label>
        <p className="hint small tight">
          Rain here ranges from {Number.isFinite(c.rainMinX) ? c.rainMinX.toFixed(2) : '—'}× to {Number.isFinite(c.rainMaxX) ? c.rainMaxX.toFixed(2) : '—'}× the map average:
          moist air rising over high ground rains out; downwind of it, in the rain shadow, it is drier.
        </p>
        <div className="field">
          <span className="field-label">Map colours</span>
          <div className="seg">
            <button className={overlay === 'temperature' ? 'active' : ''} onClick={() => set({ terrainOverlay: overlay === 'temperature' ? 'none' : 'temperature' })}>
              Temperature
            </button>
            <button className={overlay === 'rainfall' ? 'active' : ''} onClick={() => set({ terrainOverlay: overlay === 'rainfall' ? 'none' : 'rainfall' })}>
              Rainfall
            </button>
          </div>
        </div>
      </fieldset>
      <p className="hint small">
        Simplified: temperature falls with height at the lapse rate; rain is boosted where wind blows uphill and reduced behind higher ground
        upwind. No clouds, humidity or storms are simulated.
      </p>
    </section>
  );
}
