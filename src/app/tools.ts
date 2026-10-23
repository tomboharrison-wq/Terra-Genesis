import type { ToolId } from '../state/uiStore';

export interface ToolDef {
  id: ToolId;
  group: 'terrain' | 'water' | 'coast' | 'earth' | 'measure' | 'events';
  label: string;
  key: string;
  hint: string;
  rateLabel?: string;
  rateMin?: number;
  rateMax?: number;
}

export const TOOLS: ToolDef[] = [
  { group: 'terrain', id: 'navigate', label: 'Navigate', key: '1', hint: 'Drag to orbit · right-drag or Shift-drag to pan · scroll/pinch to zoom.' },
  { group: 'terrain', id: 'raise', label: 'Raise', key: '2', hint: 'Builds bedrock upward under the brush.', rateLabel: 'Uplift rate (m/s)', rateMin: 0.5, rateMax: 300 },
  { group: 'terrain', id: 'lower', label: 'Lower', key: '3', hint: 'Cuts down: removes loose sediment first, then bedrock.', rateLabel: 'Cut rate (m/s)', rateMin: 0.5, rateMax: 300 },
  { group: 'terrain', id: 'smooth', label: 'Smooth', key: '4', hint: 'Relaxes the surface toward its local average.', rateLabel: 'Relaxation (1/s)', rateMin: 0.2, rateMax: 20 },
  { group: 'terrain', id: 'flatten', label: 'Flatten', key: '5', hint: 'Levels toward the elevation where the stroke began.', rateLabel: 'Relaxation (1/s)', rateMin: 0.2, rateMax: 20 },
  { group: 'terrain', id: 'paint', label: 'Geology', key: '6', hint: 'Paints bedrock lithology. Visible where loose sediment is thin.' },
  { group: 'terrain', id: 'add-sediment', label: 'Add soil', key: '7', hint: 'Deposits loose sediment (regolith) on top of bedrock.', rateLabel: 'Deposit rate (m/s)', rateMin: 0.05, rateMax: 50 },
  { group: 'terrain', id: 'remove-sediment', label: 'Strip soil', key: '8', hint: 'Removes loose sediment only, exposing bedrock.', rateLabel: 'Strip rate (m/s)', rateMin: 0.05, rateMax: 50 },
  { group: 'water', id: 'water-add', label: 'Add water', key: '9', hint: 'Pours water onto the land under the brush (ledgered as a tool input).', rateLabel: 'Pour rate (m/s)', rateMin: 0.01, rateMax: 20 },
  { group: 'water', id: 'water-drain', label: 'Drain', key: '0', hint: 'Removes surface water under the brush (ledgered as a tool output).', rateLabel: 'Drain rate (m/s)', rateMin: 0.01, rateMax: 20 },
  { group: 'measure', id: 'measure', label: 'Measure', key: 'M', hint: 'Click to pin points (A, B, C…). Each pin lists the real values there; pairs show distance, bearing, height difference and gradient.' },
  { group: 'measure', id: 'profile', label: 'Profile', key: '=', hint: 'Click two points to draw a cross-section: rock, soil, water, ice and lava along the line, the change-map reference, and a CSV of the samples.' },
  { group: 'water', id: 'climate', label: 'Climate', key: 'K', hint: 'Temperature, seasons, prevailing wind, wetter windward slopes and rain shadows. Drives where rain falls and how fast water evaporates.' },
  { group: 'coast', id: 'coast', label: 'Coast', key: 'C', hint: 'Sea level and wave climate. Waves erode cliffs (weak rock fastest, sheltered bays least) and drift sand along the shore.' },
  { group: 'earth', id: 'plates', label: 'Plates', key: 'E', hint: 'Tectonic plates: set each plate moving; colliding plates push up mountains, separating plates open rifts.' },
  { group: 'earth', id: 'earthquake', label: 'Quake', key: 'Q', hint: 'Click the map to set off an earthquake on a fault: choose the fault type, size and direction. The ground moves for good; undo (Ctrl+Z) puts it back.' },
  { group: 'earth', id: 'volcano', label: 'Volcano', key: 'V', hint: 'Click the map to open a volcanic vent. Lava flows downhill, slows as it cools and sets into new volcanic rock. Press Play to run time.' },
  { group: 'events', id: 'landslide', label: 'Landslide', key: 'L', hint: 'Click a slope to saturate it: steep rock breaks up and debris slides downhill (radius = brush radius). The ground moves for good; undo (Ctrl+Z) puts it back.' },
  { group: 'water', id: 'spring', label: 'Spring', key: '-', hint: 'Click to place a constant inflow (spring or river inlet). Remove springs in the list below.' },
];

export const toolById = (id: ToolId) => TOOLS.find((t) => t.id === id) ?? TOOLS[0];
