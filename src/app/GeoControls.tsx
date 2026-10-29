import { useState } from 'react';
import { useUi } from '../state/uiStore';
import { engine } from './runtime';
import { Icon } from './icons';
import { GEO_SPEEDS, playGeo, setGeoMode, setGeoSpeed, showFrame, stepGeo, stopGeo } from './geoRunner';
import { defaultGeoParams } from '../sim/geology/landscapeEvolution';

export function fmtGeoYears(y: number): string {
  if (y >= 1e6) return `${(y / 1e6).toFixed(2)} million`;
  return Math.round(y).toLocaleString();
}

const fmtVol = (v: number) => (v >= 1e9 ? `${(v / 1e9).toFixed(2)} km³` : v >= 1e6 ? `${(v / 1e6).toFixed(1)} million m³` : `${Math.round(v).toLocaleString()} m³`);

/** Water time (hours, the hydraulic solver) or geological time (years, the landscape evolution model). */
export function TimeModeSwitch() {
  const mode = useUi((s) => s.geo.mode);
  return (
    <div className="seg time-mode" role="group" aria-label="Time scale">
      <button className={mode ? '' : 'active'} onClick={() => setGeoMode(false)} title="Water time: rain, rivers, floods and erosion hour by hour (the water simulation)">
        Water time
      </button>
      <button
        className={mode ? 'active geo' : 'geo'}
        onClick={() => setGeoMode(true)}
        title="Geological time: thousands to millions of years of river erosion, soil creep and uplift (a long-timescale landscape model)"
      >
        Geological time
      </button>
    </div>
  );
}

/** Time bar controls in geological time: play, step, speed, year, replay timeline and model settings. */
export function GeoBar() {
  const geo = useUi((s) => s.geo);
  const [open, setOpen] = useState(false);
  const slow = geo.playing && geo.achieved > 0 && geo.achieved < geo.yearsPerSec * 0.8;
  const shownYears = geo.viewing !== null ? geo.frames[geo.viewing] : geo.years;
  return (
    <>
      <button
        className={`play ${geo.playing ? 'on' : ''}`}
        onClick={() => (geo.playing ? stopGeo() : playGeo())}
        title={geo.playing ? 'Pause geological time (P)' : 'Run geological time (P)'}
        aria-label={geo.playing ? 'Pause' : 'Play'}
      >
        <Icon name={geo.playing ? 'pause' : 'play'} />
      </button>
      <button className="icon" disabled={geo.playing || geo.busy} onClick={() => stepGeo(geo.yearsPerSec)} title={`Step ${fmtGeoYears(geo.yearsPerSec)} years`} aria-label="Step">
        <Icon name="step" />
      </button>
      <select value={geo.yearsPerSec} onChange={(e) => setGeoSpeed(+e.target.value)} title="Requested geological time per real second" aria-label="Geological speed">
        {GEO_SPEEDS.map((s) => (
          <option key={s.v} value={s.v}>
            {s.label}
          </option>
        ))}
      </select>
      <span className="clock geo-clock" title="Geological time run on this world">
        Year {fmtGeoYears(shownYears)}
      </span>
      {geo.playing && (
        <span className={`achieved ${slow ? 'slow' : ''}`} title="Achieved geological years per real second (lower than requested when the computer cannot keep up)">
          {fmtGeoYears(geo.achieved)} y/s
        </span>
      )}
      {geo.frames.length > 1 && (
        <label className="replay" title="Replay: drag to go back to any recorded moment (the landscape really returns to it; Play continues from there)">
          <span>Replay</span>
          <input
            type="range"
            min={0}
            max={geo.frames.length - 1}
            value={geo.viewing ?? geo.frames.length - 1}
            onChange={(e) => showFrame(+e.target.value)}
            aria-label="Replay recorded geological time"
          />
        </label>
      )}
      <button className={open ? 'active-toggle' : ''} onClick={() => setOpen(!open)} aria-expanded={open} title="Geological time settings and what the model includes">
        Settings
      </button>
      {open && <GeoSettings onClose={() => setOpen(false)} />}
    </>
  );
}

function GeoSettings({ onClose }: { onClose: () => void }) {
  useUi((s) => s.geo); // refresh with each result
  const p = engine.geoParams;
  const [, bump] = useState(0);
  const d = defaultGeoParams();
  const set = (q: Partial<typeof p>) => {
    engine.setGeoParams(q);
    bump((n) => n + 1);
  };
  const strength = d.kRef / p.kRef; // ×1 = calibrated; higher = harder to erode
  const t = engine.geoTotals;
  return (
    <div className="geo-settings" role="dialog" aria-label="Geological time settings">
      <div className="geo-settings-head">
        <b>Geological time</b>
        <button className="icon" onClick={onClose} aria-label="Close settings">
          ×
        </button>
      </div>
      <label className="field">
        <span>
          Uplift <b>{p.upliftMmYr.toFixed(1)} mm/yr</b>
        </span>
        <input type="range" min={0} max={5} step={0.1} value={p.upliftMmYr} onChange={(e) => set({ upliftMmYr: +e.target.value })} />
        <small>Land rising (e.g. near plate boundaries: 1–5 mm/yr; most of the UK today: under 1).</small>
      </label>
      <label className="field">
        <span>
          Rock strength <b>×{strength >= 1 ? strength.toFixed(1) : strength.toFixed(2)}</b>
        </span>
        <input type="range" min={-1} max={1} step={0.05} value={Math.log10(strength)} onChange={(e) => set({ kRef: d.kRef / Math.pow(10, +e.target.value) })} />
        <small>All rocks harder or softer together; each rock type keeps its own relative strength.</small>
      </label>
      <label className="field">
        <span>
          Soil creep <b>{p.diffusivity.toFixed(3)} m²/yr</b>
        </span>
        <input type="range" min={-3} max={-1} step={0.05} value={Math.log10(p.diffusivity)} onChange={(e) => set({ diffusivity: Math.pow(10, +e.target.value) })} />
        <small>How fast soil creeps downhill, rounding hilltops.</small>
      </label>
      <dl className="geo-ledger">
        <dt>River erosion of rock</dt>
        <dd>{fmtVol(t.erodedRock)}</dd>
        <dt>Rock weathered to soil</dt>
        <dd>{fmtVol(t.weathered)}</dd>
        <dt>Settled in lakes / sea</dt>
        <dd>
          {fmtVol(t.depositedLakes)} / {fmtVol(t.depositedSea)}
        </dd>
        <dt>Carried off the map</dt>
        <dd>{fmtVol(t.exported)}</dd>
        {t.supplied > 0 && (
          <>
            <dt>Meanders: bank erosion / point bars</dt>
            <dd>
              {fmtVol(t.bankEroded)} / {fmtVol(t.pointBars)}
            </dd>
            <dt>Flood deposits on the floodplain</dt>
            <dd>{fmtVol(t.overbank)}</dd>
          </>
        )}
      </dl>
      <p className="muted small">
        Model: rivers cut down by stream power (E = K·A<sup>½</sup>·S, Braun &amp; Willett 2013), soil forms from rock and creeps downhill, sediment settles
        in lakes and the sea. Rivers and lakes are drawn from where water would drain. A meandering lowland river (Howard &amp; Knutson 1984) runs in the
        meanders lesson. Not included in geological time: glaciers, waves, lava, plants. Switch to Water time to rain on the landscape you have made.
      </p>
    </div>
  );
}
