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
  const g = sim.glacier;
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
          freezing level {freezeM > 0 ? `${Math.round(freezeM)} m above sea level` : 'below sea level'}. No evaporation below 0 °C.
        </p>
        <h3>Snow</h3>
        <label className="field">
          <span className="field-label">
            Melt rate <b>{c.meltMmPerDegDay.toFixed(1)} mm per °C per day</b>
          </span>
          <input type="range" min={1} max={10} step={0.5} value={c.meltMmPerDegDay} onChange={(e) => setC({ meltMmPerDegDay: +e.target.value })} />
        </label>
        <p className="hint small tight">
          Below 0 °C rain falls as snow and builds a snowpack; above 0 °C the pack melts into streams. Snow on the map:{' '}
          <b>{c.snowM3 >= 1e6 ? `${(c.snowM3 / 1e6).toFixed(2)} million` : Math.round(c.snowM3).toLocaleString()} m³</b> of water, covering{' '}
          {c.snowCoverPct.toFixed(0)}% of the land. Fallen so far {Math.round(c.snowfallM3).toLocaleString()} m³, melted{' '}
          {Math.round(c.snowmeltM3).toLocaleString()} m³.
        </p>
        <h3>Glaciers</h3>
        <label className="field check">
          <input type="checkbox" checked={g.enabled} onChange={(e) => engine.setGlacierParams({ enabled: e.target.checked })} />
          <span>Glaciers grow above the snowline, flow downhill and erode their beds</span>
        </label>
        <label className="field">
          <span className="field-label">
            Snowline (equilibrium line) <b>{Math.round(g.elaM)} m</b>
          </span>
          <input type="range" min={-16} max={2} step={0.5} value={g.elaTempC} onChange={(e) => engine.setGlacierParams({ elaTempC: +e.target.value })} />
        </label>
        <label className="field">
          <span className="field-label">
            Glacier time <b>{g.yearsPerSimHour} years per simulated hour</b>
          </span>
          <input type="range" min={0} max={100} value={Math.round(Math.log10(g.yearsPerSimHour) * 33.3)} onChange={(e) => engine.setGlacierParams({ yearsPerSimHour: Math.max(1, Math.round(Math.pow(10, +e.target.value / 33.3))) })} />
        </label>
        <label className="field">
          <span className="field-label">
            Erosion by ice <b>{(g.abrasionK * 1e4).toFixed(1)} m per 10 km of sliding</b>
          </span>
          <input type="range" min={0} max={50} value={Math.round(g.abrasionK * 1e4 * 5)} onChange={(e) => engine.setGlacierParams({ abrasionK: +e.target.value / 5 / 1e4 })} />
        </label>
        <p className="hint small tight">
          Ice {g.iceM3 >= 1e6 ? `${(g.iceM3 / 1e9).toFixed(3)} km³` : `${Math.round(g.iceM3).toLocaleString()} m³`} over {g.iceAreaPct.toFixed(0)}% of the land, up to{' '}
          {Math.round(g.maxIceM)} m thick, sliding up to {Math.round(g.maxSlideMPerYr)} m/yr. After {g.years.toFixed(0)} glacier years
          {g.lagYears > 0.5 ? ` (${g.lagYears.toFixed(0)} behind: very fast ice limits the time step)` : ''}: eroded{' '}
          {Math.round(g.erodedM3).toLocaleString()} m³, {Math.round(g.morainedM3).toLocaleString()} m³ dropped as moraine.
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
