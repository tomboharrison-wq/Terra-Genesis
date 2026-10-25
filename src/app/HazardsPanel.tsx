import { useState } from 'react';
import { useUi } from '../state/uiStore';
import { engine } from './runtime';
import { fmtSimTime } from './TimeBar';
import { FLOOD_THRESHOLD_M } from '../sim/events/hazards';

const fmtSpan = (s: number) => (s >= 3600 ? `${(s / 3600).toFixed(s >= 36000 ? 0 : 1)} h` : `${Math.round(s / 60)} min`);

function Slider(p: { label: string; value: string; min: number; max: number; step: number; v: number; onChange: (v: number) => void }) {
  return (
    <label className="field">
      <span className="field-label">
        {p.label} <b>{p.value}</b>
      </span>
      <input type="range" min={p.min} max={p.max} step={p.step} value={p.v} onChange={(e) => p.onChange(+e.target.value)} />
    </label>
  );
}

const fmtArea = (m2: number) => (m2 >= 1e5 ? `${(m2 / 1e6).toFixed(2)} km²` : `${Math.round(m2).toLocaleString()} m²`);

/** Water hazards (spec E12): storm, sea surge and drought events, what they did, an event log and a comparison table. */
export function HazardsPanel() {
  useUi((s) => s.sim); // re-render on every simulation sync
  const overlay = useUi((s) => s.terrainOverlay);
  const set = useUi((s) => s.set);
  const [rain, setRain] = useState(60);
  const [hours, setHours] = useState(3);
  const [surge, setSurge] = useState(4);
  const [minutes, setMinutes] = useState(45);
  const [days, setDays] = useState(10);
  const [evap, setEvap] = useState(6);
  const [checkpoint, setCheckpoint] = useState(true);
  const hz = engine.hazard;
  const running = !!hz && !hz.done;
  const f = engine.floodSummary();
  const dr = engine.droughtSummary();
  const results = engine.hazardLog.filter((l) => l.result);

  const start = (kind: 'storm' | 'surge' | 'drought') => {
    const label = kind === 'storm' ? `Before storm ${rain} mm/h` : kind === 'surge' ? `Before sea surge ${surge} m` : `Before drought ${days} days`;
    if (checkpoint) engine.takeCheckpoint(`${label} (${fmtSimTime(engine.world.simTimeSeconds)})`);
    if (kind === 'storm') engine.startStorm(rain, hours);
    else if (kind === 'surge') engine.startSurge(surge, minutes);
    else engine.startDrought(days, evap);
    engine.setPlaying(true);
    set({ terrainOverlay: kind === 'drought' ? 'drought' : 'flood' });
  };
  const status = (h: NonNullable<typeof hz>) =>
    h.elapsedS >= h.activeS ? 'draining' : h.kind === 'storm' ? 'raining' : h.kind === 'surge' ? `sea ${engine.water.surgeM.toFixed(1)} m up` : 'no rain';

  return (
    <section className="hazards-panel">
      <h3>Storm</h3>
      <Slider label="Rain" value={`${rain} mm/h`} min={10} max={200} step={5} v={rain} onChange={setRain} />
      <Slider label="Lasting" value={`${hours} h`} min={0.5} max={12} step={0.5} v={hours} onChange={setHours} />
      <p className="hint small tight">
        Rain over the whole map, then back to the rain before. UK cloudbursts reach 30–100 mm/h for an hour or two. Recording carries on for 6 h while rivers
        drain.
      </p>
      <button className="small" disabled={running} onClick={() => start('storm')}>
        Start storm
      </button>

      <h3>Sea surge (simplified tsunami)</h3>
      <Slider label="Run-up height" value={`${surge} m`} min={1} max={20} step={0.5} v={surge} onChange={setSurge} />
      <Slider label="Lasting" value={`${minutes} min`} min={10} max={180} step={5} v={minutes} onChange={setMinutes} />
      <p className="hint small tight">
        The whole sea stands this much higher, rising and falling smoothly, and the water model lets it flood any land it can reach, then drain back. This is
        not a travelling wave: no wave speed, breaking or backwash force, and low inland ground below sea level rises with it.
      </p>
      <button className="small" disabled={running} onClick={() => start('surge')}>
        Start sea surge
      </button>

      <h3>Drought</h3>
      <Slider label="Lasting" value={`${days} days`} min={1} max={60} step={1} v={days} onChange={setDays} />
      <Slider label="Evaporation" value={`${evap} mm/day`} min={1} max={15} step={0.5} v={evap} onChange={setEvap} />
      <p className="hint small tight">
        No rain, and open water evaporates at this rate (a hot UK summer day ≈ 4–6 mm/day, deserts 10+). Springs keep flowing. The lowest water on every cell is
        recorded: watch lakes shrink and rivers dry up. Speed up time to run days quickly.
      </p>
      <button className="small" disabled={running} onClick={() => start('drought')}>
        Start drought
      </button>

      <label className="field check">
        <input type="checkbox" checked={checkpoint} onChange={(e) => setCheckpoint(e.target.checked)} /> Take a checkpoint before each event (to compare or try
        again)
      </label>

      {hz && (
        <>
          <h3>{running ? 'Happening now' : 'Last event'}</h3>
          <p className="hint small tight">
            <b>{hz.label}</b>
            <br />
            {running ? `${fmtSpan(hz.elapsedS)} in · ${status(hz)} · recording until ${fmtSpan(hz.recordS)}` : `Finished after ${fmtSpan(hz.elapsedS)}.`}
            {running && !useUi.getState().sim?.playing && ' — press Play to run time.'}
          </p>
          {running && (
            <button className="small ghost" onClick={() => engine.stopHazard()}>
              End event now
            </button>
          )}
        </>
      )}
      {f && (
        <>
          <dl className="budget">
            <dt title={`Land where the water rose by at least ${FLOOD_THRESHOLD_M} m (rivers and lakes already full do not count)`}>Land flooded</dt>
            <dd>{fmtArea(f.areaM2)}</dd>
            <dt>Deepest flood water</dt>
            <dd>{f.peakDepthM.toFixed(2)} m</dd>
          </dl>
          <button className={`small ${overlay === 'flood' ? 'active' : ''}`} onClick={() => set({ terrainOverlay: overlay === 'flood' ? 'none' : 'flood' })}>
            {overlay === 'flood' ? 'Hide flood extent' : 'Show flood extent map'}
          </button>
          <p className="hint small tight">
            Compare: restore the “Before …” checkpoint (Checkpoints), change something — e.g. build a levee with Raise — and run the same event again.
          </p>
        </>
      )}
      {dr && (
        <>
          <dl className="budget">
            <dt>Standing water at the start</dt>
            <dd>{fmtArea(dr.wetStartM2)}</dd>
            <dt title="Of that, water that fell below 1 cm deep">Dried up</dt>
            <dd>{fmtArea(dr.driedM2)}</dd>
            <dt>Surface water</dt>
            <dd>
              {Math.round(dr.startM3).toLocaleString()} → {Math.round(engine.water.surfaceVolume()).toLocaleString()} m³
            </dd>
          </dl>
          <button
            className={`small ${overlay === 'drought' ? 'active' : ''}`}
            onClick={() => set({ terrainOverlay: overlay === 'drought' ? 'none' : 'drought' })}
          >
            {overlay === 'drought' ? 'Hide drought map' : 'Show drought map'}
          </button>
        </>
      )}
      {results.length > 1 && (
        <>
          <h3>Compare events</h3>
          <table className="values compare-events">
            <thead>
              <tr>
                <th>Event</th>
                <th>Started</th>
                <th title="Storms and surges: land flooded. Droughts: water dried up. Meteors: crater area.">Area</th>
                <th>Measured</th>
              </tr>
            </thead>
            <tbody>
              {results.slice(-6).map((l, k) => (
                <tr key={k}>
                  <td>{l.result!.label}</td>
                  <td>{fmtSimTime(l.result!.startS)}</td>
                  <td>{fmtArea(l.result!.areaM2)}</td>
                  <td>{l.result!.measure}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      {engine.hazardLog.length > 0 && (
        <>
          <h3>Event log</h3>
          <ul className="event-log">
            {engine.hazardLog
              .slice(-8)
              .reverse()
              .map((l, k) => (
                <li key={k}>
                  <span className="muted">{fmtSimTime(l.simS)}</span> {l.text}
                </li>
              ))}
          </ul>
        </>
      )}
    </section>
  );
}
