import { useUi } from '../state/uiStore';
import { engine } from './runtime';
import { wavePower } from '../sim/coast/coastSim';

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const fmtVol = (m3: number) => (m3 >= 1e6 ? `${(m3 / 1e6).toFixed(2)} million m³` : m3 >= 1e3 ? `${(m3 / 1e3).toFixed(1)} thousand m³` : `${m3.toFixed(0)} m³`);

/** Sea level, wave climate and coastal budget (spec E6, F2). */
export function CoastPanel() {
  const sim = useUi((s) => s.sim);
  const world = useUi((s) => s.world);
  const overlay = useUi((s) => s.terrainOverlay);
  const set = useUi((s) => s.set);
  if (!sim || !world) return null;
  const c = sim.coast;
  const P = wavePower(c.waveHeightM, c.wavePeriodS);
  const lo = Math.floor(sim.zMin);
  const hi = Math.ceil(Math.min(sim.zMax, sim.zMin + Math.max(50, (sim.zMax - sim.zMin) * 0.6)));
  return (
    <section className="coast-panel">
      <h3>Sea level</h3>
      <label className="field">
        <span className="field-label">
          Sea level <b>{world.seaLevelM.toFixed(1)} m</b>
        </span>
        <input type="range" min={lo} max={hi} step={0.5} value={world.seaLevelM} onChange={(e) => engine.setSeaLevel(+e.target.value)} />
      </label>
      <p className="hint small tight">Raise to drown valleys (rias) and low coasts; lower to expose the shelf.</p>
      <h3>Waves</h3>
      <label className="field check">
        <input type="checkbox" checked={c.wavesOn} onChange={(e) => engine.setCoastParams({ wavesOn: e.target.checked })} />
        <span>Waves attack the coast and drive longshore drift</span>
      </label>
      <label className="field">
        <span className="field-label">
          Wave height <b>{c.waveHeightM.toFixed(1)} m</b>
        </span>
        <input type="range" min={0} max={60} value={Math.round(c.waveHeightM * 10)} onChange={(e) => engine.setCoastParams({ waveHeightM: +e.target.value / 10 })} />
      </label>
      <label className="field">
        <span className="field-label">
          Wave period <b>{c.wavePeriodS.toFixed(0)} s</b>
        </span>
        <input type="range" min={3} max={16} value={c.wavePeriodS} onChange={(e) => engine.setCoastParams({ wavePeriodS: +e.target.value })} />
      </label>
      <label className="field">
        <span className="field-label">
          Waves from <b>{COMPASS[Math.round(c.waveFromDeg / 45) % 8]} ({Math.round(c.waveFromDeg)}°)</b>
        </span>
        <input type="range" min={0} max={359} value={c.waveFromDeg} onChange={(e) => engine.setCoastParams({ waveFromDeg: +e.target.value })} />
      </label>
      <p className="hint small tight">
        Deep-water wave power {(P / 1000).toFixed(1)} kW per metre of coast. Oblique waves drive drift along the shore; shelter, refraction
        and shallow water reduce what reaches each cliff.
      </p>
      <div className="field">
        <span className="field-label">Wave attack map</span>
        <div className="seg">
          <button className={overlay === 'waves' ? 'active' : ''} onClick={() => set({ terrainOverlay: overlay === 'waves' ? 'none' : 'waves' })}>
            {overlay === 'waves' ? 'Showing wave attack' : 'Show wave attack'}
          </button>
        </div>
      </div>
      <h3>Coastal budget</h3>
      <dl className="budget">
        <dt>Cliff erosion</dt>
        <dd>{fmtVol(c.cliffEroded)}</dd>
        <dt>of which bedrock</dt>
        <dd>{fmtVol(c.cliffBedrock)}</dd>
        <dt>Laid offshore</dt>
        <dd>{fmtVol(c.nearshoreDeposited)}</dd>
        <dt title="Sum of cell-to-cell transfers: a grain moved five cells counts five times">Drift transport (summed)</dt>
        <dd>{fmtVol(c.drifted)}</dd>
      </dl>
      <p className="hint small">Coastal changes run every 10 simulated minutes and use the Erosion panel's geomorphic acceleration.</p>
    </section>
  );
}
