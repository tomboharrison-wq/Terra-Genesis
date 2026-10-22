import { useUi } from '../state/uiStore';
import { engine } from './runtime';
import { MM_PER_H } from '../engine/world';

function fmtVol(m3: number) {
  const a = Math.abs(m3);
  if (a >= 1e9) return `${(m3 / 1e9).toFixed(2)} km³`;
  if (a >= 1e6) return `${(m3 / 1e6).toFixed(2)} million m³`;
  if (a >= 1e3) return `${(m3 / 1e3).toFixed(1)} thousand m³`;
  return `${m3.toFixed(1)} m³`;
}

function MmSlider({ label, value, max, onChange, title }: { label: string; value: number; max: number; onChange: (v: number) => void; title?: string }) {
  return (
    <label className="field" title={title}>
      <span className="field-label">
        {label}
        <b>{value < 10 ? value.toFixed(1) : Math.round(value)} mm/h</b>
      </span>
      <input type="range" min={0} max={max} step={max > 100 ? 1 : 0.5} value={value} onChange={(e) => onChange(+e.target.value)} />
    </label>
  );
}

/** Hydrology forcing, boundaries, springs and the live water budget. */
export function WaterPanel() {
  const sim = useUi((s) => s.sim);
  const world = useUi((s) => s.world);
  if (!sim || !world) return null;
  const rainNote =
    sim.rainMmH === 0 ? 'No rain' : sim.rainMmH < 4 ? 'Light rain' : sim.rainMmH < 16 ? 'Moderate rain' : sim.rainMmH < 50 ? 'Heavy rain' : 'Extreme / exaggerated rain';
  return (
    <section className="water-panel">
      <h3>Water &amp; weather</h3>
      <MmSlider label={sim.climate.enabled ? 'Rainfall (map average)' : 'Rainfall (whole map)'} value={sim.rainMmH} max={300} onChange={(v) => engine.setWaterParams({ rainMPerS: v * MM_PER_H })} title="Rain adds real water volume to every land cell each step." />
      <p className="hint small tight">{rainNote}. UK heavy storms ≈ 20–50 mm/h; higher values speed up river formation.</p>
      <MmSlider label="Infiltration" value={sim.infMmH} max={50} onChange={(v) => engine.setWaterParams({ infiltrationMPerS: v * MM_PER_H })} title="Water soaking into the ground (removed and ledgered; groundwater arrives later)." />
      <MmSlider label="Evaporation" value={sim.evapMmH} max={10} onChange={(v) => engine.setWaterParams({ evaporationMPerS: v * MM_PER_H })} />
      <div className="field">
        <span className="field-label">Map edges</span>
        <div className="seg">
          <button className={sim.boundary === 'open' ? 'active' : ''} onClick={() => engine.setWaterParams({ boundary: 'open' })} title="Water flows freely off the map edge">
            Open outflow
          </button>
          <button className={sim.boundary === 'closed' ? 'active' : ''} onClick={() => engine.setWaterParams({ boundary: 'closed' })} title="Edges act as walls">
            Closed walls
          </button>
        </div>
      </div>
      {sim.sources.length > 0 && (
        <div className="field">
          <span className="field-label">Springs</span>
          <ul className="springs">
            {sim.sources.map((s) => (
              <li key={s.id}>
                <span>
                  #{s.id} at [{s.x}, {s.y}] · {s.rateM3PerS.toFixed(1)} m³/s
                </span>
                <button className="small ghost danger" onClick={() => engine.removeSource(s.id)}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <button className="small" onClick={() => engine.clearWater()}>
        Clear all surface water
      </button>
      <h3>Water budget</h3>
      <dl className="budget">
        <dt>Stored on land</dt>
        <dd>{fmtVol(sim.storedM3)}</dd>
        <dt>Total in</dt>
        <dd>{fmtVol(sim.inM3)}</dd>
        <dt>Total out</dt>
        <dd>{fmtVol(sim.outM3)}</dd>
        <dt title="Relative mismatch between stored water and inputs − outputs">Balance error</dt>
        <dd>{(sim.closure * 100).toFixed(4)}%</dd>
        <dt>Deepest</dt>
        <dd>{sim.maxDepthM.toFixed(2)} m</dd>
        <dt>Fastest flow</dt>
        <dd>{sim.maxSpeedMS.toFixed(2)} m/s</dd>
      </dl>
    </section>
  );
}
