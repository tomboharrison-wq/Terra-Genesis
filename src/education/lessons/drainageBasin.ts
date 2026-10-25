import type { Lesson, LessonLabel, StageContext } from '../types';
import { findBasin, type Feature } from '../features';
import { MM_PER_H } from '../../engine/world';

const NAMES: Record<Feature['kind'], string> = {
  mouth: 'Mouth',
  source: 'Source',
  confluence: 'Confluence',
  tributary: 'Tributary',
  'main-river': 'Main river',
  watershed: 'Watershed',
};

const labelsFor = (ctx: StageContext, kinds: Feature['kind'][], answer = false): LessonLabel[] => {
  const b = findBasin(ctx.engine.world, ctx.engine.surface);
  return b.features.filter((f) => kinds.includes(f.kind)).map((f) => ({ text: NAMES[f.kind], xM: f.xM, yM: f.yM, answer }));
};

/** Emergent lesson: a drainage basin and its river network, all found in the simulated landscape. */
export const drainageBasin: Lesson = {
  id: 'drainage-basin',
  module: 'rivers',
  title: 'The drainage basin',
  kind: 'emergent',
  objective:
    'Identify the parts of a drainage basin — watershed, source, tributary, confluence, main river and mouth — and explain how rain becomes river flow.',
  setup: {
    presetId: 'river-basin',
    seed: 5101,
    size: 192,
    cellSizeM: 30,
    reliefM: 900,
    seaLevelM: -20,
    roughness: 0.5,
    rainMmH: 0,
    erosion: false,
    name: 'Lesson: drainage basin',
  },
  stages: [
    {
      title: 'An area of land drained by a river',
      ks3: 'A drainage basin is all the land where the rain ends up flowing into one river. The high ground around its edge is the watershed. Rain on the other side of the watershed flows into a different river.',
      gcse: 'A drainage basin is the area of land drained by a river and its tributaries, from its source to its mouth. Its boundary is the watershed — a ridge of high land dividing neighbouring basins. The labels are found from the model’s own flow directions (each point drains down its steepest slope).',
      camera: 'oblique',
      overlay: 'elevation',
      labels: (ctx) => labelsFor(ctx, ['watershed', 'mouth']),
    },
    {
      title: 'Rain falls on the basin',
      ks3: 'It starts to rain. Water that cannot soak in runs over the ground (surface runoff) and collects in the lowest places — small channels in the valleys.',
      gcse: 'Precipitation is an input. With little infiltration, surface runoff (overland flow) moves downslope and concentrates in channels. The model now runs two hours of heavy rain (40 mm/h).',
      enter: (ctx) => {
        ctx.engine.setWaterParams({ rainMPerS: 40 * MM_PER_H });
        ctx.engine.advance(2 * 3600);
      },
      camera: 'oblique',
      overlay: 'none',
      predict: 'Where do you think the water will collect first?',
      labels: (ctx) => labelsFor(ctx, ['source', 'main-river'], true),
    },
    {
      title: 'Streams join together',
      ks3: 'Small streams flow downhill and join. The point where two rivers meet is a confluence. A smaller river that joins a bigger one is a tributary.',
      gcse: 'Channels converge downstream: tributaries join the main river at confluences, so discharge increases downstream. The colours show flow accumulation — how much of the basin drains through each point.',
      camera: 'top',
      overlay: 'flow',
      labels: (ctx) => labelsFor(ctx, ['source', 'tributary', 'confluence', 'main-river']),
    },
    {
      title: 'The river leaves the basin',
      ks3: 'All the water in the basin leaves through one place: the mouth, where the river reaches the sea, a lake or another river.',
      gcse: 'The mouth is the output point of the basin system. Every label here was found in the simulated landscape: change the land and the basin, its rivers and its labels change too.',
      camera: 'oblique',
      overlay: 'flow',
      labels: (ctx) => labelsFor(ctx, ['watershed', 'source', 'tributary', 'confluence', 'main-river', 'mouth']),
    },
  ],
  exam: {
    question: 'Explain why the amount of water in a river increases downstream. (4 marks)',
    marks: 4,
    model:
      'Tributaries join the main river at confluences, adding their water (1). The drainage basin area upstream of each point grows downstream, so more precipitation is collected (1). Surface runoff and throughflow from the valley sides feed the channel along its length (1), so discharge increases towards the mouth (1).',
  },
  misconception: {
    wrong: 'A river’s water all comes from its source.',
    right: 'The source is only where the river starts. Most of its water joins further down, from tributaries, runoff and groundwater across the whole basin.',
  },
};
