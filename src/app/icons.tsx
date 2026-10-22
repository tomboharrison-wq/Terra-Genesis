import type { ToolId } from '../state/uiStore';

const P: Record<string, string> = {
  navigate: 'M12 2l3 5h-2v4h4V9l5 3-5 3v-2h-4v4h2l-3 5-3-5h2v-4H7v2l-5-3 5-3v2h4V7H9z',
  raise: 'M2 20h20M5 20c2-6 4-9 7-9s5 3 7 9M12 3v6M9 6l3-3 3 3',
  lower: 'M2 20h20M4 12c3 0 4 5 8 5s5-5 8-5M12 3v7M9 7l3 3 3-3',
  smooth: 'M2 16c3-6 5-6 7-3s4 3 6 0 4-4 7 1M2 20h20',
  flatten: 'M2 17h20M3 20h18M6 13c2-5 4-7 6-7s4 2 6 7',
  paint: 'M14 4l6 6-8 8H6v-6zM4 22c1-2 2-3 4-3',
  'add-sediment': 'M3 18l9 4 9-4M3 14l9 4 9-4M12 3v7M8.5 6.5h7',
  'remove-sediment': 'M3 18l9 4 9-4M3 14l9 4 9-4M8.5 6.5h7',
  'water-add': 'M12 3c3 4.5 6 7.7 6 11a6 6 0 01-12 0c0-3.3 3-6.5 6-11zM12 11v6M9 14h6',
  'water-drain': 'M12 3c3 4.5 6 7.7 6 11a6 6 0 01-12 0c0-3.3 3-6.5 6-11zM9 14h6',
  spring: 'M12 21v-6M8 21h8M12 15c-3 0-5-2-5-5 0-2 2-4 5-7 3 3 5 5 5 7 0 3-2 5-5 5z',
  profile: 'M3 19l5-7 4 4 4-8 5 11M3 21h18M5 9v-4M19 9V5',
  landslide: 'M3 20h18M4 20c2-8 5-13 9-14M13 6l2 5 4 2M10 14l2 1M15 17l2 1',
  coast: 'M3 15c2 0 2-2 4.5-2s2.5 2 4.5 2 2-2 4.5-2 2.5 2 4.5 2M3 19c2 0 2-2 4.5-2s2.5 2 4.5 2 2-2 4.5-2 2.5 2 4.5 2M14 11V5l5 2v4',
  play: 'M7 4l13 8-13 8z',
  pause: 'M7 4h4v16H7zM14 4h4v16h-4z',
  step: 'M5 4l10 8-10 8zM17 4h3v16h-3z',
  undo: 'M9 14L4 9l5-5M4 9h10a6 6 0 010 12h-3',
  redo: 'M15 14l5-5-5-5M20 9H10a6 6 0 000 12h3',
  save: 'M5 3h11l4 4v14H4V3zM8 3v5h8V3M8 21v-7h8v7',
  load: 'M3 7h6l2 2h10v11H3zM12 12v6M9 15l3 3 3-3',
  export: 'M12 3v12M8 7l4-4 4 4M4 15v6h16v-6',
  import: 'M12 15V3M8 11l4 4 4-4M4 15v6h16v-6',
  new: 'M12 5v14M5 12h14',
  help: 'M9.5 9a2.5 2.5 0 115 0c0 2-2.5 2-2.5 4M12 17h.01',
  fit: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  top: 'M12 3v18M3 12h18M12 8a4 4 0 100 8 4 4 0 000-8z',
  oblique: 'M3 19l6-10 4 6 3-4 5 8z',
  panel: 'M4 4h16v16H4zM14 4v16',
  close: 'M6 6l12 12M18 6L6 18',
  dice: 'M5 5h14v14H5zM9 9h.01M15 15h.01M15 9h.01M9 15h.01M12 12h.01',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
};

export function Icon({ name, size = 20 }: { name: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={P[name] ?? ''} />
    </svg>
  );
}

export const ToolIcon = ({ id }: { id: ToolId }) => <Icon name={id} size={22} />;
