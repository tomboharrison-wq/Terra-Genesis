import type { Lesson } from '../types';

/** Guided lesson: from a V-shaped river valley to a U-shaped glacial trough. */
export const glacialTrough: Lesson = {
  id: 'glacial-trough',
  module: 'glaciation',
  title: 'U-shaped valleys and hanging valleys',
  kind: 'guided',
  guided: 'trough',
  objective: 'Explain how a glacier changes a V-shaped river valley into a U-shaped valley, and how hanging valleys and moraine form.',
  stages: [
    {
      title: 'A V-shaped river valley',
      ks3: 'Before the ice age, a river flows in a narrow V-shaped valley, winding between spurs of high land.',
      gcse: 'In the upper course, vertical erosion by the river creates a V-shaped valley with interlocking spurs.',
      t: 0,
    },
    {
      title: 'A glacier fills the valley',
      ks3: 'The climate gets colder. Snow builds up and turns to ice, and a glacier flows down the valley, filling it almost to the top.',
      gcse: 'During a glacial period, accumulation exceeds ablation; a valley glacier occupies the former river valley and moves downhill under gravity.',
      t: 0.3,
    },
    {
      title: 'The ice deepens and widens the valley',
      ks3: 'The glacier pulls rocks out of the valley sides and floor (plucking) and scrapes them with the rocks frozen into its base (abrasion). The valley gets deeper, wider and straighter: the ends of the spurs are cut off.',
      gcse: 'Plucking and abrasion are most effective where the ice is thickest, deepening and widening the valley and truncating the spurs. The cross-section changes from V-shaped to a parabolic U-shape.',
      predict: 'What will the valley look like when the ice melts?',
      t: 1,
    },
    {
      title: 'The ice melts: a U-shaped valley',
      ks3: 'When the ice melts it leaves a wide, flat-floored U-shaped valley with steep sides. A small river flows in it — too small for such a big valley. Side valleys that had less ice are left hanging high up, with waterfalls. Rocks dropped by the ice form moraine.',
      gcse: 'Deglaciation leaves a glacial trough with a misfit stream, truncated spurs, hanging valleys (tributaries less deeply eroded by smaller glaciers, often with waterfalls) and moraine deposited by the retreating ice.',
      t: 1.5,
    },
  ],
  exam: {
    question: 'Explain how glacial erosion forms a U-shaped valley. (4 marks)',
    marks: 4,
    model:
      'A glacier occupies a former V-shaped river valley (1). It erodes the floor and sides by plucking, removing loosened blocks, and by abrasion, as rocks frozen into its base scrape the bedrock (1). The ice is thickest in the centre, so it deepens and widens the valley and cuts off interlocking spurs (1), leaving a steep-sided, flat-floored U-shaped valley after it melts (1).',
  },
  misconception: {
    wrong: 'The small river in a U-shaped valley carved the valley.',
    right: 'The river is a "misfit" — far too small for the valley. The valley was shaped by a glacier that filled it.',
  },
};

/** Guided lesson: corries, arêtes and pyramidal peaks. */
export const corrieArete: Lesson = {
  id: 'corrie-arete',
  module: 'glaciation',
  title: 'Corries and arêtes',
  kind: 'guided',
  guided: 'ridge',
  objective: 'Explain how corries form and how two corries cutting back into a ridge make an arête (and three or more a pyramidal peak).',
  stages: [
    {
      title: 'Snow collects in hollows',
      ks3: 'High on a mountain, snow collects in hollows on the shady side and does not melt in summer.',
      gcse: 'Snow accumulates in north-facing hollows (in the UK) where it is sheltered from the sun; it is compressed into firn and then glacier ice.',
      t: 0,
    },
    {
      title: 'Corries grow',
      ks3: 'The ice turns slowly in the hollow. It pulls rock off the back wall (plucking) and scrapes the floor (abrasion), digging an armchair-shaped hollow: a corrie.',
      gcse: 'Rotational movement of the corrie glacier deepens the floor by abrasion, while plucking and freeze-thaw steepen the back wall. A rock lip forms where erosion is weaker at the front.',
      t: 0.5,
    },
    {
      title: 'An arête',
      ks3: 'Corries on both sides of the ridge eat back into it. In the end only a thin ridge with a knife edge is left between them. This is an arête, like Striding Edge on Helvellyn.',
      gcse: 'Headward erosion of corries on either side of a ridge narrows it into a steep, knife-edged arête. Where three or more corries erode back into a summit, a pyramidal peak forms.',
      predict: 'What will be left in each corrie when the ice melts?',
      t: 1,
    },
    {
      title: 'Tarns after the ice',
      ks3: 'When the ice melts, water fills the bottom of each corrie behind its rock lip, making a small round lake called a tarn (like Red Tarn).',
      gcse: 'After deglaciation, the over-deepened corrie floor fills with water behind the rock lip, forming a tarn.',
      t: 1.5,
    },
  ],
  exam: {
    question: 'Explain how an arête forms. (3 marks)',
    marks: 3,
    model:
      'Corries form on either side of a mountain ridge as glaciers erode hollows by plucking and abrasion (1). The back walls of the corries are eroded backwards (headward erosion) by plucking and freeze-thaw weathering (1), narrowing the ridge between them into a sharp, knife-edged arête (1).',
  },
  misconception: {
    wrong: 'An arête is made by a glacier flowing along the top of the ridge.',
    right: 'An arête is what is left between two corries that have eroded back into the ridge from opposite sides.',
  },
};
