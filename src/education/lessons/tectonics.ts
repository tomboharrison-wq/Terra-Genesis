import type { Lesson } from '../types';

/** Fold-section parameters for lesson stage parameter t (0 flat layers … 3 folded, faulted and eroded). */
export function foldStage(t: number): {
  shortening: number;
  wavelengthKm: number;
  thrust: boolean;
  erosion: number;
} {
  const s = t <= 1 ? 0.25 * t : 0.25 + 0.2 * Math.min(1, t - 1);
  return {
    shortening: s,
    wavelengthKm: 12,
    thrust: t > 1.5,
    erosion: Math.max(0, Math.min(1, t - 2)) * 0.3,
  };
}

/** Guided lesson: fold mountains at a collision margin (uses the fold lab's length- and area-conserving model). */
export const foldMountains: Lesson = {
  id: 'fold-mountains',
  module: 'tectonics',
  title: 'Fold mountains at collision margins',
  kind: 'guided',
  guided: 'folds',
  objective: 'Explain how layers of sedimentary rock are folded and faulted into fold mountains where two continental plates collide.',
  stages: [
    {
      title: 'Layers of sediment between two continents',
      ks3: 'For millions of years, sand and mud settled in the sea between two continents, building up flat layers of rock.',
      gcse: 'Sediments deposited in the ocean basin (geosyncline) between two continental plates are compressed into horizontal layers of sedimentary rock.',
      t: 0,
    },
    {
      title: 'The continents push together',
      ks3: 'The plates move towards each other. The rock layers are squeezed and crumple into folds — upfolds (anticlines) and downfolds (synclines) — like a rug pushed against a wall.',
      gcse: 'At a collision margin, two continental plates converge. Neither is dense enough to subduct, so the sediments are compressed and buckled into anticlines and synclines. Each layer keeps its length (it buckles) and its volume (it thickens).',
      t: 1,
    },
    {
      title: 'Faults and thrusting',
      ks3: 'Squeezed even harder, the rocks break along a sloping crack (a thrust fault) and one block slides up over another. The mountains get higher.',
      gcse: 'Continued compression causes faulting: thrust faults stack rock slices on top of each other, thickening the crust and raising fold mountains such as the Himalayas (India–Eurasia collision).',
      predict: 'If rivers and ice wear the tops off the folds, which rocks will be at the surface in the middle of an anticline?',
      t: 2,
    },
    {
      title: 'Erosion exposes the folds',
      ks3: 'Rain, rivers and glaciers wear the mountains down. The cut shows bands of rock: the oldest rocks in the middle of the upfolds, the youngest in the downfolds.',
      gcse: 'Erosion truncates the folds, exposing older rocks in anticline cores and younger rocks in syncline cores — the outcrop pattern geologists use to map folds.',
      t: 3,
    },
  ],
  exam: {
    question: 'Explain how fold mountains are formed. (4 marks)',
    marks: 4,
    model:
      'Fold mountains form at collision (convergent) margins where two continental plates move towards each other (1). Sediments that built up in the ocean between them are compressed (1) and buckle into folds — anticlines and synclines (1) — and are pushed upwards; faulting and thrusting thicken and raise them further, forming high mountain ranges such as the Himalayas (1).',
  },
  misconception: {
    wrong: 'Fold mountains form where an oceanic plate sinks under a continent.',
    right:
      'That is subduction (destructive margin), which builds volcanic mountains and trenches. Fold mountains are built where two continents collide and neither sinks.',
  },
};
