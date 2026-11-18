import type { Lesson } from '../types';
import { buildLiveWaterfallWorld, waterfallMetrics } from '../../sim/river/solidWaterfall';
import { waterfallGorgeModel } from './riverGeologic';

const texts = [
  ['A river over hard and soft rock', 'A river runs over a resistant cap above softer rock. The initial river step is set up for this experiment. Watch what the river does to it.', 'This experiment starts with a river step, not a pre-cut cave or gorge. A steady river attacks exposed soft rock below a more resistant cap. Its discharge controls erosion.'],
  ['The plunge pool and undercut', 'The falling river wears a pool into the bed. It also wears away the soft rock beneath the cap, making a real overhang.', 'Impact scour deepens the plunge pool, with less erosion as water depth increases. Hydraulic action and abrasion are represented by damage to exposed rock. The overhang is an actual void below solid cap rock.'],
  ['The unsupported cap collapses', 'The cap can only bridge a limited gap. When too much soft rock has gone, the unsupported cap falls and the waterfall moves upstream.', 'Failure is computed from the distance to supported rock in the longitudinal section. Removing unsupported cap voxels changes the actual waterfall lip. Collapse volume is measured, not selected by a lesson stage.'],
  ['Retreat leaves a gorge', 'Repeated undercutting and collapse move the waterfall upstream. A narrow gorge is left between the valley sides.', 'The river continues through the gorge cut into the plateau. Change discharge or cap strength after leaving the lesson and compare retreat. Times and rates are illustrative, rather than calibrated for a real waterfall.'],
];

export const liveWaterfall: Lesson = {
  id: 'live-waterfall', title: 'Live river: waterfall, plunge pool and gorge', module: 'rivers', kind: 'emergent', geological: true,
  build: buildLiveWaterfallWorld,
  objective: 'Observe real undercutting, plunge-pool erosion and unsupported cap collapse in the main landscape, then explain waterfall retreat and gorge formation.',
  stages: texts.map(([title, ks3, gcse], k) => ({ title, ks3, gcse, camera: 'oblique',
    enter: k ? (ctx) => ctx.geo([0, 25, 75, 200][k]) : undefined,
    labels: ({ engine }) => {
      const f = waterfallMetrics(engine.world.meta.solidWaterfall!);
      return [{ text: `Retreat ${f.retreatM} m | undercut ${f.undercutM} m | pool ${f.poolDepthM} m`, xM: f.lip, yM: 20 }];
    },
  })),
  exam: waterfallGorgeModel.exam, misconception: waterfallGorgeModel.misconception,
};
