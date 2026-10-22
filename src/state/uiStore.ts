import { create } from 'zustand';
import type { BrushKind } from '../tools/brush';
import type { FrameStats, Quality } from '../renderer/TerrainScene';

export type ToolId = 'navigate' | BrushKind;

export interface HoverInfo {
  xM: number;
  yM: number;
  cellX: number;
  cellY: number;
  surfaceM: number;
  bedrockM: number;
  sedimentM: number;
  slopeDeg: number;
  materialName: string;
}

export interface WorldInfo {
  name: string;
  presetId: string;
  width: number;
  height: number;
  cellSizeM: number;
  seaLevelM: number;
  seed: number;
}

export interface Toast {
  id: number;
  text: string;
  kind: 'info' | 'error' | 'success';
}

/** Default brush rates per tool (units documented in BrushParams). */
export const DEFAULT_RATES: Record<BrushKind, number> = {
  raise: 30,
  lower: 30,
  smooth: 3,
  flatten: 4,
  paint: 1,
  'add-sediment': 2,
  'remove-sediment': 2,
};

interface UiState {
  tool: ToolId;
  radiusM: number;
  hardness: number;
  rates: Record<BrushKind, number>;
  paintMaterialId: number;
  quality: Quality;
  canUndo: boolean;
  canRedo: boolean;
  undoLabel?: string;
  redoLabel?: string;
  world: WorldInfo | null;
  hover: HoverInfo | null;
  stats: FrameStats | null;
  dialog: null | 'new' | 'load' | 'help';
  panelOpen: boolean;
  toasts: Toast[];
  lastSavedIso: string | null;
  set: (p: Partial<UiState>) => void;
  setRate: (k: BrushKind, v: number) => void;
  toast: (text: string, kind?: Toast['kind']) => void;
  dismissToast: (id: number) => void;
}

let toastId = 0;

export const useUi = create<UiState>((set) => ({
  tool: 'navigate',
  radiusM: 300,
  hardness: 0.3,
  rates: { ...DEFAULT_RATES },
  paintMaterialId: 4,
  quality: 'balanced',
  canUndo: false,
  canRedo: false,
  world: null,
  hover: null,
  stats: null,
  dialog: null,
  panelOpen: true,
  toasts: [],
  lastSavedIso: null,
  set: (p) => set(p),
  setRate: (k, v) => set((s) => ({ rates: { ...s.rates, [k]: v } })),
  toast: (text, kind = 'info') => {
    const id = ++toastId;
    set((s) => ({ toasts: [...s.toasts, { id, text, kind }].slice(-4) }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), kind === 'error' ? 7000 : 3500);
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
