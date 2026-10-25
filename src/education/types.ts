import type { GenerateOptions } from '../terrain/generate';
import type { Engine } from '../engine/engine';
import type { OverlayId } from '../renderer/overlays';

/**
 * Lesson contract (spec G3). A lesson is either
 *  - 'emergent': a real simulated landscape; stages change it by running the physics, and labels are
 *    attached to features found in the simulated state; or
 *  - 'guided': a controlled demonstration (a guided local model), clearly marked as such.
 */
export type LessonModule = 'rivers' | 'coasts' | 'tectonics' | 'volcanoes' | 'glaciation';

export interface LessonLabel {
  text: string;
  xM: number;
  yM: number;
  /** Optional: hidden until "Show answer" (prediction stages). */
  answer?: boolean;
}

export interface StageContext {
  engine: Engine;
  /** Labels for this stage (computed from the current world). */
  setLabels(labels: LessonLabel[]): void;
}

export interface LessonStage {
  title: string;
  /** KS3 explanation (simpler language). */
  ks3: string;
  /** GCSE explanation (Edexcel Geography A terminology). */
  gcse: string;
  /** Changes the world for this stage (runs physics). Entering a stage again restores its saved state instead. */
  enter?(ctx: StageContext): void;
  /** Labels attached to real locations in the current world. */
  labels?(ctx: StageContext): LessonLabel[];
  camera?: 'oblique' | 'top';
  overlay?: OverlayId;
  /** A question to think about before revealing labels marked `answer`. */
  predict?: string;
  /** Guided lessons: model time / stage parameter shown at this stage (animated from the previous one). */
  t?: number;
  /** Guided meander lesson: show the bend cross-section inset. */
  section?: boolean;
}

export interface Lesson {
  id: string;
  module: LessonModule;
  title: string;
  kind: 'emergent' | 'guided';
  objective: string;
  /** Emergent lessons: the world to generate. */
  setup?: GenerateOptions;
  /** Guided lessons: which guided model is shown instead of the 3D world. */
  guided?: 'waterfall' | 'meander' | 'arch' | 'spit' | 'bar' | 'trough' | 'ridge' | 'folds';
  stages: LessonStage[];
  exam?: { question: string; marks: number; model: string };
  misconception?: { wrong: string; right: string };
}
