import { useRef, useState } from 'react';
import { useUi } from '../state/uiStore';
import { engine, exportWorldFile, importWorldFile, renameWorld, saveToSlot } from './runtime';
import { Icon } from './icons';
import type { Quality } from '../renderer/TerrainScene';

export function TopBar() {
  const world = useUi((s) => s.world);
  const canUndo = useUi((s) => s.canUndo);
  const canRedo = useUi((s) => s.canRedo);
  const undoLabel = useUi((s) => s.undoLabel);
  const redoLabel = useUi((s) => s.redoLabel);
  const quality = useUi((s) => s.quality);
  const set = useUi((s) => s.set);
  const fileRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);

  return (
    <header className="topbar">
      <div className="brand">
        <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true">
          <path d="M2 26 L11 10 L17 19 L21 13 L30 26Z" fill="var(--scouts-green)" />
          <path d="M11 10 L14 15 L9 15Z" fill="var(--scouts-yellow)" />
        </svg>
        <span className="brand-name">Terra Genesis</span>
      </div>
      <div className="world-name">
        {editing ? (
          <input
            autoFocus
            defaultValue={world?.name}
            aria-label="World name"
            onBlur={(e) => {
              renameWorld(e.target.value.trim() || 'Untitled world');
              setEditing(false);
            }}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          />
        ) : (
          <button className="ghost" title="Rename world" onClick={() => setEditing(true)}>
            {world?.name ?? '—'}
          </button>
        )}
      </div>
      <nav className="actions">
        <button onClick={() => set({ dialog: 'new' })} title="New world (N)">
          <Icon name="new" /> New
        </button>
        <button onClick={() => void saveToSlot(`slot:${engine.world.meta.name}`, engine.world.meta.name)} title="Save to this browser (⌘S)">
          <Icon name="save" /> Save
        </button>
        <button onClick={() => set({ dialog: 'load' })} title="Load a saved world">
          <Icon name="load" /> Load
        </button>
        <span className="sep" />
        <button onClick={() => void exportWorldFile()} title="Download world as a .tgw file">
          <Icon name="export" /> Export
        </button>
        <button onClick={() => fileRef.current?.click()} title="Open a .tgw world file">
          <Icon name="import" /> Import
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".tgw,application/octet-stream"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void importWorldFile(f);
            e.target.value = '';
          }}
        />
        <span className="sep" />
        <button className="icon" disabled={!canUndo} onClick={() => engine.undo()} title={canUndo ? `Undo ${undoLabel} (⌘Z)` : 'Nothing to undo'} aria-label="Undo">
          <Icon name="undo" />
        </button>
        <button className="icon" disabled={!canRedo} onClick={() => engine.redo()} title={canRedo ? `Redo ${redoLabel} (⇧⌘Z)` : 'Nothing to redo'} aria-label="Redo">
          <Icon name="redo" />
        </button>
        <span className="sep" />
        <label className="quality" title="Render quality (recreates the renderer)">
          <span>Quality</span>
          <select value={quality} onChange={(e) => set({ quality: e.target.value as Quality })}>
            <option value="performance">Performance</option>
            <option value="balanced">Balanced</option>
            <option value="high">High</option>
          </select>
        </label>
        <button className="icon" onClick={() => set({ dialog: 'help' })} title="Controls & shortcuts (?)" aria-label="Help">
          <Icon name="help" />
        </button>
      </nav>
    </header>
  );
}
