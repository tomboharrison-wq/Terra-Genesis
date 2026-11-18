import { useUi } from '../state/uiStore';
import { engine, syncSim } from './runtime';
import { waterfallMetrics } from '../sim/river/solidWaterfall';

export function SolidWaterfallPanel() {
  useUi((s) => s.geo);
  const s = engine.world.meta.solidWaterfall!;
  const m = waterfallMetrics(s);
  const edit = (key: 'dischargeM3PerS' | 'maxSpanM' | 'weakErosionMYr' | 'hardFactor', value: number) => {
    s[key] = value;
    engine.markDirty({ x0: 0, y0: 0, x1: engine.world.width, y1: engine.world.height });
    syncSim();
  };
  return <aside className="panel" aria-label="Solid waterfall controls">
    <div className="panel-head"><h2>Live river waterfall</h2></div>
    <p className="hint">River discharge attacks the exposed soft rock. An unsupported cap collapses, moving the waterfall upstream and leaving a gorge in the main landscape.</p>
    <p>Retreat: <b>{m.retreatM} m</b><br />Undercut: <b>{m.undercutM} m</b><br />Plunge pool: <b>{m.poolDepthM} m deep</b><br />Collapsed rock: <b>{s.collapsedM3.toLocaleString()} m³</b></p>
    <label className="field"><span>River discharge <b>{s.dischargeM3PerS} m³/s</b></span><input aria-label="River discharge" type="range" min={0} max={24} step={1} value={s.dischargeM3PerS} onChange={(e) => edit('dischargeM3PerS', +e.target.value)} /></label>
    <label className="field"><span>Supported cap span <b>{s.maxSpanM} m</b></span><input aria-label="Supported cap span" type="range" min={1} max={8} step={1} value={s.maxSpanM} onChange={(e) => edit('maxSpanM', +e.target.value)} /></label>
    <label className="field"><span>Soft-rock erosion <b>{s.weakErosionMYr.toFixed(2)} m/yr</b></span><input aria-label="Soft-rock erosion" type="range" min={0.01} max={0.2} step={0.01} value={s.weakErosionMYr} onChange={(e) => edit('weakErosionMYr', +e.target.value)} /></label>
    <label className="field"><span>Cap erodibility <b>{s.hardFactor.toFixed(2)} × soft rock</b></span><input aria-label="Cap erodibility" type="range" min={0.01} max={0.3} step={0.01} value={s.hardFactor} onChange={(e) => edit('hardFactor', +e.target.value)} /></label>
    <p className="hint small">One-metre longitudinal rock model extruded across an eight-metre river. Flow is quasi-steady; the falling sheet uses discharge and gravity. Illustrative erosion rates, no turbulent flow solver. Removed and collapsed rock is recorded as exported debris.</p>
  </aside>;
}
