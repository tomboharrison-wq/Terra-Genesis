import type { ReactElement } from 'react';
import { Bars, Beaches, CavesArchesStacks, CliffsPlatforms, HeadlandsBays, Spits, type SceneProps } from './coastScenes';
import { FloodplainsLevees, InterlockingSpurs, Meanders, OxbowLakes, WaterfallsGorges } from './riverScenes';
import { CorriesAretes, CragTail, Drumlins, Moraines, RocheMoutonnee, TroughsSpursHanging } from './glacialScenes';

export type { SceneProps };

/** Drawing for each formation in src/education/landforms/content.ts (same ids). */
export const SCENES: Record<string, (p: SceneProps) => ReactElement> = {
  'headlands-bays': HeadlandsBays,
  'cliffs-platforms': CliffsPlatforms,
  'caves-arches-stacks': CavesArchesStacks,
  beaches: Beaches,
  spits: Spits,
  bars: Bars,
  'interlocking-spurs': InterlockingSpurs,
  'waterfalls-gorges': WaterfallsGorges,
  'meanders-cliffs-bars': Meanders,
  'oxbow-lakes': OxbowLakes,
  'floodplains-levees': FloodplainsLevees,
  'corries-aretes': CorriesAretes,
  'troughs-spurs-hanging': TroughsSpursHanging,
  'roche-moutonnee': RocheMoutonnee,
  moraines: Moraines,
  'crag-tail': CragTail,
  drumlins: Drumlins,
};
