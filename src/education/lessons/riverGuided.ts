import type { Lesson } from '../types';

/** Guided lesson: waterfall formation and retreat (spec G3 example). */
export const waterfall: Lesson = {
  id: 'waterfall',
  module: 'rivers',
  title: 'How a waterfall and gorge form',
  kind: 'guided',
  guided: 'waterfall',
  objective: 'Explain how a waterfall forms where hard rock lies over soft rock, and why it retreats upstream to leave a gorge.',
  stages: [
    {
      title: 'Hard rock over soft rock',
      ks3: 'The river flows over a band of hard rock that lies on top of softer rock. Where the hard rock ends, the river drops over the edge as a waterfall.',
      gcse: 'Waterfalls form where a band of resistant cap rock overlies less resistant rock. Differential erosion lowers the softer rock downstream faster, creating a vertical drop.',
      t: 0,
    },
    {
      title: 'Undercutting and the plunge pool',
      ks3: 'The falling water and the rocks it carries wear away the soft rock behind the waterfall faster than the hard rock. The hard rock is left sticking out as an overhang, and a deep plunge pool forms below.',
      gcse: 'Hydraulic action and abrasion by the turbulent water and the load it swirls around erode the less resistant rock, undercutting the cap rock to leave an overhang. Abrasion deepens the plunge pool.',
      predict: 'What will happen to the overhang as it gets longer?',
      t: 32,
    },
    {
      title: 'The overhang collapses',
      ks3: 'In the end the overhang is too big to hold its own weight. It breaks off and falls into the plunge pool. The waterfall is now a little further upstream.',
      gcse: 'When the overhang becomes unsupported it collapses under gravity. The fallen blocks are broken down by attrition and used as tools for further abrasion of the plunge pool. The waterfall has retreated upstream.',
      t: 34,
    },
    {
      title: 'Retreat leaves a gorge',
      ks3: 'This happens again and again. Each time the waterfall moves back upstream, leaving a narrow, steep-sided valley called a gorge.',
      gcse: 'Repeated undercutting and collapse cause headward retreat of the waterfall, leaving a steep-sided gorge downstream (e.g. High Force on the River Tees). The model shows the cycle with illustrative rates.',
      t: 300,
    },
  ],
  exam: {
    question: 'Explain the formation of a waterfall and gorge. (4 marks)',
    marks: 4,
    model:
      'Waterfalls form where resistant rock overlies less resistant rock (1). The softer rock is eroded faster by hydraulic action and abrasion, undercutting the hard rock and creating an overhang and plunge pool (1). The unsupported overhang eventually collapses into the plunge pool (1). Repeated collapse makes the waterfall retreat upstream, leaving a steep-sided gorge (1).',
  },
  misconception: {
    wrong: 'The waterfall wears the hard rock down from the top.',
    right: 'The hard cap is barely eroded from above: the waterfall retreats because the soft rock beneath it is worn away, so the unsupported cap collapses.',
  },
};

/** Guided lesson: meanders and oxbow lakes (spec G3 example). */
export const meander: Lesson = {
  id: 'meander',
  module: 'rivers',
  title: 'Meanders and oxbow lakes',
  kind: 'guided',
  guided: 'meander',
  objective: 'Explain how meanders develop by erosion and deposition, and how a meander is cut off to form an oxbow lake.',
  stages: [
    {
      title: 'A river begins to bend',
      ks3: 'On flat land a river starts to swing from side to side. The fastest water swings with it, from one bank to the other.',
      gcse: 'In the lower course, the line of fastest flow (thalweg) swings from side to side. Where it hits a bank, lateral erosion begins; where flow is slow, deposition occurs.',
      t: 0.15,
    },
    {
      title: 'Erosion outside, deposition inside',
      ks3: 'On the outside of each bend the water is deep and fast, so it wears the bank away into a steep river cliff. On the inside the water is shallow and slow, so it drops sand and gravel, building a gentle slip-off slope.',
      gcse: 'Faster flow and greater depth on the outer bank cause lateral erosion by hydraulic action and abrasion, forming a river cliff. Slower flow on the inner bank (less energy) causes deposition, building a point bar and slip-off slope. The cross-section shows the asymmetric channel.',
      t: 0.55,
      section: true,
    },
    {
      title: 'The neck gets narrower',
      ks3: 'As the outside banks keep wearing away, the bends grow and the land between two bends — the neck — gets narrower.',
      gcse: 'Continued lateral erosion on the outer banks causes the meander to migrate and enlarge; the neck between two bends narrows.',
      predict: 'What might happen when the river floods here?',
      t: 0.95,
    },
    {
      title: 'Cut-off: an oxbow lake',
      ks3: 'During a flood the river breaks through the narrow neck and takes the shorter, straighter path. The old bend is left behind as a horseshoe-shaped oxbow lake.',
      gcse: 'During a flood, erosion breaks through the neck; the river follows the steeper, shorter route. Deposition seals the ends of the abandoned meander, leaving an oxbow lake.',
      t: 1.05,
    },
    {
      title: 'The lake silts up',
      ks3: 'Over time the oxbow lake fills with mud and plants, leaving a curved mark on the floodplain called a meander scar.',
      gcse: 'Without through-flow, the oxbow lake infills with sediment and vegetation and becomes a meander scar on the floodplain.',
      t: 1.95,
    },
  ],
  exam: {
    question: 'Explain how an oxbow lake forms. (4 marks)',
    marks: 4,
    model:
      'Faster flow on the outside of a meander bend causes lateral erosion, forming a river cliff, while deposition occurs on the inside (1). The meander neck narrows as erosion continues on the outer banks (1). During a flood the river cuts through the neck, taking the shortest course (1). Deposition seals off the old meander loop, leaving a horseshoe-shaped oxbow lake (1).',
  },
  misconception: {
    wrong: 'The water is fastest on the inside of the bend because it has less distance to travel.',
    right: 'The fastest, deepest water is on the outside of the bend, which is why the outside bank is eroded and the inside receives deposits.',
  },
};
