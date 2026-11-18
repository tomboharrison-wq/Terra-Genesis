import type { Lesson } from '../types';
import { drainageBasin } from './drainageBasin';
import { meander, waterfall } from './riverGuided';
import { barLagoon, caveArchStack, spit } from './coastal';
import { volcanoTypes } from './volcanoes';
import { corrieArete, glacialTrough } from './glacial';
import { foldMountains } from './tectonics';
import { meandersFloodplain, vValleySpurs, waterfallGorgeModel } from './riverGeologic';
import { glaciatedUpland } from './glacialGeologic';
import { headlandsBaysModel } from './coastalGeologic';
import { liveHeadland } from './liveHeadland';
import { liveWaterfall } from './liveWaterfall';
import { liveLevees } from './liveLevees';

/** All lessons, in teaching order within each module. */
export const LESSONS: Lesson[] = [drainageBasin, vValleySpurs, liveWaterfall, waterfall, waterfallGorgeModel, meander, meandersFloodplain, liveLevees, headlandsBaysModel, liveHeadland, caveArchStack, spit, barLagoon, volcanoTypes, glacialTrough, corrieArete, glaciatedUpland, foldMountains];

export function lessonById(id: string): Lesson | undefined {
  return LESSONS.find((l) => l.id === id);
}
