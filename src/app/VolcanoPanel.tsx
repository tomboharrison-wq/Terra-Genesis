import { useUi, type VolcanoSettings } from '../state/uiStore';
import { LAVA_KINDS } from '../sim/lava/lavaSim';
import { engine, syncSim } from './runtime';

const fmtVol = (m3: number) => (m3 >= 1e9 ? `${(m3 / 1e9).toFixed(2)} km³` : m3 >= 1e6 ? `${(m3 / 1e6).toFixed(2)} million m³` : `${Math.round(m3).toLocaleString()} m³`);
const fmtTime = (s: number) => (s >= 3600 ? `${(s / 3600).toFixed(1)} h` : `${Math.max(0, Math.round(s / 60))} min`);
const RATES = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];
const HOURS = [0.5, 1, 2, 3, 6, 12, 24, 48];

const KIND_TEXT: Record<VolcanoSettings['kind'], string> = {
  basalt: 'Hot, runny lava (about 1150 °C) — like Hawaii or Iceland. It spreads far in thin sheets, even on gentle slopes.',
  andesite: 'Cooler, sticky lava (about 1050 °C) with high silica — like many volcanoes in subduction zones. It piles up thick and only moves on steep slopes.',
};

/** Volcano tool: vent settings, active vents and the lava ledger (spec E10). */
export function VolcanoPanel() {
  const v = useUi((s) => s.volcano);
  const lava = useUi((s) => s.sim?.lava);
  const set = useUi((s) => s.set);
  const upd = (p: Partial<VolcanoSettings>) => set({ volcano: { ...v, ...p } });
  const k = LAVA_KINDS[v.kind];
  const rateIdx = Math.max(0, RATES.findIndex((r) => r >= v.rateM3PerS));
  const hourIdx = Math.max(0, HOURS.findIndex((h) => h >= v.hours));
  const vol = v.rateM3PerS * v.hours * 3600;
  return (
    <section className="volcano-panel">
      <label className="field">
        <span className="field-label">Lava type</span>
        <select value={v.kind} onChange={(e) => upd({ kind: e.target.value as VolcanoSettings['kind'] })}>
          {Object.entries(LAVA_KINDS).map(([id, d]) => (
            <option key={id} value={id}>
              {d.label}
            </option>
          ))}
        </select>
      </label>
      <p className="hint small tight">{KIND_TEXT[v.kind]}</p>
      <p className="hint small tight">
        Erupts at {k.eruptC} °C; sets solid below {k.solidC} °C. Stiffness when erupted {k.viscosityPaS.toExponential(0).replace('e+', ' × 10^')} Pa·s.
      </p>
      <label className="field">
        <span className="field-label">
          Eruption rate <b>{v.rateM3PerS} m³/s</b>
        </span>
        <input type="range" min={0} max={RATES.length - 1} value={rateIdx} onChange={(e) => upd({ rateM3PerS: RATES[+e.target.value] })} />
      </label>
      <label className="field">
        <span className="field-label">
          Eruption lasts <b>{v.hours < 1 ? `${v.hours * 60} min` : `${v.hours} h`}</b>
        </span>
        <input type="range" min={0} max={HOURS.length - 1} value={hourIdx} onChange={(e) => upd({ hours: HOURS[+e.target.value] })} />
      </label>
      <p className="hint small tight">Each new vent will erupt {fmtVol(vol)} of lava. Press Play: lava moves in real simulated time (try 1–10 min/s).</p>
      {lava && lava.vents.length > 0 && (
        <>
          <h3>Erupting vents</h3>
          <ul className="springs">
            {lava.vents.map((s) => (
              <li key={s.id}>
                <span>
                  Vent {s.id}: {s.kind}, {s.rateM3PerS} m³/s, {fmtTime(s.remainingS)} left
                </span>
                <button
                  className="small ghost danger"
                  onClick={() => {
                    engine.removeVent(s.id);
                    syncSim();
                  }}
                >
                  Stop
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      {lava && lava.eruptedM3 > 0 && (
        <>
          <h3>Lava</h3>
          <p className="hint small tight">
            Erupted {fmtVol(lava.eruptedM3)}: {fmtVol(lava.flowingM3)} still molten{lava.maxTempC !== null ? ` (hottest ${Math.round(lava.maxTempC)} °C)` : ''}, {fmtVol(lava.solidifiedM3)} set into
            volcanic rock. Volume check {(lava.closure * 100).toFixed(3)}% out.
          </p>
        </>
      )}
      <p className="hint small tight">
        Model: lava only moves once it is thicker than its strength allows on that slope, and stiffens as it cools by radiating heat (faster in water). No crust, gas or ash yet;
        cones and calderas come next.
      </p>
    </section>
  );
}
