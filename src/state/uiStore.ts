import { create } from 'zustand';
import type { BrushKind } from '../tools/brush';
import type { FrameStats, Quality, TerrainOverlay } from '../renderer/TerrainScene';
import type { WaterView } from '../renderer/waterLayer';

export type WaterToolId = 'water-add' | 'water-drain' | 'spring';
export type ToolId =
  | 'navigate'
  | BrushKind
  | WaterToolId
  | 'profile'
  | 'landslide'
  | 'coast'
  | 'climate'
  | 'plates'
  | 'earthquake'
  | 'volcano'
  | 'measure'
  | 'hazards'
  | 'meteor';

export const isBrushTool = (t: ToolId): t is BrushKind =>
  t !== 'navigate' &&
  t !== 'profile' &&
  t !== 'landslide' &&
  t !== 'coast' &&
  t !== 'climate' &&
  t !== 'plates' &&
  t !== 'earthquake' &&
  t !== 'volcano' &&
  t !== 'measure' &&
  t !== 'hazards' &&
  t !== 'meteor' &&
  !t.startsWith('water-') &&
  t !== 'spring';

/** Transect end points in world metres (x east, y north). */
export interface ProfileLine {
  ax: number;
  ay: number;
  bx: number;
  by: number;
}
export interface MeasurePin {
  label: string;
  xM: number;
  yM: number;
}
export const MAX_PINS = 6;
export const isWaterTool = (t: ToolId): t is WaterToolId => t === 'water-add' || t === 'water-drain' || t === 'spring';

export interface GeoInfo {
  mode: boolean;
  playing: boolean;
  yearsPerSec: number;
  achieved: number;
  years: number;
  /** Years of each recorded frame (record and replay). */
  frames: number[];
  /** Frame index being shown, or null for the latest state. */
  viewing: number | null;
  busy: boolean;
}

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
  weatherK: number;
  slopeFailure: boolean;
  zMin: number;
  zMax: number;
  coast: {
    wavesOn: boolean;
    waveHeightM: number;
    wavePeriodS: number;
    waveFromDeg: number;
    cliffEroded: number;
    cliffBedrock: number;
    nearshoreDeposited: number;
    drifted: number;
  };
  climate: {
    enabled: boolean;
    seaLevelTempC: number;
    lapseRateCPerKm: number;
    seasonalAmpC: number;
    seasonPhase: number;
    seasonsRun: boolean;
    windFromDeg: number;
    orographic: number;
    shadowScaleM: number;
    shadowReachM: number;
    landTempMinC: number;
    landTempMaxC: number;
    rainMinX: number;
    rainMaxX: number;
    meltMmPerDegDay: number;
    snowM3: number;
    snowCoverPct: number;
    snowfallM3: number;
    snowmeltM3: number;
  };
  lava: {
    vents: {
      id: number;
      x: number;
      y: number;
      rateM3PerS: number;
      kind: 'basalt' | 'andesite';
      remainingS: number;
      style?: 'lava' | 'explosive' | 'mixed';
    }[];
    tephraEruptedM3: number;
    tephraDepositedM3: number;
    tephraOffMapM3: number;
    tephraClosure: number;
    plumeKm: number;
    windSpeedMS: number;
    eruptedM3: number;
    flowingM3: number;
    solidifiedM3: number;
    maxTempC: number | null;
    closure: number;
  };
  tectonics: {
    enabled: boolean;
    yearsPerSimHour: number;
    beltWidthM: number;
    plates: {
      id: number;
      name: string;
      kind: 'continental' | 'oceanic';
      vxMmYr: number;
      vyMmYr: number;
    }[];
    upliftedM3: number;
    subsidedM3: number;
    years: number;
    convergent: number;
    divergent: number;
    transform: number;
    maxElevM: number;
    revision: number;
    slipM: number;
    shifts: number;
    volcanicM3: number;
    vents: number;
  };
  vegetation: {
    enabled: boolean;
    annualPrecipMm: number;
    yearsPerSimHour: number;
    erosionShield: number;
    coverPct: number;
    forestPct: number;
    treelineM: number;
  };
  glacier: {
    enabled: boolean;
    yearsPerSimHour: number;
    elaTempC: number;
    abrasionK: number;
    slidingFactor: number;
    elaM: number;
    iceM3: number;
    iceAreaPct: number;
    maxIceM: number;
    maxSlideMPerYr: number;
    erodedM3: number;
    morainedM3: number;
    years: number;
    lagYears: number;
  };
  sed: {
    weathered: number;
    rockfall: number;
    erodedLoose: number;
    erodedBedrock: number;
    deposited: number;
    seaDeposited: number;
    exported: number;
    suspended: number;
    closure: number;
  };
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
  /** Climate on: local temperature (°C) and rainfall (mm/h). */
  temperatureC?: number;
  snowSweM?: number;
  iceM?: number;
  lavaM?: number;
  lavaC?: number;
  ashM?: number;
  vegPct?: number;
  rainHereMmH?: number;
  isSea: boolean;
  /** Value of the active map overlay at the cursor. */
  overlay?: { label: string; text: string };
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

export interface QuakeSettings {
  type: 'normal' | 'reverse' | 'strike-slip';
  mw: number;
  strikeDeg: number;
  landslides: boolean;
  shake: boolean;
}

export interface MeteorSettings {
  kind: 'stony' | 'iron' | 'comet';
  diameterM: number;
  speedKmS: number;
  angleDeg: number;
}

export interface VolcanoSettings {
  kind: 'basalt' | 'andesite';
  style: 'lava' | 'explosive' | 'mixed';
  /** 'eruption' = one vent in real time; otherwise build a whole volcano from many eruptions. */
  mode: 'eruption' | 'shield' | 'composite' | 'island' | 'caldera';
  calderaRadiusM: number;
  calderaDepthM: number;
  episodes: number;
  rateM3PerS: number;
  hours: number;
}

interface UiState {
  tool: ToolId;
  volcano: VolcanoSettings;
  /** Education Mode (spec G): active lesson, stage, explanation level and label switches. */
  education: {
    lessonId: string;
    stage: number;
    level: 'ks3' | 'gcse';
    labels: boolean;
    answer: boolean;
    busy: boolean;
    /** Indices of stages shown from a recorded run (education/recordings) rather than run live. */
    recorded?: number[];
    /** Presentation: text scale, high contrast, panel hidden (map only). */
    big?: boolean;
    contrast?: boolean;
    hidePanel?: boolean;
  } | null;
  /** Labels of the current lesson stage, at world positions. */
  lessonLabels: { text: string; xM: number; yM: number; answer?: boolean }[];
  /** Active challenge (spec F6) and its live score. */
  challenge: {
    id: string;
    status: 'running' | 'passed' | 'failed';
    text: string;
    fraction: number;
    elapsedS: number;
  } | null;
  /** Progress of a volcano build in progress (eruptions done / total). */
  volcanoBuild: { type: string; done: number; total: number } | null;
  quake: QuakeSettings;
  meteor: MeteorSettings;
  /** Landform Show: formation shown, and a scripted seek (0 … 1) for tests / links. */
  landformId: string | null;
  /** Simulator time-lapse: fastest speed and maximum landscape acceleration (runtime.setTimeLapse). */
  timeLapse: boolean;
  /** Geological time (app/geoRunner): mode on, running, speed, achieved rate, years, recorded frames. */
  geo: GeoInfo;
  /** Classroom mode: Performance quality and new worlds at 128² (app/runtime.setClassroom). */
  classroom: boolean;
  landformSeek: number | null;
  /** Summary of the last earthquake (for the panel). */
  lastQuake: {
    mw: number;
    type: string;
    ruptureKm: number;
    avgSlipM: number;
    maxUpM: number;
    maxDownM: number;
    lateralCells: number;
    landslides: number;
  } | null;
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
  dialog:
    | null
    | 'new'
    | 'load'
    | 'help'
    | 'slump'
    | 'arch'
    | 'shore'
    | 'subduction'
    | 'folds'
    | 'checkpoints'
    | 'challenges'
    | 'lessons'
    | 'export'
    | 'landforms';
  panelOpen: boolean;
  toasts: Toast[];
  lastSavedIso: string | null;
  sim: SimInfo | null;
  waterView: WaterView;
  terrainOverlay: TerrainOverlay;
  profile: ProfileLine | null;
  /** Measurement pins (world metres), labelled A, B, C… */
  pins: MeasurePin[];
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
  volcano: {
    kind: 'basalt',
    style: 'lava',
    mode: 'eruption',
    episodes: 8,
    calderaRadiusM: 600,
    calderaDepthM: 150,
    rateM3PerS: 50,
    hours: 6,
  },
  volcanoBuild: null,
  challenge: null,
  education: null,
  lessonLabels: [],
  quake: {
    type: 'reverse',
    mw: 7,
    strikeDeg: 30,
    landslides: true,
    shake: true,
  },
  lastQuake: null,
  meteor: { kind: 'stony', diameterM: 30, speedKmS: 17, angleDeg: 45 },
  landformId: null,
  timeLapse: false,
  classroom: (() => {
    try {
      return localStorage.getItem('tg-classroom') === '1';
    } catch {
      return false;
    }
  })(),
  geo: { mode: false, playing: false, yearsPerSec: 10000, achieved: 0, years: 0, frames: [], viewing: null, busy: false },
  landformSeek: null,
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
  pins: [],
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
