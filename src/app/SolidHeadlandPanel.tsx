import { useUi } from '../state/uiStore';
import { engine, syncSim } from './runtime';

/** Only controls implemented by the solid-rock process model are offered in this world. */
export function SolidHeadlandPanel() {
  useUi((s) => s.geo);
  const s = engine.world.meta.solidHeadland!;
  const w = engine.world;
  const edit = (f: () => void) => {
    f();
    engine.markDirty({ x0: 0, y0: 0, x1: w.width, y1: w.height });
    syncSim();
  };
  const slider = (label: string, value: number, min: number, max: number, step: number, set: (v: number) => void) => (
    <label className="field"><span>{label} <b>{value.toFixed(step < 1 ? 1 : 0)}</b></span>
      <input aria-label={label} type="range" min={min} max={max} step={step} value={value} onChange={(e) => edit(() => set(+e.target.value))} />
    </label>
  );
  const current = s.history[s.history.length - 1].stage;
  return <aside className="panel" aria-label="Solid headland controls">
    <div className="panel-head"><h2>Live headland</h2></div>
    <p className="hint">Solid rock erodes in the main landscape. Orbit to look inside the opening. Play, step and replay use illustrative process years.</p>
    <p><b>Detected: {current}</b><br />Rock removed: {s.exportedM3.toLocaleString()} m³</p>
    <label className="field check"><input type="checkbox" checked={w.coast.wavesOn} onChange={(e) => edit(() => engine.setCoastParams({ wavesOn: e.target.checked }))} />Waves on</label>
    {slider('Wave height (m)', w.coast.waveHeightM, 0, 5, 0.1, (v) => engine.setCoastParams({ waveHeightM: v }))}
    {slider('Wave period (s)', w.coast.wavePeriodS, 3, 15, 1, (v) => engine.setCoastParams({ wavePeriodS: v }))}
    {slider('Wave bearing (degrees from north)', w.coast.waveFromDeg, 0, 360, 10, (v) => engine.setCoastParams({ waveFromDeg: v }))}
    {slider('Sea level (m)', w.seaLevelM, 4, 16, 0.5, (v) => engine.setSeaLevel(v))}
    {slider('Joint weakness', s.params.jointFactor, 1, 10, 0.5, (v) => { s.params.jointFactor = v; })}
    {slider('Supported roof span (m)', s.params.maxSpan, 0, 12, 1, (v) => { s.params.maxSpan = v; })}
    <p className="hint small">One-metre rock blocks. Wave access, joint weakness and roof support drive change. Wave direction uses a shelter factor. Debris is recorded as exported. Water inside openings is a sea surface, not a resolved wave-flow simulation.</p>
    <p className="hint small">This solid-rock world uses coastal controls. Terrain brushes and river, glacier and tectonic solvers remain available in ordinary landscape worlds.</p>
  </aside>;
}
