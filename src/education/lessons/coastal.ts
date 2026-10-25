import type { Lesson } from '../types';

/** Guided lesson: cave → arch → stack → stump on a chalk headland (spec G3 example). */
export const caveArchStack: Lesson = {
  id: 'cave-arch-stack',
  module: 'coasts',
  title: 'Caves, arches, stacks and stumps',
  kind: 'guided',
  guided: 'arch',
  objective: 'Explain how erosion of a headland along a line of weakness forms a cave, then an arch, a stack and a stump.',
  stages: [
    {
      title: 'A headland with a weakness',
      ks3: 'A headland of hard rock (here chalk) sticks out into the sea. A crack in the rock, called a joint, runs across it — a weak line the sea can attack.',
      gcse: 'Headlands of resistant rock are attacked from both sides as waves refract around them. Joints and faults are lines of weakness exploited by erosion.',
      t: 0,
    },
    {
      title: 'A cave forms',
      ks3: 'Waves smash into the joint at sea level. Air and water forced into the crack, and stones thrown by the waves, widen it into a cave.',
      gcse: 'Hydraulic action (compressed air in the joint) and abrasion enlarge the joint at the wave-attack zone into a cave.',
      predict: 'What happens if caves form on both sides of the headland?',
      t: 1,
    },
    {
      title: 'An arch',
      ks3: 'The caves on each side meet, and the sea can now pass right through the headland under a bridge of rock: an arch (like Durdle Door).',
      gcse: 'Continued erosion breaks through the headland, forming an arch. Weathering and erosion continue to attack the arch roof and its base.',
      t: 2,
    },
    {
      title: 'A stack',
      ks3: 'The roof of the arch gets thinner until it falls in, leaving a tall pillar of rock standing on its own: a stack (like Old Harry).',
      gcse: 'The arch widens and its roof is weakened by sub-aerial weathering until it collapses, leaving an isolated stack.',
      t: 3,
    },
    {
      title: 'A stump',
      ks3: 'Waves wear away the bottom of the stack until it topples, leaving a low stump that is covered at high tide.',
      gcse: 'Wave-cut notching at the base of the stack causes it to collapse, leaving a stump exposed at low tide.',
      t: 4,
    },
  ],
  exam: {
    question: 'Explain the formation of a stack. (4 marks)',
    marks: 4,
    model:
      'Waves erode a line of weakness (a joint) in a headland by hydraulic action and abrasion, forming a cave (1). The cave is enlarged until it breaks through the headland, forming an arch (1). The arch roof is weakened by erosion at its base and weathering from above (1), until it collapses, leaving an isolated column of rock — a stack (1).',
  },
  misconception: {
    wrong: 'Arches form because the sea erodes the top of the headland.',
    right: 'Erosion works at sea level, along joints; the roof of the arch falls because it loses support from below and is weathered from above.',
  },
};

/** Guided lesson: longshore drift builds a spit (one-line shoreline model). */
export const spit: Lesson = {
  id: 'spit',
  module: 'coasts',
  title: 'Longshore drift and spits',
  kind: 'guided',
  guided: 'spit',
  objective: 'Explain how longshore drift moves sediment along a coast and builds a spit where the coast changes direction.',
  stages: [
    {
      title: 'Waves arrive at an angle',
      ks3: 'Waves (white arrows) arrive at an angle to the beach. The swash carries sand up the beach at that angle; the backwash brings it straight back down. Step by step, the sand zig-zags along the coast.',
      gcse: 'Prevailing winds drive waves obliquely onto the shore. Swash moves sediment up the beach at the angle of approach; backwash returns it perpendicular to the shore under gravity, giving net longshore drift.',
      t: 0,
    },
    {
      title: 'The coast turns, the sand carries on',
      ks3: 'Where the coastline bends away, the drift keeps going in a straight line. Sand is dropped in the calmer water and starts to build a ridge out to sea.',
      gcse: 'Where the coastline changes direction, longshore drift continues and deposition occurs in the more sheltered, lower-energy water, beginning a spit.',
      predict: 'What shape will the ridge of sand grow into?',
      t: 5,
    },
    {
      title: 'A spit grows',
      ks3: 'The ridge grows longer and longer: a spit — a long, narrow strip of sand joined to the land at one end (like Spurn Head).',
      gcse: 'Continued drift extends the spit across the mouth of the inlet. Changes in wind and wave direction can curve its end (a recurved spit); sheltered water behind it may become salt marsh.',
      t: 15,
    },
    {
      title: 'A long spit',
      ks3: 'After many years the spit stretches a long way across the water, still joined to the land where it started.',
      gcse: 'The spit keeps growing while sediment supply and drift continue; rivers flowing out across its end may stop it closing completely.',
      t: 30,
    },
  ],
  exam: {
    question: 'Explain how a spit forms. (4 marks)',
    marks: 4,
    model:
      'Waves approach the coast at an angle, so swash moves sediment along the beach and backwash returns it at right angles — longshore drift (1). Where the coastline changes direction, the drift continues (1) and sediment is deposited in the sheltered, lower-energy water (1), building a long, narrow ridge of sand and shingle attached to the land at one end (1).',
  },
  misconception: {
    wrong: 'Longshore drift moves sand in the same direction as the backwash.',
    right:
      'Backwash runs straight down the beach; the sideways movement comes from the swash arriving at an angle, so the net drift follows the direction the waves come from.',
  },
};

/** Guided lesson: a spit grows across a bay to make a bar and lagoon. */
export const barLagoon: Lesson = {
  id: 'bar-lagoon',
  module: 'coasts',
  title: 'Bars and lagoons',
  kind: 'guided',
  guided: 'bar',
  objective: 'Explain how a spit can grow across a bay to form a bar, cutting off a lagoon.',
  stages: [
    {
      title: 'A bay with drift along the coast',
      ks3: 'Sand drifts along the coast from left to right. In front of it is a bay.',
      gcse: 'Longshore drift transports sediment along the coast towards a bay with gently shelving water.',
      t: 0,
    },
    {
      title: 'A spit starts across the bay',
      ks3: 'At the edge of the bay the sand keeps going and starts to build a spit across the bay mouth.',
      gcse: 'Deposition at the change in coastline orientation builds a spit across the bay.',
      t: 6,
    },
    {
      title: 'The bar closes: a lagoon',
      ks3: 'The spit reaches the other side of the bay and joins the land. It is now a bar, and the water trapped behind it is a lagoon (like Slapton Ley in Devon).',
      gcse: 'If the spit extends right across the bay it becomes a bar, enclosing a lagoon. The lagoon may later fill with sediment and become marsh.',
      predict: 'Where could a river flowing into the bay go now?',
      t: 25,
    },
  ],
  exam: {
    question: 'Describe how a bar and lagoon form. (3 marks)',
    marks: 3,
    model:
      'Longshore drift carries sediment along the coast and deposits it across the mouth of a bay as a spit (1). The spit grows until it joins the other side of the bay, forming a bar (1). Water trapped behind the bar forms a lagoon (1).',
  },
  misconception: {
    wrong: 'A bar is built by waves pushing sand straight onto the shore.',
    right: 'A bar grows sideways from a spit as longshore drift carries sediment across the bay mouth.',
  },
};
