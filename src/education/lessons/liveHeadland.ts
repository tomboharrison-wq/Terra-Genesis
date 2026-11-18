import type { Lesson } from '../types';
import { buildLiveHeadlandWorld } from '../../sim/coast/solidHeadland';
import { caveArchStack } from './coastal';

const explanations = [
  ['A jointed chalk headland', 'The solid headland has a weaker joint across it. Waves can reach both sides. Nothing has been cut out to make a cave.', 'The starting rock is solid. Wave energy reaches exposed faces and penetrates connected water-filled openings. The joint erodes faster than intact rock.'],
  ['Wave attack', 'Waves erode rock at sea level. Openings grow along the joint as individual pieces of rock are removed.', 'Hydraulic action and abrasion are represented by wave damage on exposed rock faces. Damage builds faster along the joint. The cave is an actual void in the solid rock.'],
  ['A through opening', 'Continued erosion may join the caves. Turn the landscape to look through the opening beneath the remaining roof.', 'An arch is detected only when water can pass through the rock below a surviving roof. Wave climate and rock strength determine whether and when this happens.'],
  ['Loss of support', 'Erosion widens the opening and weathering weakens exposed rock. Unsupported rock falls, which can leave a stack.', 'Roof failure depends on unsupported span and connectivity to the seabed. An isolated above-water remnant is measured as a stack, rather than selected as a replacement shape.'],
  ['Continued erosion', 'Keep running the model. Waves can undercut the stack until it collapses and leaves a low stump.', 'The sequence is read from surviving rock. These are illustrative process years, not a prediction for a real coast. Removed rock is recorded as exported debris; individual fallen blocks are not tracked.'],
];

export const liveHeadland: Lesson = {
  id: 'live-headland', module: 'coasts', title: 'Live headland: caves, arches, stacks and stumps',
  kind: 'emergent', geological: true, build: buildLiveHeadlandWorld,
  objective: 'Watch waves remove solid rock in the main landscape, and explain how joints, cave growth and loss of support can form an arch, stack and stump.',
  stages: explanations.map(([title, ks3, gcse], k) => ({
    title, ks3, gcse, camera: 'oblique',
    enter: k ? (ctx) => ctx.geo([0, 100, 600, 300, 2700][k]) : undefined,
    labels: ({ engine }) => {
      const s = engine.world.meta.solidHeadland!;
      const stage = s.history[s.history.length - 1].stage;
      return [{ text: `${stage[0].toUpperCase()}${stage.slice(1)} | ${s.exportedM3.toLocaleString()} m³ removed`, xM: 24, yM: 23 }];
    },
  })),
  exam: caveArchStack.exam,
  misconception: caveArchStack.misconception,
};
