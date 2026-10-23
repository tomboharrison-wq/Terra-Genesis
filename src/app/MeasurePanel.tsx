import { useMemo } from 'react';
import { useUi, type MeasurePin } from '../state/uiStore';
import { compass, pinPair, readCell, type CellReading } from '../terrain/measure';
import { engine } from './runtime';

const fmtDist = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${m.toFixed(0)} m`);
const fmtLen = (m: number) => (m < 1 ? `${(m * 100).toFixed(0)} cm` : m < 10 ? `${m.toFixed(2)} m` : `${m.toFixed(1)} m`);

/** Rows shown for a pin: label and formatted value, only for quantities that exist there. */
function rows(r: CellReading): [string, string][] {
  const out: [string, string][] = [
    ['Elevation', `${r.elevationM.toFixed(1)} m`],
    ['Slope', `${r.slopeDeg.toFixed(1)}°`],
    ['Faces', r.aspectDeg === null ? 'flat' : `${compass(r.aspectDeg)} (${Math.round(r.aspectDeg)}°)`],
    ['Rock', r.rock],
    ['Soil / loose', fmtLen(r.soilM)],
  ];
  if (r.sea) out.push(['Water', 'sea']);
  else if (r.waterDepthM > 0.001) {
    out.push(['Water depth', fmtLen(r.waterDepthM)]);
    out.push(['Water speed', `${r.waterSpeedMS.toFixed(2)} m/s`]);
    out.push(['Outflow', `${r.outflowM3S.toFixed(r.outflowM3S < 10 ? 2 : 0)} m³/s`]);
  } else out.push(['Water', 'dry']);
  if (r.temperatureC !== null) out.push(['Temperature', `${r.temperatureC.toFixed(1)} °C`]);
  if (r.rainMmH > 0) out.push(['Rain here', `${r.rainMmH.toFixed(1)} mm/h`]);
  if (r.plantsPct >= 0.5) out.push(['Plant cover', `${Math.round(r.plantsPct)}%`]);
  if (r.snowMm >= 0.5) out.push(['Snow (water)', `${Math.round(r.snowMm)} mm`]);
  if (r.iceM > 0.05) out.push(['Ice', fmtLen(r.iceM)]);
  if (r.ashM > 0.001) out.push(['Ash / cinder', fmtLen(r.ashM)]);
  if (r.lavaM > 0) out.push(['Lava', `${fmtLen(r.lavaM)} at ${Math.round(r.lavaC ?? 0)} °C`]);
  return out;
}

/** Measure tool: pinned points with real values, and pairwise distance / bearing / gradient (spec F4). */
export function MeasurePanel() {
  const pins = useUi((s) => s.pins);
  const tick = useUi((s) => s.stats?.fps); // refresh at the stats cadence (~2 Hz)
  const simT = useUi((s) => s.sim?.simTimeS);
  const set = useUi((s) => s.set);
  const readings = useMemo(() => pins.map((p) => readCell(engine, p.xM, p.yM)), [pins, tick, simT]);
  const remove = (p: MeasurePin) => set({ pins: pins.filter((q) => q !== p) });
  const pairs = pins.slice(1).map((b, k) => ({ a: pins[k], b, p: pinPair(engine, pins[k].xM, pins[k].yM, b.xM, b.yM) }));
  const total = pairs.reduce((s, q) => s + q.p.distanceM, 0);

  return (
    <section className="measure-panel">
      {pins.length === 0 && <p className="hint small">Click the terrain to drop pin A, then B, C… (up to 6). Values update as the world changes.</p>}
      {pins.map((p, k) => (
        <div key={p.label} className="pin-card">
          <div className="pin-head">
            <b className="pin-label">{p.label}</b>
            <span className="muted small">
              {fmtDist(p.xM)} E, {fmtDist(p.yM)} N · cell [{readings[k].cellX}, {readings[k].cellY}]
            </span>
            <button className="icon ghost small" aria-label={`Remove pin ${p.label}`} onClick={() => remove(p)}>
              ×
            </button>
          </div>
          <dl className="pin-values">
            {rows(readings[k]).map(([name, v]) => (
              <div key={name}>
                <dt>{name}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
      {pairs.length > 0 && (
        <>
          <h3>Between pins</h3>
          <table className="values pairs">
            <thead>
              <tr>
                <th>Pins</th>
                <th>Distance</th>
                <th>Bearing</th>
                <th>Rise</th>
                <th>Gradient</th>
              </tr>
            </thead>
            <tbody>
              {pairs.map(({ a, b, p }) => (
                <tr key={a.label + b.label}>
                  <td>
                    {a.label}→{b.label}
                  </td>
                  <td>{fmtDist(p.distanceM)}</td>
                  <td>
                    {Math.round(p.bearingDeg)}° {compass(p.bearingDeg)}
                  </td>
                  <td>
                    {p.riseM >= 0 ? '+' : ''}
                    {p.riseM.toFixed(1)} m
                  </td>
                  <td>{(100 * p.gradient).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
          {pairs.length > 1 && <p className="hint small tight">Total path {fmtDist(total)} (straight lines between pins, horizontal distance).</p>}
          <div className="row">
            <button
              className="small"
              onClick={() =>
                set({ profile: { ax: pins[0].xM, ay: pins[0].yM, bx: pins[pins.length - 1].xM, by: pins[pins.length - 1].yM }, profileStart: null })
              }
            >
              Cross-section {pins[0].label}→{pins[pins.length - 1].label}
            </button>
          </div>
        </>
      )}
      {pins.length > 0 && (
        <div className="row">
          <button className="small ghost" onClick={() => set({ pins: [] })}>
            Clear pins
          </button>
        </div>
      )}
      <p className="hint small tight">Every value is read from the simulation at the pin’s map cell; rise and gradient use the ground surface.</p>
    </section>
  );
}
