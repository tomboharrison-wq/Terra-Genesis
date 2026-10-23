import { useState } from 'react';
import { Dialog } from './Dialog';
import { useUi } from '../state/uiStore';
import { engine, syncSim } from './runtime';
import { diffSummary, MAX_CHECKPOINTS } from '../engine/checkpoints';
import { fmtSimTime } from './TimeBar';
import type { OverlayId } from '../renderer/overlays';

const fmtVol = (m3: number) =>
  Math.abs(m3) >= 1e9 ? `${(m3 / 1e9).toFixed(2)} km³` : Math.abs(m3) >= 1e6 ? `${(m3 / 1e6).toFixed(2)} million m³` : `${Math.round(m3).toLocaleString()} m³`;
const fmtArea = (m2: number) => (Math.abs(m2) >= 1e6 ? `${(m2 / 1e6).toFixed(2)} km²` : `${Math.round(m2).toLocaleString()} m²`);
const fmtSpan = (s: number) => (s >= 86400 ? `${(s / 86400).toFixed(1)} days` : s >= 3600 ? `${(s / 3600).toFixed(1)} h` : `${Math.round(s / 60)} min`);
const sign = (v: number) => (v > 0 ? '+' : v < 0 ? '−' : '±');

/** Checkpoints (spec F3): snapshot, restore exactly, and compare now with a snapshot. */
export function CheckpointsDialog() {
  const close = () => useUi.getState().set({ dialog: null });
  const set = useUi((s) => s.set);
  const simT = useUi((s) => s.sim?.simTimeS ?? 0);
  const [, setRev] = useState(0);
  const refresh = () => setRev((r) => r + 1);
  const [label, setLabel] = useState('');
  const cps = engine.checkpoints;
  const cmp = engine.compareCheckpoint;
  const sum = cmp ? diffSummary(cmp, engine.world, engine.surface) : null;
  const memMb = cps.reduce((s, c) => s + c.bytes, 0) / 1e6;
  const show = (o: OverlayId) => {
    set({ terrainOverlay: o, dialog: null });
  };

  return (
    <Dialog title="Checkpoints" onClose={close}>
      <p className="hint small tight">
        A checkpoint is an exact copy of the whole world at this moment. Restore one to go back (time is never run backwards); compare to map what has changed
        since. Checkpoints last until you reload the page — use Save to keep a world.
      </p>
      <div className="row">
        <input
          className="grow"
          value={label}
          placeholder={`Checkpoint at ${fmtSimTime(simT)}`}
          aria-label="Checkpoint name"
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget.nextElementSibling as HTMLButtonElement | null)?.click()}
        />
        <button
          className="primary"
          onClick={() => {
            engine.takeCheckpoint(label.trim() || `Checkpoint at ${fmtSimTime(engine.world.simTimeSeconds)}`);
            setLabel('');
            refresh();
            useUi.getState().toast('Checkpoint taken', 'success');
          }}
        >
          Take checkpoint
        </button>
      </div>
      {cps.length === 0 ? (
        <p className="hint small">No checkpoints yet.</p>
      ) : (
        <table className="values checkpoints">
          <thead>
            <tr>
              <th>Checkpoint</th>
              <th>World time</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {[...cps].reverse().map((c) => {
              const mine = engine.sameWorld(c);
              return (
                <tr key={c.id} className={cmp?.id === c.id ? 'selected' : ''}>
                  <td>
                    {c.label}
                    {!mine && <span className="muted small"> · {c.world.meta.name}</span>}
                  </td>
                  <td>{fmtSimTime(c.simTimeS)}</td>
                  <td className="actions">
                    <button
                      className="small"
                      onClick={() => {
                        engine.restoreCheckpoint(c.id);
                        syncSim();
                        refresh();
                        useUi.getState().toast(`Restored “${c.label}”`, 'success');
                      }}
                    >
                      Restore
                    </button>
                    <button
                      className={`small ${cmp?.id === c.id ? 'active-toggle' : ''}`}
                      disabled={!mine}
                      title={mine ? 'Map what has changed since this checkpoint' : 'From a different world: cannot be compared'}
                      onClick={() => {
                        engine.compareWith(cmp?.id === c.id ? null : c.id);
                        refresh();
                      }}
                    >
                      Compare
                    </button>
                    <button
                      className="small ghost danger"
                      aria-label={`Delete ${c.label}`}
                      onClick={() => {
                        engine.deleteCheckpoint(c.id);
                        refresh();
                      }}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <p className="muted small">
        {cps.length} of {MAX_CHECKPOINTS} (oldest dropped beyond that) · {memMb.toFixed(1)} MB of memory
      </p>
      {cmp && sum && (
        <>
          <h3>Since “{cmp.label}”</h3>
          <table className="values summary">
            <tbody>
              <tr>
                <td>World time passed</td>
                <td>{sum.elapsedS >= 0 ? fmtSpan(sum.elapsedS) : `${fmtSpan(-sum.elapsedS)} earlier (now is before the checkpoint)`}</td>
              </tr>
              <tr>
                <td>Ground lowered (eroded, collapsed)</td>
                <td>{fmtVol(sum.loweredM3)}</td>
              </tr>
              <tr>
                <td>Ground raised (deposited, erupted, uplifted)</td>
                <td>{fmtVol(sum.raisedM3)}</td>
              </tr>
              <tr>
                <td>Area changed by more than 5 cm</td>
                <td>{fmtArea(sum.changedAreaM2)}</td>
              </tr>
              <tr>
                <td>Biggest drop / rise</td>
                <td>
                  {sum.maxLoweringM.toFixed(2)} m / {sum.maxRaisingM.toFixed(2)} m
                </td>
              </tr>
              <tr>
                <td>Standing water</td>
                <td>
                  {sign(sum.waterChangeM3)}
                  {fmtVol(Math.abs(sum.waterChangeM3))}
                </td>
              </tr>
              {sum.iceChangeM3 !== 0 && (
                <tr>
                  <td>Ice</td>
                  <td>
                    {sign(sum.iceChangeM3)}
                    {fmtVol(Math.abs(sum.iceChangeM3))}
                  </td>
                </tr>
              )}
              {sum.plantAreaChangeM2 !== 0 && (
                <tr>
                  <td>Plant-covered area</td>
                  <td>
                    {sign(sum.plantAreaChangeM2)}
                    {fmtArea(Math.abs(sum.plantAreaChangeM2))}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <div className="row wrap">
            <button className="small" onClick={() => show('cp-ground')}>
              Map ground change
            </button>
            <button className="small" onClick={() => show('cp-water')}>
              Map water change
            </button>
            {sum.plantAreaChangeM2 !== 0 && (
              <button className="small" onClick={() => show('cp-plants')}>
                Map plant change
              </button>
            )}
            {sum.iceChangeM3 !== 0 && (
              <button className="small" onClick={() => show('cp-ice')}>
                Map ice change
              </button>
            )}
          </div>
        </>
      )}
    </Dialog>
  );
}
