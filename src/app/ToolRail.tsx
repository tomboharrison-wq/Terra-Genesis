import { useUi } from '../state/uiStore';
import { TOOLS } from './tools';
import { ToolIcon } from './icons';

export function ToolRail() {
  const tool = useUi((s) => s.tool);
  const set = useUi((s) => s.set);
  return (
    <aside className="toolrail" aria-label="Terrain tools">
      <div className="rail-group-label">Terrain</div>
      {TOOLS.map((t) => (
        <button
          key={t.id}
          className={`rail-btn ${tool === t.id ? 'active' : ''}`}
          onClick={() => set({ tool: t.id, panelOpen: true })}
          title={`${t.label} (${t.key}) — ${t.hint}`}
          aria-pressed={tool === t.id}
        >
          <ToolIcon id={t.id} />
          <span>{t.label}</span>
        </button>
      ))}
    </aside>
  );
}
