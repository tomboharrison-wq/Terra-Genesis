import { useUi, type VolcanoSettings } from '../state/uiStore';
import { LAVA_KINDS, lavaShare } from '../sim/lava/lavaSim';
import { BULK_FACTOR, coarseFraction, plumeHeightKm } from '../sim/lava/tephra';
import { engine, syncSim } from './runtime';

const fmtVol = (m3: number) =>
  m3 >= 1e9 ? `${(m3 / 1e9).toFixed(2)} km³` : m3 >= 1e6 ? `${(m3 / 1e6).toFixed(2)} million m³` : `${Math.round(m3).toLocaleString()} m³`;
const fmtTime = (s: number) => (s >= 3600 ? `${(s / 3600).toFixed(1)} h` : `${Math.max(0, Math.round(s / 60))} min`);
const RATES = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];
const HOURS = [0.5, 1, 2, 3, 6, 12, 24, 48];

const STYLES: { id: VolcanoSettings['style']; label: string; text: string }[] = [
  { id: 'lava', label: 'Lava only (effusive)', text: 'Magma pours out quietly as lava flows.' },
  {
    id: 'explosive',
    label: 'Explosive (ash + cinder)',
    text: 'Gas blasts the magma into fragments: cinders pile up round the vent and an ash column drifts downwind.',
  },
  { id: 'mixed', label: 'Mixed (half lava, half ash)', text: 'Alternating lava and explosions, as at many cone volcanoes.' },
];

const BUILD_TEXT: Record<'shield' | 'composite' | 'island', string> = {
  island:
    'Click the sea. Magma meeting sea water shatters into ash and cinder, so the first eruptions are explosive and build a cone up to the surface; once the vent is above the waves, lava flows cap the new island — as at Surtsey, Iceland, in 1963.',
  shield:
    'Many eruptions of hot, runny basalt lava. Each flow spreads far before it sets, so layer on layer builds a broad, gently sloping volcano — like Mauna Loa in Hawaii.',
  composite:
    'Sticky andesite, taking turns: explosive eruptions throw out ash and cinder, then thick lava flows. The layers build a steep cone with a crater, steepest near the top — like Mount Fuji or Mount St Helens.',
};

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
  const rateIdx = Math.max(
    0,
    RATES.findIndex((r) => r >= v.rateM3PerS),
  );
  const hourIdx = Math.max(
    0,
    HOURS.findIndex((h) => h >= v.hours),
  );
  const vol = v.rateM3PerS * v.hours * 3600;
  const share = lavaShare(v.style);
  const plume = plumeHeightKm((1 - share) * v.rateM3PerS);
  const windMS = lava?.windSpeedMS ?? 10;
  const building = useUi((s) => s.volcanoBuild);
  return (
    <section className="volcano-panel">
      <label className="field">
        <span className="field-label">What to make</span>
        <select value={v.mode} onChange={(e) => upd({ mode: e.target.value as VolcanoSettings['mode'] })} disabled={!!building}>
          <option value="eruption">One eruption (real time)</option>
          <option value="shield">Build a shield volcano</option>
          <option value="composite">Build a composite volcano</option>
          <option value="island">Build a volcanic island (vent on the sea floor)</option>
          <option value="caldera">Caldera collapse</option>
        </select>
      </label>
      {v.mode === 'caldera' && (
        <>
          <p className="hint small tight">
            After a huge eruption empties the magma chamber, the summit above it can fall in along a ring of faults, leaving a wide, steep-walled hollow — a
            caldera (like Crater Lake, USA, or Santorini). Rain can then fill it as a crater lake.
          </p>
          <label className="field">
            <span className="field-label">
              Width <b>{((2 * v.calderaRadiusM) / 1000).toFixed(1)} km</b>
            </span>
            <input type="range" min={100} max={3000} step={50} value={v.calderaRadiusM} onChange={(e) => upd({ calderaRadiusM: +e.target.value })} />
          </label>
          <label className="field">
            <span className="field-label">
              Drop <b>{v.calderaDepthM} m</b>
            </span>
            <input type="range" min={10} max={600} step={10} value={v.calderaDepthM} onChange={(e) => upd({ calderaDepthM: +e.target.value })} />
          </label>
          <p className="hint small tight">
            Click the summit. About {fmtVol(Math.PI * v.calderaRadiusM * v.calderaRadiusM * v.calderaDepthM)} of rock drops into the emptied chamber; the rock
            layers drop with it. Ctrl+Z undoes it.
          </p>
        </>
      )}
      {v.mode !== 'eruption' && v.mode !== 'caldera' && (
        <>
          <p className="hint small tight">{BUILD_TEXT[v.mode]}</p>
          <label className="field">
            <span className="field-label">
              Eruptions <b>{v.episodes}</b>
            </span>
            <input type="range" min={2} max={24} value={v.episodes} disabled={!!building} onChange={(e) => upd({ episodes: +e.target.value })} />
          </label>
          <p className="hint small tight">
            Click the map to build. Each eruption runs the real lava and ash physics; the hundreds of years of rest between eruptions are skipped (time is
            compressed: leftover lava cools to rock, rivers and erosion pause). Ctrl+Z undoes the whole volcano.
          </p>
          {building && (
            <div className="field">
              <span className="field-label">
                Building: eruption <b>{Math.min(building.done + 1, building.total)}</b> of {building.total}
              </span>
              <progress max={building.total} value={building.done} style={{ width: '100%' }} />
            </div>
          )}
        </>
      )}
      {v.mode === 'eruption' && (
        <>
          <label className="field">
            <span className="field-label">Magma type</span>
            <select value={v.kind} onChange={(e) => upd({ kind: e.target.value as VolcanoSettings['kind'] })}>
              {Object.entries(LAVA_KINDS).map(([id, d]) => (
                <option key={id} value={id}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>
          <p className="hint small tight">{KIND_TEXT[v.kind]}</p>
          <label className="field">
            <span className="field-label">Eruption style</span>
            <select value={v.style} onChange={(e) => upd({ style: e.target.value as VolcanoSettings['style'] })}>
              {STYLES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <p className="hint small tight">{STYLES.find((s) => s.id === v.style)?.text}</p>
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
          <p className="hint small tight">
            Each new vent will erupt {fmtVol(vol)} of magma
            {share === 0
              ? `, all blasted into ${fmtVol(vol * BULK_FACTOR)} of loose ash and cinder (fluffier than solid rock)`
              : share < 1
                ? `: ${fmtVol(vol * share)} as lava and ${fmtVol(vol * (1 - share) * BULK_FACTOR)} of loose ash and cinder (fluffier than solid rock)`
                : ' as lava'}
            {share < 1
              ? `, from a column about ${plume.toFixed(1)} km high that drops ${Math.round(coarseFraction(plume) * 100)}% as cinder near the vent`
              : ''}
            . Press Play: it runs in real simulated time (try 1–10 min/s).
          </p>
        </>
      )}
      {(v.mode === 'eruption' ? share < 1 : v.mode === 'composite' || v.mode === 'island') && (
        <label className="field">
          <span className="field-label">
            Ash wind speed <b>{windMS} m/s</b>
          </span>
          <input
            type="range"
            min={0}
            max={40}
            value={windMS}
            onChange={(e) => {
              engine.setAshWind(+e.target.value);
              syncSim();
            }}
          />
          <span className="hint small tight">Wind high up carries the ash; it blows from the direction set in Climate.</span>
        </label>
      )}
      {lava && lava.vents.length > 0 && (
        <>
          <h3>Erupting vents</h3>
          <ul className="springs">
            {lava.vents.map((s) => (
              <li key={s.id}>
                <span>
                  Vent {s.id}: {s.style && s.style !== 'lava' ? `${s.style} ` : ''}
                  {s.kind}, {s.rateM3PerS} m³/s, {s.remainingS > 0 ? `${fmtTime(s.remainingS)} left` : 'ash settling'}
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
            Erupted {fmtVol(lava.eruptedM3)}: {fmtVol(lava.flowingM3)} still molten{lava.maxTempC !== null ? ` (hottest ${Math.round(lava.maxTempC)} °C)` : ''},{' '}
            {fmtVol(lava.solidifiedM3)} set into volcanic rock. Volume check {(lava.closure * 100).toFixed(3)}% out.
          </p>
        </>
      )}
      {lava && lava.tephraEruptedM3 > 0 && (
        <>
          <h3>Ash and cinder</h3>
          <p className="hint small tight">
            Erupted {fmtVol(lava.tephraEruptedM3)} (column {lava.plumeKm.toFixed(1)} km high): {fmtVol(lava.tephraDepositedM3)} landed on the map,{' '}
            {fmtVol(lava.tephraOffMapM3)} blew off the edge. Volume check {(lava.tephraClosure * 100).toFixed(3)}% out. Hover to see ash depth.
          </p>
        </>
      )}
      <p className="hint small tight">
        Model: lava only moves once it is thicker than its strength allows on that slope, and stiffens as it cools by radiating heat (faster in water). Ash
        thins with distance (Pyle 1989) and is stretched downwind; cinder slides to 33°. It lands at once (no fall time, grain sizes or pyroclastic flows).
        Calderas drop as a solid block on a ring fault.
      </p>
    </section>
  );
}
