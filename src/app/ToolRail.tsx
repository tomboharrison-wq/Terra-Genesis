import { useUi } from '../state/uiStore';
import { TOOLS } from './tools';
import { ToolIcon } from './icons';

export function ToolRail() {
  const tool = useUi((s) => s.tool);
  const set = useUi((s) => s.set);
  const group = (g: 'terrain' | 'water' | 'coast' | 'measure' | 'events', label: string) => (
    <>
      <div className="rail-group-label">{label}</div>
      {TOOLS.filter((t) => t.group === g).map((t) => (
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
    </>
  );
  return (
    <aside className="toolrail" aria-label="Tools">
      {group('terrain', 'Terrain')}
      <div className="rail-sep" />
      {group('water', 'Water')}
      {group('coast', 'Coast')}
      <div className="rail-sep" />
      {group('measure', 'Measure')}
      <div className="rail-sep" />
      {group('events', 'Events')}
    </aside>
  );
}
