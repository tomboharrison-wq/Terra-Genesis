import type { ToolId } from '../state/uiStore';

export interface ToolDef {
  id: ToolId;
  label: string;
  key: string;
  hint: string;
  rateLabel?: string;
  rateMin?: number;
  rateMax?: number;
}

export const TOOLS: ToolDef[] = [
  { id: 'navigate', label: 'Navigate', key: '1', hint: 'Drag to orbit · right-drag or Shift-drag to pan · scroll/pinch to zoom.' },
  { id: 'raise', label: 'Raise', key: '2', hint: 'Builds bedrock upward under the brush.', rateLabel: 'Uplift rate (m/s)', rateMin: 0.5, rateMax: 300 },
  { id: 'lower', label: 'Lower', key: '3', hint: 'Cuts down: removes loose sediment first, then bedrock.', rateLabel: 'Cut rate (m/s)', rateMin: 0.5, rateMax: 300 },
  { id: 'smooth', label: 'Smooth', key: '4', hint: 'Relaxes the surface toward its local average.', rateLabel: 'Relaxation (1/s)', rateMin: 0.2, rateMax: 20 },
  { id: 'flatten', label: 'Flatten', key: '5', hint: 'Levels toward the elevation where the stroke began.', rateLabel: 'Relaxation (1/s)', rateMin: 0.2, rateMax: 20 },
  { id: 'paint', label: 'Geology', key: '6', hint: 'Paints bedrock lithology. Visible where loose sediment is thin.' },
  { id: 'add-sediment', label: 'Add soil', key: '7', hint: 'Deposits loose sediment (regolith) on top of bedrock.', rateLabel: 'Deposit rate (m/s)', rateMin: 0.05, rateMax: 50 },
  { id: 'remove-sediment', label: 'Strip soil', key: '8', hint: 'Removes loose sediment only, exposing bedrock.', rateLabel: 'Strip rate (m/s)', rateMin: 0.05, rateMax: 50 },
];

export const toolById = (id: ToolId) => TOOLS.find((t) => t.id === id) ?? TOOLS[0];
