/**
 * Landform Show (Edexcel GCSE Geography A, 1GA0, Component 1 Topic 1): one animated formation per
 * landform group, covering every landform the specification names in 1.4a/b, 1.8a/b/c and 1.12a/b/c.
 * Each formation is a timed sequence of stages (t = 0 … 1) with KS3 and GCSE wording, the processes
 * involved and the numbered steps of a formation answer. The drawings live in src/app/landforms.
 */
export type LandformTopic = 'coast' | 'river' | 'glacial';

export interface FormationStage {
  /** Start of the stage on the formation timeline (0 … 1). */
  at: number;
  title: string;
  ks3: string;
  gcse: string;
}

export interface Formation {
  id: string;
  title: string;
  topic: LandformTopic;
  /** Specification reference(s), e.g. '1.4a'. */
  spec: string;
  /** The specification's own landform words this formation shows. */
  landforms: string[];
  /** Key processes (specification vocabulary). */
  processes: string[];
  /** How the diagram is drawn: from a tested guided model, or an animated textbook diagram. */
  source: 'model' | 'diagram';
  view: string;
  /** Seconds at 1× speed. */
  durationS: number;
  stages: FormationStage[];
  /** Numbered steps of an exam-style "explain the formation" answer. */
  examSteps: string[];
  /** Education Mode lesson that explores the same landform in the simulator, if any. */
  lesson?: string;
  /** A geological-time lesson where the landform forms in the landscape evolution model. */
  modelLesson?: string;
}

export const TOPICS: { id: LandformTopic; title: string; spec: string }[] = [
  { id: 'coast', title: 'Coastal landscapes', spec: '1A · 1.4' },
  { id: 'river', title: 'River landscapes', spec: '1B · 1.8' },
  { id: 'glacial', title: 'Glaciated upland landscapes', spec: '1C · 1.12' },
];

export const FORMATIONS: Formation[] = [
  // ---------------------------------------------------------------- coasts (1.4)
  {
    id: 'headlands-bays',
    title: 'Headlands and bays',
    topic: 'coast',
    spec: '1.4a',
    landforms: ['headlands', 'bays'],
    processes: ['hydraulic action', 'abrasion', 'differential erosion', 'wave refraction', 'deposition'],
    source: 'diagram',
    view: 'Map view (sea at the bottom)',
    durationS: 26,
    stages: [
      {
        at: 0,
        title: 'Bands of hard and soft rock',
        ks3: 'Here, strips of hard rock and soft rock reach the sea side by side.',
        gcse: 'A discordant coastline: bands of resistant and less resistant rock run at right angles to the coast.',
      },
      {
        at: 0.18,
        title: 'Soft rock is eroded faster',
        ks3: 'Waves smash into the coast. The soft rock is worn away more quickly than the hard rock.',
        gcse: 'Hydraulic action and abrasion erode the less resistant rock (clay, sand) faster than the resistant rock — differential erosion.',
      },
      {
        at: 0.42,
        title: 'Bays form',
        ks3: 'The soft rock is cut back into curved bays.',
        gcse: 'The less resistant rock retreats to form bays: wide, curved inlets.',
      },
      {
        at: 0.62,
        title: 'Headlands are left',
        ks3: 'The hard rock sticks out into the sea as headlands.',
        gcse: 'The resistant rock is left jutting out as headlands, now exposed to waves on three sides.',
      },
      {
        at: 0.8,
        title: 'Waves bend; beaches build in the bays',
        ks3: 'Waves bend round the headlands, so the bays get calmer water and sand settles there as beaches.',
        gcse: 'Wave refraction concentrates energy on the headlands and spreads it out in the bays, where low-energy waves deposit beaches.',
      },
    ],
    examSteps: [
      'The coastline has alternating bands of resistant and less resistant rock at right angles to the sea (discordant).',
      'Hydraulic action and abrasion erode the less resistant rock faster (differential erosion).',
      'The less resistant rock retreats to form bays.',
      'The resistant rock is left protruding as headlands.',
      'Wave refraction focuses energy on the headlands (so they now erode) and reduces it in the bays, where beaches are deposited.',
    ],
  },
  {
    id: 'cliffs-platforms',
    title: 'Cliffs and wave-cut platforms',
    topic: 'coast',
    spec: '1.4a',
    landforms: ['cliffs', 'wave cut platforms'],
    processes: ['hydraulic action', 'abrasion', 'mass movement', 'weathering'],
    source: 'diagram',
    view: 'Cross-section (sea on the right)',
    durationS: 28,
    stages: [
      {
        at: 0,
        title: 'Waves attack the foot of the cliff',
        ks3: 'Waves hit the bottom of the cliff, between high and low tide.',
        gcse: 'Erosion is concentrated between high and low tide, where hydraulic action and abrasion attack the cliff foot.',
      },
      {
        at: 0.18,
        title: 'A wave-cut notch',
        ks3: 'A groove called a wave-cut notch is cut into the bottom of the cliff.',
        gcse: 'A wave-cut notch forms, undercutting the cliff.',
      },
      {
        at: 0.38,
        title: 'The overhang collapses',
        ks3: 'The rock above has nothing holding it up, so it falls into the sea.',
        gcse: 'The overhang becomes unstable and collapses (mass movement); the waves remove the debris.',
      },
      {
        at: 0.55,
        title: 'The cliff retreats',
        ks3: 'This happens again and again, so the cliff moves back inland.',
        gcse: 'The cycle of notching and collapse repeats and the cliff retreats inland.',
      },
      {
        at: 0.78,
        title: 'A wave-cut platform is left',
        ks3: 'A flat, rocky shelf is left in front of the cliff. You can see it at low tide.',
        gcse: 'A gently sloping wave-cut platform is left at the old cliff base, exposed at low tide. As it widens, waves lose energy crossing it and the retreat slows.',
      },
    ],
    examSteps: [
      'Waves erode the base of the cliff between high and low tide by hydraulic action and abrasion.',
      'A wave-cut notch forms, undercutting the cliff.',
      'The unsupported overhang collapses and the debris is removed by the sea.',
      'Repeated notching and collapse make the cliff retreat inland.',
      'The old cliff base is left as a gently sloping wave-cut platform, exposed at low tide.',
    ],
  },
  {
    id: 'caves-arches-stacks',
    title: 'Caves, arches and stacks',
    topic: 'coast',
    spec: '1.4a',
    landforms: ['caves', 'arches', 'stacks'],
    processes: ['hydraulic action', 'abrasion', 'weathering', 'mass movement'],
    source: 'diagram',
    view: 'Side view of a headland',
    durationS: 30,
    stages: [
      {
        at: 0,
        title: 'A crack in a headland',
        ks3: 'A headland has a weak crack in the rock.',
        gcse: 'A headland has a line of weakness: a joint or fault.',
      },
      {
        at: 0.15,
        title: 'The crack is widened',
        ks3: 'Waves force air into the crack and break the rock apart.',
        gcse: 'Hydraulic action compresses air in the joint; abrasion by rocks thrown by waves widens it.',
      },
      {
        at: 0.3,
        title: 'A cave',
        ks3: 'The crack grows into a cave.',
        gcse: 'The joint is enlarged into a cave.',
      },
      {
        at: 0.47,
        title: 'An arch',
        ks3: 'The cave is worn right through the headland, making an arch.',
        gcse: 'The cave erodes through the headland (or caves on both sides meet) to form an arch.',
      },
      {
        at: 0.65,
        title: 'The arch collapses',
        ks3: 'The roof of the arch gets thinner and falls in.',
        gcse: 'Erosion at the base and weathering of the roof weaken the arch until the roof collapses.',
      },
      {
        at: 0.75,
        title: 'A stack',
        ks3: 'A pillar of rock is left standing alone in the sea: a stack.',
        gcse: 'An isolated column of rock is left: a stack.',
      },
      {
        at: 0.88,
        title: 'A stump',
        ks3: 'The stack is worn down to a stump, covered at high tide.',
        gcse: 'The stack is undercut and collapses, leaving a stump exposed only at low tide.',
      },
    ],
    examSteps: [
      'Waves erode a joint or fault in a headland by hydraulic action and abrasion.',
      'The crack is widened into a cave.',
      'The cave is eroded through the headland to form an arch.',
      'The base of the arch is eroded and the roof is weakened by weathering until it collapses.',
      'An isolated stack is left, which is undercut and collapses to a stump.',
    ],
    lesson: 'cave-arch-stack',
  },
  {
    id: 'beaches',
    title: 'Beaches',
    topic: 'coast',
    spec: '1.4b',
    landforms: ['beaches'],
    processes: ['deposition', 'constructive waves', 'swash', 'backwash', 'longshore drift'],
    source: 'diagram',
    view: 'Cross-section (sea on the right)',
    durationS: 26,
    stages: [
      {
        at: 0,
        title: 'Sediment arrives',
        ks3: 'Sand and pebbles come from rivers, eroded cliffs and along the coast.',
        gcse: 'Sediment is supplied by rivers, cliff erosion and longshore drift.',
      },
      {
        at: 0.2,
        title: 'Constructive waves',
        ks3: 'Gentle waves push sand up the beach strongly and pull back only weakly.',
        gcse: 'Low, long constructive waves have a strong swash and a weak backwash, so they move more material up the beach than they take back.',
      },
      {
        at: 0.45,
        title: 'The beach builds up',
        ks3: 'Sand and pebbles pile up between high and low tide.',
        gcse: 'Deposition builds the beach up in the zone between low tide and the high tide line.',
      },
      {
        at: 0.68,
        title: 'Berms and sorting',
        ks3: 'Big pebbles end up at the top; fine sand is lower down.',
        gcse: 'Storm waves throw shingle to the back as a storm ridge and berms; the backwash drags finer sand lower down the beach.',
      },
      {
        at: 0.86,
        title: 'A beach',
        ks3: 'A beach is the zone of sand and pebbles along the coast.',
        gcse: 'A beach: a zone of deposited sand and shingle between the lowest tides and the highest storm waves.',
      },
    ],
    examSteps: [
      'Sediment is supplied by rivers, cliff erosion and longshore drift.',
      'Constructive waves have a stronger swash than backwash, so material is carried up the beach and left there.',
      'Deposition happens in sheltered, low-energy places such as bays.',
      'Shingle is thrown to the top by storm waves (storm ridge, berms); finer sand is left lower down.',
    ],
  },
  {
    id: 'spits',
    title: 'Spits',
    topic: 'coast',
    spec: '1.4b',
    landforms: ['spits'],
    processes: ['longshore drift', 'deposition', 'prevailing wind', 'swash', 'backwash'],
    source: 'diagram',
    view: 'Map view (sea at the bottom)',
    durationS: 30,
    stages: [
      {
        at: 0,
        title: 'Longshore drift',
        ks3: 'Waves come in at an angle (with the wind) and go back straight down the beach, so sand moves along the coast in a zigzag.',
        gcse: 'The prevailing wind drives swash up the beach at an angle; backwash returns at right angles under gravity, so sediment moves along the coast by longshore drift.',
      },
      {
        at: 0.2,
        title: 'The coast changes direction',
        ks3: 'Where the coast bends (at a river mouth), the sand keeps going out into the sea.',
        gcse: 'Where the coastline changes direction (at an estuary), longshore drift carries on and deposits sediment into the open water.',
      },
      {
        at: 0.38,
        title: 'The spit grows',
        ks3: 'The sand builds a long, thin ridge out into the sea: a spit.',
        gcse: 'Deposition extends a long, narrow ridge of sand and shingle — a spit — attached to the land at one end.',
      },
      {
        at: 0.6,
        title: 'The end curves round',
        ks3: 'Winds from a different direction curl the end of the spit round.',
        gcse: 'A change in wind and wave direction (secondary winds) curves the end: a recurved end, or hook. Several form as the spit grows.',
      },
      {
        at: 0.8,
        title: 'Saltmarsh behind',
        ks3: 'Behind the spit the water is calm, so mud settles and plants grow: a saltmarsh.',
        gcse: 'The sheltered, low-energy area behind the spit traps silt and mud, which plants colonise to form a saltmarsh. The river stops the spit from crossing the estuary.',
      },
    ],
    examSteps: [
      'The prevailing wind makes waves approach at an angle; swash goes up the beach at that angle and backwash returns at right angles.',
      'Sediment is moved along the coast by longshore drift.',
      'Where the coastline changes direction, deposition continues into the sea, building a spit.',
      'Changes in wind and wave direction curve the end into a recurved hook.',
      'Behind the spit, sheltered water allows mud to settle and a saltmarsh to form; the river current stops the spit crossing the estuary.',
    ],
    lesson: 'spit',
  },
  {
    id: 'bars',
    title: 'Bars',
    topic: 'coast',
    spec: '1.4b',
    landforms: ['bars'],
    processes: ['longshore drift', 'deposition'],
    source: 'diagram',
    view: 'Map view (sea at the bottom)',
    durationS: 24,
    stages: [
      {
        at: 0,
        title: 'A bay between two headlands',
        ks3: 'A bay is open to the sea, with no river strong enough to keep it open.',
        gcse: 'A bay with no large river flowing into it.',
      },
      {
        at: 0.2,
        title: 'A spit grows across the bay',
        ks3: 'Longshore drift builds a spit out across the bay.',
        gcse: 'Longshore drift builds a spit from one headland across the mouth of the bay.',
      },
      {
        at: 0.55,
        title: 'The spit joins the other side',
        ks3: 'The spit reaches the other headland: it is now a bar.',
        gcse: 'With no river current to stop it, deposition continues until the spit joins the other headland, forming a bar.',
      },
      {
        at: 0.75,
        title: 'A lagoon is trapped',
        ks3: 'The water behind the bar becomes a lagoon. It slowly fills with mud and plants.',
        gcse: 'A lagoon is trapped behind the bar; over time it fills with sediment and becomes marsh.',
      },
    ],
    examSteps: [
      'Longshore drift moves sediment along the coast.',
      'A spit grows across the mouth of a bay.',
      'If no river current stops it, the spit joins the other side of the bay, forming a bar.',
      'The water behind is trapped as a lagoon, which slowly fills with sediment.',
    ],
    lesson: 'bar-lagoon',
  },
  // ---------------------------------------------------------------- rivers (1.8)
  {
    id: 'interlocking-spurs',
    title: 'Interlocking spurs',
    topic: 'river',
    spec: '1.8a',
    landforms: ['interlocking spurs'],
    processes: ['vertical erosion', 'hydraulic action', 'abrasion', 'weathering'],
    source: 'diagram',
    view: 'Map view of the upper course, with a cross-section',
    durationS: 24,
    stages: [
      {
        at: 0,
        title: 'The upper course',
        ks3: 'High in the hills, a small river flows quickly down a steep slope.',
        gcse: 'In the upper course the gradient is steep and the river has energy to erode downwards (vertical erosion).',
      },
      {
        at: 0.22,
        title: 'Vertical erosion: a V-shaped valley',
        ks3: 'The river cuts down into the rock; the sides are worn back by weathering, making a V shape.',
        gcse: 'Abrasion and hydraulic action deepen the channel; weathering and mass movement lower the valley sides into a V-shaped valley.',
      },
      {
        at: 0.5,
        title: 'The river winds round hard rock',
        ks3: 'The river cannot easily cut through hard ridges, so it bends round them.',
        gcse: 'The river has little lateral erosion here, so it winds around areas of more resistant rock instead of eroding through them.',
      },
      {
        at: 0.75,
        title: 'Interlocking spurs',
        ks3: 'Ridges of land stick out from each side and fit together like the teeth of a zip.',
        gcse: 'Interlocking spurs: ridges that project alternately from each side of the valley, overlapping when seen looking up or down the valley.',
      },
    ],
    examSteps: [
      'In the upper course, the river erodes mainly vertically by abrasion and hydraulic action, forming a V-shaped valley.',
      'The river lacks the energy to erode laterally through resistant rock.',
      'It winds around the areas of resistant rock.',
      'Spurs of land project alternately from each side and interlock.',
    ],
    lesson: 'v-valley-spurs',
  },
  {
    id: 'waterfalls-gorges',
    title: 'Waterfalls and gorges',
    topic: 'river',
    spec: '1.8a',
    landforms: ['waterfalls', 'gorges'],
    processes: ['hydraulic action', 'abrasion', 'undercutting', 'mass movement'],
    source: 'model',
    view: 'Long profile (river flows to the right)',
    durationS: 30,
    stages: [
      {
        at: 0,
        title: 'Hard rock over soft rock',
        ks3: 'The river flows over a band of hard rock lying on top of softer rock.',
        gcse: 'A band of resistant rock overlies less resistant rock.',
      },
      {
        at: 0.12,
        title: 'Undercutting',
        ks3: 'The soft rock is worn away faster, so the hard rock sticks out as an overhang.',
        gcse: 'The less resistant rock is eroded faster by hydraulic action and abrasion, undercutting the resistant rock to leave an overhang.',
      },
      {
        at: 0.32,
        title: 'The overhang collapses',
        ks3: 'The overhang breaks off and falls into the pool below.',
        gcse: 'The unsupported overhang collapses; the fallen blocks are swirled round and deepen the plunge pool by abrasion.',
      },
      {
        at: 0.5,
        title: 'The plunge pool deepens',
        ks3: 'The falling water and swirling rocks dig a deep pool at the bottom.',
        gcse: 'Hydraulic action and abrasion deepen the plunge pool at the foot of the fall.',
      },
      {
        at: 0.68,
        title: 'The waterfall retreats',
        ks3: 'Each collapse moves the waterfall a little further back upstream.',
        gcse: 'Repeated undercutting and collapse make the waterfall retreat upstream.',
      },
      {
        at: 0.85,
        title: 'A gorge is left',
        ks3: 'A narrow, steep-sided valley called a gorge is left where the waterfall used to be.',
        gcse: 'A steep-sided gorge is left downstream as the waterfall retreats.',
      },
    ],
    examSteps: [
      'A band of resistant rock lies over less resistant rock.',
      'The less resistant rock is eroded faster by hydraulic action and abrasion, undercutting the resistant rock.',
      'An overhang forms, becomes unsupported and collapses.',
      'The fallen rocks deepen the plunge pool by abrasion.',
      'Repeated collapse makes the waterfall retreat upstream, leaving a steep-sided gorge.',
    ],
    lesson: 'waterfall',
    modelLesson: 'waterfall-gorge-model',
  },
  {
    id: 'meanders-cliffs-bars',
    title: 'Meanders, river cliffs and point bars',
    topic: 'river',
    spec: '1.8a, 1.8b, 1.8c',
    landforms: ['meanders', 'river cliffs', 'point bars'],
    processes: ['lateral erosion', 'hydraulic action', 'abrasion', 'deposition', 'thalweg'],
    source: 'model',
    view: 'Map view, with a cross-section of a bend',
    durationS: 28,
    stages: [
      {
        at: 0,
        title: 'A river on a gentle slope',
        ks3: 'In the middle and lower course the river swings from side to side.',
        gcse: 'In the middle and lower course, lateral erosion becomes more important than vertical erosion.',
      },
      {
        at: 0.2,
        title: 'Fastest flow on the outside of bends',
        ks3: 'Water flows fastest round the outside of each bend and slowest on the inside.',
        gcse: 'The line of fastest flow (the thalweg) swings to the outside of each bend; flow is slowest on the inside.',
      },
      {
        at: 0.4,
        title: 'Erosion on the outside: a river cliff',
        ks3: 'The fast water wears away the outside bank, making a steep river cliff.',
        gcse: 'Hydraulic action and abrasion erode the outer bank, undercutting it to form a steep river cliff.',
      },
      {
        at: 0.6,
        title: 'Deposition on the inside: a point bar',
        ks3: 'The slow water on the inside drops sand and gravel, building a gentle point bar.',
        gcse: 'Slower flow on the inner bank deposits sediment as a point bar (slip-off slope).',
      },
      {
        at: 0.8,
        title: 'The meanders grow',
        ks3: 'The bends get bigger and move across the valley.',
        gcse: 'Erosion on the outside and deposition on the inside make the meanders grow and migrate across the flood plain.',
      },
    ],
    examSteps: [
      'The fastest flow (thalweg) is on the outside of a bend; flow is slowest on the inside.',
      'The outer bank is eroded by hydraulic action and abrasion, forming a river cliff.',
      'Sediment is deposited on the inner bank where flow is slow, forming a point bar.',
      'Continued erosion and deposition make the meander grow and migrate; the channel cross-section is asymmetric.',
    ],
    lesson: 'meander',
    modelLesson: 'meanders-floodplain-model',
  },
  {
    id: 'oxbow-lakes',
    title: 'Oxbow lakes',
    topic: 'river',
    spec: '1.8c',
    landforms: ['oxbow lakes', 'meanders'],
    processes: ['lateral erosion', 'deposition', 'flooding'],
    source: 'model',
    view: 'Map view',
    durationS: 28,
    stages: [
      {
        at: 0,
        title: 'A tight meander',
        ks3: 'A bend in the river has grown into a big loop.',
        gcse: 'Erosion on the outside of two bends narrows the neck of a meander.',
      },
      {
        at: 0.3,
        title: 'The neck narrows',
        ks3: 'The two sides of the loop get closer together.',
        gcse: 'Lateral erosion on both outer banks moves them towards each other, narrowing the neck.',
      },
      {
        at: 0.5,
        title: 'The river cuts through',
        ks3: 'In a flood the river breaks through the neck and takes the short cut.',
        gcse: 'During a flood the river cuts through the neck and follows the shorter, steeper course.',
      },
      {
        at: 0.68,
        title: 'Deposition seals the loop',
        ks3: 'Mud is dropped at the ends of the old loop, cutting it off.',
        gcse: 'Deposition seals off the old meander loop from the new channel.',
      },
      {
        at: 0.82,
        title: 'An oxbow lake',
        ks3: 'The old loop becomes a curved lake: an oxbow lake. Later it may dry up.',
        gcse: 'The cut-off loop is an oxbow lake, which may later fill with sediment to become a meander scar.',
      },
    ],
    examSteps: [
      'Erosion on the outer banks of a meander narrows its neck.',
      'During a flood the river cuts through the neck, taking the shortest route.',
      'Deposition seals the ends of the old channel.',
      'The cut-off loop becomes an oxbow lake, which may dry out to a meander scar.',
    ],
    lesson: 'meander',
    modelLesson: 'meanders-floodplain-model',
  },
  {
    id: 'floodplains-levees',
    title: 'Flood plains and levees',
    topic: 'river',
    spec: '1.8b',
    landforms: ['flood plains', 'levees'],
    processes: ['deposition', 'flooding', 'lateral erosion'],
    source: 'diagram',
    view: 'Cross-section across the valley',
    durationS: 28,
    stages: [
      {
        at: 0,
        title: 'A river in its lower course',
        ks3: 'The river flows through a wide, flat valley.',
        gcse: 'In the lower course the valley is wide and flat; meanders migrating across it widen it by lateral erosion.',
      },
      {
        at: 0.18,
        title: 'The river floods',
        ks3: 'In a flood the river spills over its banks.',
        gcse: 'When discharge exceeds bankfull, water spreads over the valley floor.',
      },
      {
        at: 0.35,
        title: 'Heavy sediment is dropped first',
        ks3: 'As the water leaves the river it slows down and drops its biggest grains close to the banks.',
        gcse: 'Friction slows the water as it leaves the channel; the coarsest sediment is deposited first, next to the banks.',
      },
      {
        at: 0.55,
        title: 'Fine silt spreads further',
        ks3: 'Fine mud is carried further and settles over the flat land.',
        gcse: 'Finer silt and clay (alluvium) settle further away, across the flood plain.',
      },
      {
        at: 0.72,
        title: 'Levees and a flood plain build up',
        ks3: 'Flood after flood, raised banks called levees grow beside the river, and the flat flood plain is built up.',
        gcse: 'Repeated floods build natural levees beside the channel and a thick, flat flood plain of alluvium.',
      },
    ],
    examSteps: [
      'Meanders migrating across the valley widen it by lateral erosion.',
      'When the river floods, water spreads over the valley floor and loses velocity.',
      'The coarsest sediment is deposited first, next to the channel; finer silt is carried further.',
      'Repeated floods build natural levees beside the river and a flat flood plain of alluvium.',
    ],
    modelLesson: 'meanders-floodplain-model',
  },
  // ---------------------------------------------------------------- glaciated uplands (1.12)
  {
    id: 'corries-aretes',
    title: 'Corries, tarns and arêtes',
    topic: 'glacial',
    spec: '1.12a',
    landforms: ['corries', 'glacial lake/tarns', 'arêtes'],
    processes: ['plucking', 'abrasion', 'freeze-thaw', 'rotational movement'],
    source: 'model',
    view: 'Cross-section through a mountain ridge',
    durationS: 30,
    stages: [
      {
        at: 0,
        title: 'Snow collects in hollows',
        ks3: 'Snow builds up in hollows on shady mountain sides.',
        gcse: 'Snow accumulates in hollows, especially on north- and east-facing slopes in the UK.',
      },
      {
        at: 0.15,
        title: 'Snow turns to ice',
        ks3: 'The snow is squashed into ice: a small glacier.',
        gcse: 'Snow is compressed into firn and then glacier ice, forming a corrie glacier.',
      },
      {
        at: 0.3,
        title: 'Plucking and abrasion',
        ks3: 'The ice pulls rocks out of the back wall and scrapes the floor deeper.',
        gcse: 'Plucking and freeze-thaw steepen the back wall; rotational movement makes abrasion deepen the hollow floor.',
      },
      {
        at: 0.5,
        title: 'Corries grow back into the ridge',
        ks3: 'The hollows get deeper and bite back into the mountain.',
        gcse: 'The corries are enlarged into armchair-shaped hollows and cut back into the ridge.',
      },
      {
        at: 0.7,
        title: 'An arête',
        ks3: 'Two corries back to back leave a knife-edge ridge: an arête.',
        gcse: 'Where two corries erode back to back, a narrow, knife-edged ridge is left: an arête.',
      },
      {
        at: 0.85,
        title: 'The ice melts: tarns',
        ks3: 'When the ice melts, a small lake fills each hollow: a tarn.',
        gcse: 'When the ice melts, meltwater collects behind the rock lip to form a tarn (corrie lake).',
      },
    ],
    examSteps: [
      'Snow accumulates in a north-facing hollow and is compressed into ice.',
      'Plucking and freeze-thaw steepen the back wall.',
      'Rotational movement and abrasion deepen the floor; less erosion at the front leaves a rock lip.',
      'Two corries eroding back to back leave a knife-edged arête.',
      'When the ice melts, a tarn forms behind the rock lip.',
    ],
    lesson: 'corrie-arete',
  },
  {
    id: 'troughs-spurs-hanging',
    title: 'Glacial troughs, truncated spurs and hanging valleys',
    topic: 'glacial',
    spec: '1.12a',
    landforms: ['glacial troughs', 'truncated spurs', 'hanging valleys', 'glacial lake/tarns'],
    processes: ['abrasion', 'plucking', 'freeze-thaw'],
    source: 'model',
    view: 'Cross-section of the valley, with a map view',
    durationS: 32,
    stages: [
      {
        at: 0,
        title: 'A V-shaped river valley',
        ks3: 'Before the ice age, a river flowed in a V-shaped valley with interlocking spurs.',
        gcse: 'A V-shaped river valley with interlocking spurs, before glaciation.',
      },
      {
        at: 0.18,
        title: 'A glacier fills the valley',
        ks3: 'A huge glacier moves down the valley.',
        gcse: 'A valley glacier fills the valley, far deeper and more powerful than the river.',
      },
      {
        at: 0.35,
        title: 'Abrasion and plucking',
        ks3: 'The ice scrapes and pulls at the sides and floor, making the valley deeper and wider.',
        gcse: 'Abrasion and plucking deepen, widen and straighten the valley.',
      },
      {
        at: 0.52,
        title: 'Truncated spurs',
        ks3: 'The ends of the spurs are sliced off, leaving steep cliffs.',
        gcse: 'The glacier cannot flow round the spurs, so it cuts off their ends, leaving truncated spurs.',
      },
      {
        at: 0.7,
        title: 'A U-shaped glacial trough',
        ks3: 'When the ice melts, the valley is U-shaped with a flat floor and steep sides.',
        gcse: 'After the ice melts, a U-shaped glacial trough is left, with a flat floor, steep sides and a small misfit river.',
      },
      {
        at: 0.84,
        title: 'Hanging valleys and ribbon lakes',
        ks3: 'Small side valleys are left high up, with waterfalls. Deep hollows in the floor fill with long lakes.',
        gcse: 'Tributary glaciers eroded less deeply, leaving hanging valleys with waterfalls; over-deepened parts of the floor hold ribbon lakes.',
      },
    ],
    examSteps: [
      'A glacier occupies a V-shaped river valley.',
      'Abrasion and plucking deepen, widen and straighten the valley.',
      'The ends of interlocking spurs are cut off, forming truncated spurs.',
      'When the ice melts, a flat-floored, steep-sided U-shaped trough is left.',
      'Smaller tributary glaciers eroded less, leaving hanging valleys with waterfalls; over-deepened hollows fill with ribbon lakes.',
    ],
    lesson: 'glacial-trough',
  },
  {
    id: 'roche-moutonnee',
    title: 'Roches moutonnées',
    topic: 'glacial',
    spec: '1.12a',
    landforms: ['roche moutonnées'],
    processes: ['abrasion', 'plucking', 'pressure melting'],
    source: 'diagram',
    view: 'Side view (ice flows to the right)',
    durationS: 24,
    stages: [
      {
        at: 0,
        title: 'Ice flows over a rock outcrop',
        ks3: 'A glacier slides over a lump of hard rock.',
        gcse: 'A glacier moves over an outcrop of resistant rock.',
      },
      {
        at: 0.22,
        title: 'Abrasion on the up-ice side',
        ks3: 'Rocks stuck in the ice scrape the side facing the ice smooth.',
        gcse: 'On the up-ice (stoss) side, pressure is high and abrasion smooths and scratches (striates) the rock.',
      },
      {
        at: 0.48,
        title: 'Plucking on the down-ice side',
        ks3: 'On the other side, ice freezes onto the rock and pulls chunks away.',
        gcse: 'On the down-ice (lee) side, meltwater refreezes onto the rock and plucking tears blocks away, making it steep and jagged.',
      },
      {
        at: 0.75,
        title: 'A roche moutonnée',
        ks3: 'When the ice melts, the rock is smooth on one side and jagged on the other.',
        gcse: 'A roche moutonnée is left: gently sloping and smooth on the stoss side, steep and jagged on the lee side.',
      },
    ],
    examSteps: [
      'A glacier moves over a resistant rock outcrop.',
      'On the up-ice (stoss) side, abrasion smooths and striates the rock.',
      'On the down-ice (lee) side, meltwater refreezes and plucking removes blocks.',
      'The result is a roche moutonnée: smooth and gentle up-ice, steep and jagged down-ice.',
    ],
  },
  {
    id: 'moraines',
    title: 'Ground and terminal moraines',
    topic: 'glacial',
    spec: '1.12b',
    landforms: ['ground moraines', 'terminal moraines'],
    processes: ['transport', 'deposition', 'freeze-thaw', 'plucking'],
    source: 'diagram',
    view: 'Long profile down the valley (ice flows to the right)',
    durationS: 28,
    stages: [
      {
        at: 0,
        title: 'The glacier carries rock debris',
        ks3: 'Rocks fall onto the ice and are carried along on it, inside it and under it.',
        gcse: 'Debris from freeze-thaw, rockfall and plucking is transported on, within and beneath the ice.',
      },
      {
        at: 0.22,
        title: 'Ground moraine under the ice',
        ks3: 'Rock and clay are dropped under the moving ice as an uneven layer.',
        gcse: 'Material is deposited beneath the moving ice as an uneven sheet of till: ground moraine.',
      },
      {
        at: 0.45,
        title: 'The snout stays in one place',
        ks3: 'At the end (snout) the ice melts as fast as it moves forward, so it stays still and dumps its load.',
        gcse: 'At its furthest advance the snout is stationary: debris carried forward is dumped (and bulldozed) at the snout.',
      },
      {
        at: 0.62,
        title: 'A terminal moraine ridge',
        ks3: 'A ridge of rocks and clay builds up across the valley.',
        gcse: 'A ridge of unsorted till — a terminal moraine — builds across the valley at the maximum extent of the ice.',
      },
      {
        at: 0.8,
        title: 'The ice melts back',
        ks3: 'When the ice melts, the ridge shows how far the glacier reached; the valley floor is covered in moraine.',
        gcse: 'As the glacier retreats, the terminal moraine marks its furthest advance and ground moraine covers the floor; meltwater may be dammed behind the ridge.',
      },
    ],
    examSteps: [
      'Debris is transported on, within and beneath the glacier.',
      'Beneath moving ice, till is deposited as an uneven sheet of ground moraine.',
      'At the snout, at the glacier’s maximum extent, debris is dumped and bulldozed.',
      'This forms a ridge of unsorted till across the valley: a terminal moraine.',
    ],
  },
  {
    id: 'crag-tail',
    title: 'Crag and tail',
    topic: 'glacial',
    spec: '1.12c',
    landforms: ['crag and tail'],
    processes: ['abrasion', 'plucking', 'deposition'],
    source: 'diagram',
    view: 'Side view (ice flows to the right)',
    durationS: 24,
    stages: [
      {
        at: 0,
        title: 'A hard crag in softer rock',
        ks3: 'A mass of very hard rock (often old volcanic rock) sits in softer rock.',
        gcse: 'A resistant mass of rock — often a volcanic plug — is surrounded by less resistant rock.',
      },
      {
        at: 0.2,
        title: 'Ice erodes the soft rock',
        ks3: 'The glacier wears away the soft rock all around.',
        gcse: 'The ice erodes the less resistant rock around the crag by abrasion and plucking.',
      },
      {
        at: 0.45,
        title: 'The crag shelters the rock behind it',
        ks3: 'The hard crag protects the soft rock behind it, and the ice drops material there.',
        gcse: 'The crag shields the less resistant rock on its lee side, and till is deposited in its shelter.',
      },
      {
        at: 0.7,
        title: 'Crag and tail',
        ks3: 'A steep crag is left with a long, gentle tail behind it — like Edinburgh Castle Rock and the Royal Mile.',
        gcse: 'A crag and tail: a steep resistant crag with a gently sloping tail of protected rock and till on the down-ice side (e.g. Edinburgh).',
      },
    ],
    examSteps: [
      'A resistant crag (e.g. a volcanic plug) lies in less resistant rock.',
      'Ice erodes the less resistant rock around it.',
      'The crag protects the rock on its lee side, where till is also deposited.',
      'A steep crag with a gently sloping tail pointing down-ice is left.',
    ],
  },
  {
    id: 'drumlins',
    title: 'Drumlins',
    topic: 'glacial',
    spec: '1.12c',
    landforms: ['drumlins'],
    processes: ['deposition', 'moulding by ice', 'transport'],
    source: 'diagram',
    view: 'Side view, with a map of a drumlin field',
    durationS: 24,
    stages: [
      {
        at: 0,
        title: 'Ice carries lots of till',
        ks3: 'A glacier is carrying a heavy load of clay and rocks (till).',
        gcse: 'A glacier is overloaded with till, often where it spreads out on a lowland.',
      },
      {
        at: 0.22,
        title: 'Till is dropped',
        ks3: 'Friction with the ground (or a small obstacle) makes the ice drop some of its load.',
        gcse: 'Friction with the bed, or an obstacle, causes till to be deposited beneath the ice.',
      },
      {
        at: 0.45,
        title: 'The moving ice shapes it',
        ks3: 'The moving ice smooths the pile into a streamlined hill.',
        gcse: 'The moving ice moulds the till into a streamlined shape.',
      },
      {
        at: 0.7,
        title: 'Drumlins',
        ks3: 'Drumlins are egg-shaped hills: steep at the end facing the ice, tapering in the direction it moved. They come in groups like a basket of eggs.',
        gcse: 'A drumlin: an elongated hill of till with a blunt stoss end facing up-ice and a tapered lee end pointing down-ice; they occur in swarms ("basket of eggs") that show the direction of ice movement.',
      },
    ],
    examSteps: [
      'A glacier carries a large load of till.',
      'Friction with the bed or an obstacle causes till to be deposited.',
      'The moving ice moulds the till into a streamlined mound.',
      'A drumlin has a steep, blunt up-ice end and a gentle, tapered down-ice end, showing the direction of ice flow.',
    ],
  },
];

export const formationById = (id: string) => FORMATIONS.find((f) => f.id === id);

/** Every landform the specification lists for Topic 1 (1.4a/b, 1.8a/b/c, 1.12a/b/c). */
export const SPEC_LANDFORMS: Record<LandformTopic, string[]> = {
  coast: ['headlands', 'bays', 'caves', 'arches', 'cliffs', 'stacks', 'wave cut platforms', 'bars', 'beaches', 'spits'],
  river: ['interlocking spurs', 'waterfalls', 'gorges', 'river cliffs', 'flood plains', 'levees', 'point bars', 'meanders', 'oxbow lakes'],
  glacial: [
    'truncated spurs',
    'corries',
    'glacial troughs',
    'glacial lake/tarns',
    'arêtes',
    'hanging valleys',
    'roche moutonnées',
    'ground moraines',
    'terminal moraines',
    'crag and tail',
    'drumlins',
  ],
};

/**
 * Approximate time each formation takes in reality, shown as a time-lapse clock. Keyframes map the
 * timeline (0 … 1) to years; real rates vary a lot with rock type, climate and wave/river energy.
 */
export const TIMESCALES: Record<string, { clock: [number, number][]; note: string }> = {
  'headlands-bays': {
    clock: [
      [0, 0],
      [1, 8000],
    ],
    note: 'since sea level rose after the last ice age',
  },
  'cliffs-platforms': {
    clock: [
      [0, 0],
      [1, 2000],
    ],
    note: 'chalk cliffs retreat roughly 0.1–1 m a year',
  },
  'caves-arches-stacks': {
    clock: [
      [0, 0],
      [1, 6000],
    ],
    note: 'arches can collapse in a single storm after centuries of erosion',
  },
  beaches: {
    clock: [
      [0, 0],
      [1, 20],
    ],
    note: 'beaches change with every storm and season',
  },
  spits: {
    clock: [
      [0, 0],
      [1, 300],
    ],
    note: 'e.g. Spurn Head re-forms over a few centuries',
  },
  bars: {
    clock: [
      [0, 0],
      [1, 1000],
    ],
    note: 'e.g. Slapton Ley formed a few thousand years ago',
  },
  'interlocking-spurs': {
    clock: [
      [0, 0],
      [1, 100000],
    ],
    note: 'upland valleys are cut over hundreds of thousands of years',
  },
  'waterfalls-gorges': {
    clock: [
      [0, 0],
      [0.05, 0],
      [0.32, 33],
      [0.5, 60],
      [0.95, 300],
      [1, 300],
    ],
    note: 'model rates; Niagara Falls retreated about 1 m a year before water was diverted for power (now far less)',
  },
  'meanders-cliffs-bars': {
    clock: [
      [0, 0],
      [1, 200],
    ],
    note: 'active meanders can move metres a year',
  },
  'oxbow-lakes': {
    clock: [
      [0, 0],
      [1, 150],
    ],
    note: 'necks are often cut through in a single flood',
  },
  'floodplains-levees': {
    clock: [
      [0, 0],
      [1, 1000],
    ],
    note: 'five floods shown; real flood plains build up over hundreds of floods',
  },
  'corries-aretes': {
    clock: [
      [0, 0],
      [1, 50000],
    ],
    note: 'UK corries were cut over several glacial periods',
  },
  'troughs-spurs-hanging': {
    clock: [
      [0, 0],
      [1, 100000],
    ],
    note: 'carved during the ice ages, the last ending 11,700 years ago',
  },
  'roche-moutonnee': {
    clock: [
      [0, 0],
      [1, 10000],
    ],
    note: 'during one glacial period',
  },
  moraines: {
    clock: [
      [0, 0],
      [1, 3000],
    ],
    note: 'a terminal moraine marks where the snout stayed for decades to centuries',
  },
  'crag-tail': {
    clock: [
      [0, 0],
      [1, 20000],
    ],
    note: 'shaped by ice sheets in the last glacial period',
  },
  drumlins: {
    clock: [
      [0, 0],
      [1, 5000],
    ],
    note: 'formed beneath ice sheets in the last glacial period',
  },
};

/** Years at timeline position t (piecewise linear through the keyframes). */
export function yearsAt(id: string, t: number): number {
  const k = TIMESCALES[id]?.clock ?? [
    [0, 0],
    [1, 0],
  ];
  if (t <= k[0][0]) return k[0][1];
  for (let i = 1; i < k.length; i++) if (t <= k[i][0]) return k[i - 1][1] + ((t - k[i - 1][0]) / (k[i][0] - k[i - 1][0] || 1)) * (k[i][1] - k[i - 1][1]);
  return k[k.length - 1][1];
}

/** Processes at work in each stage (highlighted while that stage plays). Same order as the stages. */
export const ACTIVE: Record<string, string[][]> = {
  'headlands-bays': [
    [],
    ['hydraulic action', 'abrasion', 'differential erosion'],
    ['hydraulic action', 'abrasion', 'differential erosion'],
    ['differential erosion'],
    ['wave refraction', 'deposition'],
  ],
  'cliffs-platforms': [
    ['hydraulic action', 'abrasion'],
    ['hydraulic action', 'abrasion'],
    ['mass movement'],
    ['hydraulic action', 'abrasion', 'mass movement'],
    ['weathering'],
  ],
  'caves-arches-stacks': [
    [],
    ['hydraulic action', 'abrasion'],
    ['hydraulic action', 'abrasion'],
    ['hydraulic action', 'abrasion'],
    ['weathering', 'mass movement'],
    ['hydraulic action', 'abrasion'],
    ['mass movement'],
  ],
  beaches: [['longshore drift'], ['constructive waves', 'swash', 'backwash'], ['deposition', 'swash'], ['deposition', 'backwash'], ['deposition']],
  spits: [
    ['longshore drift', 'swash', 'backwash', 'prevailing wind'],
    ['longshore drift', 'deposition'],
    ['deposition', 'longshore drift'],
    ['deposition', 'prevailing wind'],
    ['deposition'],
  ],
  bars: [[], ['longshore drift', 'deposition'], ['deposition'], ['deposition']],
  'interlocking-spurs': [[], ['vertical erosion', 'hydraulic action', 'abrasion', 'weathering'], ['vertical erosion'], ['vertical erosion', 'weathering']],
  'waterfalls-gorges': [
    [],
    ['hydraulic action', 'abrasion', 'undercutting'],
    ['mass movement'],
    ['hydraulic action', 'abrasion'],
    ['undercutting', 'mass movement'],
    ['hydraulic action', 'abrasion'],
  ],
  'meanders-cliffs-bars': [
    ['lateral erosion'],
    ['thalweg'],
    ['lateral erosion', 'hydraulic action', 'abrasion'],
    ['deposition'],
    ['lateral erosion', 'deposition'],
  ],
  'oxbow-lakes': [['lateral erosion'], ['lateral erosion'], ['flooding'], ['deposition'], ['deposition']],
  'floodplains-levees': [['lateral erosion'], ['flooding'], ['deposition', 'flooding'], ['deposition'], ['deposition', 'flooding']],
  'corries-aretes': [
    [],
    [],
    ['plucking', 'abrasion', 'freeze-thaw', 'rotational movement'],
    ['plucking', 'abrasion', 'freeze-thaw'],
    ['plucking', 'freeze-thaw'],
    [],
  ],
  'troughs-spurs-hanging': [[], [], ['abrasion', 'plucking'], ['abrasion', 'plucking'], ['freeze-thaw'], []],
  'roche-moutonnee': [[], ['abrasion'], ['plucking', 'pressure melting'], []],
  moraines: [['transport', 'freeze-thaw', 'plucking'], ['deposition'], ['deposition', 'transport'], ['deposition'], ['deposition']],
  'crag-tail': [[], ['abrasion', 'plucking'], ['deposition'], []],
  drumlins: [['transport'], ['deposition'], ['moulding by ice'], []],
};

/** What each process is (GCSE level). Every process named in a formation is defined here. */
export const GLOSSARY: Record<string, string> = {
  'hydraulic action':
    'The force of moving water against rock. Waves (or a river) force water and air into cracks; the compressed air pushes the crack apart, and when the water pulls back the sudden release weakens the rock further.',
  abrasion: 'Rock fragments carried by water or ice are thrown, scraped or dragged against rock, wearing it away like sandpaper.',
  attrition: 'Rocks carried by water knock against each other, becoming smaller, smoother and rounder.',
  solution: 'Weak acids in water dissolve some rocks, such as chalk and limestone, and carry them away invisibly.',
  weathering:
    'The breakdown of rock where it is: mechanical (e.g. freeze-thaw), chemical (e.g. rainwater dissolving limestone) or biological (roots and burrowing animals).',
  'freeze-thaw': 'Water in a crack freezes and expands by about 9%, widening the crack. Repeated freezing and thawing breaks pieces off.',
  'mass movement': 'Rock and soil moving downslope under gravity: sliding, slumping or rockfall.',
  'differential erosion': 'Rocks of different resistance are eroded at different rates, so soft rock is worn back and hard rock stands out.',
  'wave refraction':
    'Waves slow down and bend as they reach shallower water off a headland, so their energy is concentrated on the headland and spread out in the bays.',
  deposition: 'Sediment is dropped when the water, wind or ice carrying it loses energy (slows down).',
  'constructive waves': 'Low, long waves (6–8 a minute) with a strong swash and weak backwash. They carry more material up the beach than they take away.',
  swash: 'The rush of water up the beach after a wave breaks.',
  backwash: 'The water flowing back down the beach under gravity, at right angles to the coast.',
  'longshore drift':
    'The zigzag movement of sediment along the coast: swash carries it up the beach at the angle the waves arrive; backwash returns it straight down.',
  'prevailing wind': 'The direction the wind usually blows from — south-westerly in most of the UK. It sets the direction waves arrive from.',
  'vertical erosion': 'Downward erosion of the river bed, deepening the channel. Most important in the steep upper course.',
  'lateral erosion': 'Sideways erosion of the river banks, widening the channel and valley. Most important in the middle and lower course.',
  undercutting: 'Erosion at the base of a cliff, bank or rock band, leaving the rock above unsupported.',
  thalweg: 'The line of fastest flow along a river. It swings towards the outside of each bend.',
  flooding: 'Water spills over the banks when the river carries more water than its channel can hold (bankfull discharge).',
  plucking: 'Meltwater freezes onto cracked rock under the glacier; as the ice moves it pulls (plucks) blocks of rock away.',
  'rotational movement': 'Ice in a corrie moves in a curved, circular path (like an armchair rocking back) that deepens the hollow floor.',
  'pressure melting':
    'Pressure under a glacier lowers the melting point of ice, so meltwater forms at the base; it can refreeze into cracks on the lee side of obstacles.',
  transport: 'Moving eroded material. Rivers: traction, saltation, suspension, solution. Glaciers: on, within and under the ice.',
  'moulding by ice': 'Moving ice shapes and streamlines the till beneath it.',
};
