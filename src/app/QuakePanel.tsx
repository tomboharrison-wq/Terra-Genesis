import { useUi, type QuakeSettings } from '../state/uiStore';
import { averageSlipM, ruptureLengthKm } from '../sim/tectonics/earthquake';

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const TYPES: { id: QuakeSettings['type']; label: string; text: string }[] = [
  { id: 'normal', label: 'Normal (pulling apart)', text: 'The ground is stretched: one side drops down along a steep fault — as in rifts.' },
  { id: 'reverse', label: 'Reverse / thrust (squeezed)', text: 'The ground is squeezed: one side is pushed up over the other — as at collisions and subduction zones.' },
  { id: 'strike-slip', label: 'Strike-slip (sliding past)', text: 'The two sides slide sideways past each other — as on the San Andreas or North Anatolian faults.' },
];

/** Earthquake tool settings and the last event (spec E9). */
export function QuakePanel() {
  const q = useUi((s) => s.quake);
  const last = useUi((s) => s.lastQuake);
  const world = useUi((s) => s.world);
  const overlay = useUi((s) => s.terrainOverlay);
  const set = useUi((s) => s.set);
  const upd = (p: Partial<QuakeSettings>) => set({ quake: { ...q, ...p } });
  const L = ruptureLengthKm(q.mw);
  const D = averageSlipM(q.mw);
  const cs = world?.cellSizeM ?? 10;
  return (
    <section className="quake-panel">
      <label className="field">
        <span className="field-label">Fault type</span>
        <select value={q.type} onChange={(e) => upd({ type: e.target.value as QuakeSettings['type'] })}>
          {TYPES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </label>
      <p className="hint small tight">{TYPES.find((t) => t.id === q.type)?.text}</p>
      <label className="field">
        <span className="field-label">
          Magnitude <b>{q.mw.toFixed(1)}</b>
        </span>
        <input type="range" min={50} max={90} value={Math.round(q.mw * 10)} onChange={(e) => upd({ mw: +e.target.value / 10 })} />
      </label>
      <label className="field">
        <span className="field-label">
          Fault direction <b>{COMPASS[Math.round(q.strikeDeg / 45) % 8]}–{COMPASS[(Math.round(q.strikeDeg / 45) + 4) % 8]} ({Math.round(q.strikeDeg)}°)</b>
        </span>
        <input type="range" min={0} max={179} value={q.strikeDeg} onChange={(e) => upd({ strikeDeg: +e.target.value })} />
      </label>
      <p className="hint small tight">
        A magnitude {q.mw.toFixed(1)} earthquake breaks about {L.toFixed(L < 10 ? 1 : 0)} km of fault and moves it about {D < 1 ? `${Math.round(D * 100)} cm` : `${D.toFixed(1)} m`} on
        average (real-world averages, Wells &amp; Coppersmith 1994).{' '}
        {q.type === 'strike-slip' && 1.27 * D < cs / 2 ? `That is smaller than one map cell (${cs} m), so no sideways offset will show at this map scale.` : ''}
      </p>
      <label className="field check">
        <input type="checkbox" checked={q.landslides} onChange={(e) => upd({ landslides: e.target.checked })} />
        <span>Strong shaking sets off landslides on steep slopes</span>
      </label>
      <label className="field check">
        <input type="checkbox" checked={q.shake} onChange={(e) => upd({ shake: e.target.checked })} />
        <span>Shake the view (for effect only)</span>
      </label>
      {last && (
        <>
          <h3>Last earthquake</h3>
          <p className="hint small tight">
            M{last.mw.toFixed(1)} {last.type}: {last.ruptureKm.toFixed(1)} km rupture, average slip {last.avgSlipM.toFixed(2)} m;{' '}
            {last.type === 'strike-slip' ? `${last.lateralCells} cell${last.lateralCells === 1 ? '' : 's'} of sideways offset` : `raised up to ${last.maxUpM.toFixed(2)} m, dropped up to ${last.maxDownM.toFixed(2)} m`}
            {last.landslides ? `; ${last.landslides} landslide${last.landslides > 1 ? 's' : ''}` : ''}. Use the Change map to see where the ground moved.
          </p>
          <div className="seg">
            <button className={overlay === 'shaking' ? 'active' : ''} onClick={() => set({ terrainOverlay: overlay === 'shaking' ? 'none' : 'shaking' })}>
              {overlay === 'shaking' ? 'Showing shaking' : 'Show shaking strength'}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
