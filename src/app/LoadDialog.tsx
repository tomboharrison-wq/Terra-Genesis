import { useEffect, useState } from 'react';
import { Dialog } from './Dialog';
import { useUi } from '../state/uiStore';
import { AUTOSAVE_ID, deleteSlot, listSlots, storageEstimate, type SlotInfo } from '../persistence/idb';
import { loadFromSlot } from './runtime';
import { Icon } from './icons';

export function LoadDialog() {
  const close = () => useUi.getState().set({ dialog: null });
  const [slots, setSlots] = useState<SlotInfo[] | null>(null);
  const [est, setEst] = useState<{ usage: number; quota: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const refresh = () =>
    listSlots()
      .then(setSlots)
      .catch((e: Error) => setErr(e.message));
  useEffect(() => {
    void refresh();
    void storageEstimate().then(setEst).catch(() => undefined);
  }, []);

  return (
    <Dialog title="Load world" onClose={close}>
      {err && <p className="error">{err}</p>}
      {!slots && !err && <p className="muted">Reading saved worlds…</p>}
      {slots && slots.length === 0 && <p className="muted">No saved worlds in this browser yet. Use Save, or Import a .tgw file.</p>}
      <ul className="slots">
        {slots?.map((s) => (
          <li key={s.id}>
            <button
              className="slot-main"
              onClick={async () => {
                if (await loadFromSlot(s.id)) {
                  useUi.getState().toast(`Loaded “${s.name}”`, 'success');
                  close();
                }
              }}
            >
              <b>{s.id === AUTOSAVE_ID ? 'Autosave (last session)' : s.name}</b>
              <span>
                {s.width}×{s.height} · {s.presetId} · {(s.byteLength / 1024).toFixed(0)} KB · {new Date(s.savedAtIso).toLocaleString()}
              </span>
            </button>
            <button
              className="icon ghost danger"
              aria-label={`Delete ${s.name}`}
              title="Delete"
              onClick={async () => {
                if (confirm(`Delete saved world “${s.name}”?`)) {
                  await deleteSlot(s.id);
                  void refresh();
                }
              }}
            >
              <Icon name="trash" size={18} />
            </button>
          </li>
        ))}
      </ul>
      {est && est.quota > 0 && (
        <p className="muted small">
          Browser storage: {(est.usage / 1e6).toFixed(1)} MB used of {(est.quota / 1e9).toFixed(1)} GB available.
        </p>
      )}
    </Dialog>
  );
}
