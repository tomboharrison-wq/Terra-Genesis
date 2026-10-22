import { create } from 'zustand';
import type { BrushKind } from '../tools/brush';
import type { FrameStats, Quality, TerrainOverlay } from '../renderer/TerrainScene';
import type { WaterView } from '../renderer/waterLayer';

export type WaterToolId = 'water-add' | 'water-drain' | 'spring';
export type ToolId = 'navigate' | BrushKind | WaterToolId | 'profile';

export const isBrushTool = (t: ToolId): t is BrushKind => t !== 'navigate' && t !== 'profile' && !t.startsWith('water-') && t !== 'spring';

/** Transect end points in world metres (x east, y north). */
export interface ProfileLine {
  ax: number;
  ay: number;
  bx: number;
  by: number;
}
export const isWaterTool = (t: ToolId): t is WaterToolId => t === 'water-add' || t === 'water-drain' || t === 'spring';

export interface SimInfo {
  playing: boolean;
  speed: number;
  achievedSpeed: number;
  simTimeS: number;
  backend: 'gpu' | 'cpu';
  storedM3: number;
  inM3: number;
  outM3: number;
  closure: number;
  maxDepthM: number;
  maxSpeedMS: number;
  rainMmH: number;
  infMmH: number;
  evapMmH: number;
  boundary: 'open' | 'closed';
  sources: { id: number; x: number; y: number; rateM3PerS: number }[];
  erosionOn: boolean;
  speedup: number;
  bedrockFactor: number;
  creepK: number;
  sed: { erodedLoose: number; erodedBedrock: number; deposited: number; seaDeposited: number; exported: number; suspended: number; closure: number };
}

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
  waterDepthM: number;
  waterSpeedMS: number;
  isSea: boolean;
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
  sim: SimInfo | null;
  waterView: WaterView;
  terrainOverlay: TerrainOverlay;
  profile: ProfileLine | null;
  profileStart: { x: number; y: number } | null;
  /** Water brush rate (m/s of brush time). */
  waterRate: number;
  springRate: number;
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
  sim: null,
  waterView: 'water',
  terrainOverlay: 'none',
  profile: null,
  profileStart: null,
  waterRate: 0.5,
  springRate: 20,
  set: (p) => set(p),
  setRate: (k, v) => set((s) => ({ rates: { ...s.rates, [k]: v } })),
  toast: (text, kind = 'info') => {
    const id = ++toastId;
    set((s) => ({ toasts: [...s.toasts, { id, text, kind }].slice(-4) }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), kind === 'error' ? 7000 : 3500);
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
