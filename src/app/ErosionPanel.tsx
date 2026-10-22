import { useUi } from '../state/uiStore';
import { engine } from './runtime';

function fmtVol(m3: number) {
  const a = Math.abs(m3);
  if (a >= 1e6) return `${(m3 / 1e6).toFixed(2)} million m³`;
  if (a >= 1e3) return `${(m3 / 1e3).toFixed(1)} thousand m³`;
  return `${m3.toFixed(1)} m³`;
}

/** Erosion / deposition controls and the sediment budget (spec E2). */
export function ErosionPanel() {
  const sim = useUi((s) => s.sim);
  const overlay = useUi((s) => s.terrainOverlay);
  const set = useUi((s) => s.set);
  if (!sim) return null;
  const toPos = (v: number) => (Math.log10(v) / 3) * 1000;
  const fromPos = (p: number) => Math.pow(10, (p / 1000) * 3);
  const S = sim.sed;
  return (
    <section className="erosion-panel">
      <h3>Erosion &amp; deposition</h3>
      <label className="field check">
        <input type="checkbox" checked={sim.erosionOn} onChange={(e) => engine.setErosionParams({ enabled: e.target.checked })} />
        <span>Flowing water erodes, carries and deposits sediment</span>
      </label>
      <label className="field" title="Multiplies erosion and deposition rates together. Real landscapes change over centuries; this compresses time for landform change only (water still runs at the clock speed).">
        <span className="field-label">
          Geomorphic acceleration <b>×{sim.speedup < 10 ? sim.speedup.toFixed(1) : Math.round(sim.speedup)}</b>
        </span>
        <input type="range" min={0} max={1000} value={toPos(sim.speedup)} onChange={(e) => engine.setErosionParams({ speedup: fromPos(+e.target.value) })} />
      </label>
      <p className="hint small tight">Non-physical time compression for landform change. ×1 = calibrated base rates.</p>
      <label className="field" title="How much harder bedrock is to erode than loose sediment (multiplied by each rock type's erodibility).">
        <span className="field-label">
          Bedrock vs soil erodibility <b>{(sim.bedrockFactor * 100).toFixed(0)}%</b>
        </span>
        <input type="range" min={1} max={100} value={Math.round(sim.bedrockFactor * 100)} onChange={(e) => engine.setErosionParams({ bedrockFactor: +e.target.value / 100 })} />
      </label>
      <label className="field" title="Soil creep: loose sediment slowly diffuses downslope (rounds hilltops, fills hollows). Off by default; at high acceleration it also smooths fine terrain detail.">
        <span className="field-label">
          Hillslope creep <b>{sim.creepK === 0 ? 'off' : `${(sim.creepK * 1e5).toFixed(1)}×10⁻⁵ m²/s`}</b>
        </span>
        <input type="range" min={0} max={20} value={Math.round(sim.creepK * 1e5)} onChange={(e) => engine.setErosionParams({ creepK: +e.target.value * 1e-5 })} />
      </label>
      <div className="field">
        <span className="field-label">Change map</span>
        <div className="seg">
          <button className={overlay === 'change' ? 'active' : ''} onClick={() => set({ terrainOverlay: overlay === 'change' ? 'none' : 'change' })} title="Colour terrain by elevation change since the reference">
            {overlay === 'change' ? 'Showing change' : 'Show change'}
          </button>
          <button onClick={() => engine.setReference()} title="Make the current terrain the zero line of the change map">
            Reset reference
          </button>
        </div>
      </div>
      <h3>Sediment budget</h3>
      <dl className="budget">
        <dt>Eroded soil</dt>
        <dd>{fmtVol(S.erodedLoose)}</dd>
        <dt>Eroded bedrock</dt>
        <dd>{fmtVol(S.erodedBedrock)}</dd>
        <dt>Deposited on land</dt>
        <dd>{fmtVol(S.deposited)}</dd>
        <dt>Deposited in sea</dt>
        <dd>{fmtVol(S.seaDeposited)}</dd>
        <dt>Carried off map</dt>
        <dd>{fmtVol(S.exported)}</dd>
        <dt>In suspension</dt>
        <dd>{fmtVol(S.suspended)}</dd>
        <dt title="Suspended sediment vs eroded − deposited − exported">Balance error</dt>
        <dd>{(S.closure * 100).toFixed(4)}%</dd>
      </dl>
    </section>
  );
}
