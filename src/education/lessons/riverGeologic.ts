import type { Lesson, LessonLabel, StageContext } from '../types';
import { buildUplandWorld, buildWaterfallWorld } from '../scenarioWorlds';
import { cellXY, crossSection, findSpurs, findWaterfall, mainRiver, type RiverPath } from '../geoFeatures';
import { computeSurface, type WorldState } from '../../engine/world';

/**
 * Emergent geological-time lessons: the landscape evolution model (sim/geology) runs between
 * stages, and every label is a measurement of the simulated landscape at that stage.
 */

const fmtKm = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m / 10) * 10} m`);
const at = (w: WorldState, i: number) => cellXY(w, i);

function initialSurface(build: () => WorldState): Float32Array {
  const w = build();
  const s = new Float32Array(w.width * w.height);
  computeSurface(w, s);
  return s;
}

// ---------------- waterfall and gorge ----------------

let wfStart: { distM: number; lip: number } | null = null;
/** The waterfall's position at Year 0 (the same world is rebuilt deterministically). */
function waterfallStart() {
  if (!wfStart) {
    const w = buildWaterfallWorld();
    const p = mainRiver(w);
    const f = findWaterfall(w, p, 300, 15, true);
    wfStart = { distM: f?.distM ?? 0, lip: f?.lip ?? p.cells[0] };
  }
  return wfStart;
}

function waterfallLabels(ctx: StageContext, opts: { gorge?: boolean; origin?: boolean; rocks?: boolean }): LessonLabel[] {
  const w = ctx.engine.world;
  const p = mainRiver(w);
  const f = findWaterfall(w, p, 300, 15, true);
  const out: LessonLabel[] = [];
  const mouth = p.cells[0];
  out.push({ text: 'Main river', ...at(w, p.cells[Math.floor(p.cells.length * 0.75)]) });
  if (!f) return out;
  const moved = f.distM - waterfallStart().distM;
  out.push({
    text: `Waterfall: drops ${Math.round(f.dropM)} m over ${fmtKm(f.lengthM)}, hard dolerite at the top${moved > 100 ? ` · ${fmtKm(moved)} upstream of where it began` : ''}`,
    ...at(w, f.lip),
  });
  if (opts.rocks) out.push({ text: 'Soft shale (mudstone) below the dolerite', ...at(w, f.foot) });
  if (opts.gorge && moved > 200) {
    // The gorge: halfway between where the waterfall started and where it is now.
    const target = waterfallStart().distM + moved / 2;
    let k = 0;
    while (k + 1 < p.cells.length && p.distM[k] < target) k++;
    const xs = crossSection(w, p, k, 600);
    out.push({ text: `Gorge: ${Math.round(xs.depthM)} m deep, ${fmtKm(xs.widthM)} across, sides ${Math.round(xs.sideDeg)}°`, ...at(w, p.cells[k]) });
  }
  if (opts.origin) out.push({ text: 'The waterfall was here at Year 0', ...at(w, waterfallStart().lip) });
  if (!opts.gorge && !opts.origin) out.push({ text: 'River mouth (sea)', ...at(w, mouth) });
  return out;
}

export const waterfallGorgeModel: Lesson = {
  id: 'waterfall-gorge-model',
  module: 'rivers',
  title: 'Waterfall and gorge: watch it retreat (geological time)',
  kind: 'emergent',
  geological: true,
  objective:
    'Explain how a waterfall forms where a river crosses from hard rock onto soft rock, why it retreats upstream, and how that leaves a gorge — watched over 200,000 years of simulated erosion.',
  build: () => buildWaterfallWorld(),
  stages: [
    {
      title: 'A river crosses a band of hard rock',
      ks3: 'A river flows across a high plateau to the sea. Under the plateau are layers of rock: sandstone on top, then a band of very hard rock called dolerite, then soft shale underneath. At the coast all the layers are exposed.',
      gcse: 'Horizontal strata, like upper Teesdale: sandstone over a 28 m band of resistant dolerite (as in the Whin Sill at High Force) over less resistant shale. Differential erosion will act where the river crosses these layers. The geology overlay shows the rock at the surface.',
      camera: 'oblique',
      overlay: 'geology',
      labels: (ctx) => waterfallLabels(ctx, { rocks: true }),
    },
    {
      title: 'Soft rock wears away faster: a waterfall forms',
      ks3: 'The river wears away the soft shale much faster than the hard dolerite. So the river bed drops steeply where it comes off the hard band. That steep drop is a waterfall. (50,000 years have passed.)',
      gcse: 'Vertical erosion by hydraulic action and abrasion lowers the less resistant shale faster than the resistant dolerite (here the model’s erosion rate is 4× higher in shale). A knickpoint — a step in the river’s long profile — forms at the hard band: the waterfall. On this 25 m grid it shows as a steep step; the plunge pool, undercutting and overhang are smaller than the model resolves (see the Waterfall guided lesson for that detail).',
      enter: (ctx) => ctx.geo(50000),
      camera: 'oblique',
      overlay: 'none',
      predict: 'Will the waterfall stay where it is? Which way might it move?',
      labels: (ctx) => waterfallLabels(ctx, {}),
    },
    {
      title: 'The waterfall moves upstream',
      ks3: 'The river keeps wearing away the soft rock under the hard band, so the edge of the hard rock keeps collapsing. The waterfall slowly moves back upstream, towards the river’s source. (100,000 years.)',
      gcse: 'The less resistant rock below is eroded and the resistant band above is undermined and collapses, so the knickpoint retreats upstream — headward erosion. Its position is measured along the river each stage. Real retreat rates depend on rock and discharge: Niagara Falls retreated about 1 m a year before water was diverted for power; small UK falls retreat far more slowly.',
      enter: (ctx) => ctx.geo(50000),
      camera: 'oblique',
      overlay: 'none',
      labels: (ctx) => waterfallLabels(ctx, { origin: true }),
    },
    {
      title: 'A gorge is left behind',
      ks3: 'As the waterfall moves back, it leaves a deep, narrow, steep-sided valley behind it. This is a gorge. (200,000 years.)',
      gcse: 'Repeated retreat of the knickpoint leaves a gorge of recession downstream of the waterfall — steep-sided because the walls are cut through resistant rock, as at High Force on the River Tees (a gorge about 700 m long). Depth, width and side slope are measured across the valley.',
      enter: (ctx) => ctx.geo(100000),
      camera: 'oblique',
      overlay: 'none',
      labels: (ctx) => waterfallLabels(ctx, { gorge: true, origin: true }),
    },
  ],
  exam: {
    question: 'Explain the formation of a waterfall and gorge. (4 marks)',
    marks: 4,
    model:
      'Waterfalls form where a river flows over a band of resistant rock lying over less resistant rock (1). The less resistant rock is eroded faster by hydraulic action and abrasion, undercutting the hard rock and forming a plunge pool (1). The overhanging hard rock is unsupported and collapses, so the waterfall retreats upstream (1). Repeated retreat leaves a steep-sided gorge downstream (1).',
  },
  misconception: {
    wrong: 'A waterfall stays in the same place.',
    right: 'Waterfalls retreat upstream as the rock beneath is eroded and the lip collapses — that is how gorges form. In the model you can see the step move kilometres upstream over 200,000 years.',
  },
};

// ---------------- V-shaped valley and interlocking spurs ----------------

let uplandStart: Float32Array | null = null;
const uplandInitial = () => (uplandStart ??= initialSurface(() => buildUplandWorld()));

function pathPoint(p: RiverPath, frac: number) {
  return Math.min(p.cells.length - 1, Math.max(0, Math.floor(p.cells.length * frac)));
}

function deepestCut(ctx: StageContext, p: RiverPath): { k: number; cutM: number } {
  const ref = uplandInitial();
  let best = { k: 0, cutM: 0 };
  for (let k = 0; k < p.cells.length; k++) {
    const cut = ref[p.cells[k]] - p.z[k];
    if (cut > best.cutM) best = { k, cutM: cut };
  }
  void ctx;
  return best;
}

function vValleyLabels(ctx: StageContext, show: { cut?: boolean; valley?: boolean; spurs?: boolean }): LessonLabel[] {
  const w = ctx.engine.world;
  ctx.engine.referenceSurface = uplandInitial().slice(); // change map: since Year 0
  const p = mainRiver(w);
  const out: LessonLabel[] = [];
  out.push({ text: 'Source (upper course)', ...at(w, p.cells[p.cells.length - 1]) });
  out.push({ text: 'Mouth', ...at(w, p.cells[0]) });
  if (show.cut) {
    const c = deepestCut(ctx, p);
    if (c.cutM > 1) out.push({ text: `Vertical erosion: river bed ${Math.round(c.cutM)} m lower than at Year 0`, ...at(w, p.cells[c.k]) });
  }
  if (show.valley) {
    const k = pathPoint(p, 0.6);
    const xs = crossSection(w, p, k, 800);
    out.push({
      text: `V-shaped valley: ${Math.round(xs.depthM)} m deep, sides ${Math.round(xs.sideDeg)}°, floor ${xs.floorM < 60 ? 'only as wide as the river' : `${fmtKm(xs.floorM)} wide`}`,
      ...at(w, p.cells[k]),
    });
  }
  if (show.spurs) {
    const spurs = findSpurs(w, p, pathPoint(p, 0.45), p.cells.length - 3, 6, 20).sort((a, b) => a.k - b.k);
    // Up to four consecutive spurs from alternating sides of the valley.
    const picked: typeof spurs = [];
    for (const s of spurs) {
      if (picked.length && picked[picked.length - 1].side === s.side) continue;
      picked.push(s);
      if (picked.length === 4) break;
    }
    for (const s of picked) out.push({ text: `Interlocking spur (${Math.round(s.heightM)} m above the river)`, ...at(w, s.cell) });
  }
  return out;
}

export const vValleySpurs: Lesson = {
  id: 'v-valley-spurs',
  module: 'rivers',
  title: 'V-shaped valleys and interlocking spurs (geological time)',
  kind: 'emergent',
  geological: true,
  objective:
    'Explain how vertical erosion, weathering and mass movement make a V-shaped valley with interlocking spurs in the upper course — watched over 200,000 years of simulated erosion.',
  build: () => buildUplandWorld(),
  stages: [
    {
      title: 'An upland before the river cuts down',
      ks3: 'This is high, hilly land near the source of a river. Rain drains into the lowest ground and flows towards the sea. The river starts in shallow, winding hollows.',
      gcse: 'The upper course: steep gradient, high above base level (sea level, on the left). The river follows the lowest, winding line through the hills. Rivers are drawn where enough ground drains through a point to keep a channel.',
      enter: (ctx) => ctx.geo(1), // draw the drainage (a single year: no visible change)
      camera: 'oblique',
      overlay: 'none',
      labels: (ctx) => vValleyLabels(ctx, {}),
    },
    {
      title: 'The river cuts down: vertical erosion',
      ks3: 'The river is high above the sea, so it has lots of energy to cut downwards into its bed. Rocks carried by the water grind the bed lower. (50,000 years have passed.) Red on the map shows where the ground has been worn down.',
      gcse: 'In the upper course energy is used mainly for vertical erosion by hydraulic action and abrasion, lowering the channel bed. The model’s erosion rate rises with discharge and gradient (stream power). The change map compares the land with Year 0.',
      enter: (ctx) => ctx.geo(50000),
      camera: 'oblique',
      overlay: 'change',
      predict: 'The river cuts down — what happens to the valley sides?',
      labels: (ctx) => vValleyLabels(ctx, { cut: true }),
    },
    {
      title: 'Weathering and mass movement make a V',
      ks3: 'As the river cuts down, the valley sides get steeper. Rock on the sides is broken up by the weather, and loose rock and soil slide and creep down into the river, which carries it away. The valley becomes a V shape. (100,000 years.)',
      gcse: 'Vertical erosion steepens the valley sides; weathering breaks down the rock and mass movement (soil creep, slides and rockfall in the model: slopes steeper than the rock’s critical angle fail) moves it into the channel, where it is transported away. The result is a narrow-floored V-shaped valley. Its depth, side slope and floor width are measured across the valley.',
      enter: (ctx) => ctx.geo(50000),
      camera: 'oblique',
      overlay: 'none',
      labels: (ctx) => vValleyLabels(ctx, { cut: true, valley: true }),
    },
    {
      title: 'Interlocking spurs',
      ks3: 'The river is not strong enough to cut through the hills in its way, so it winds around them. The hills poke into the valley from alternate sides, like the teeth of a zip. These are interlocking spurs. (200,000 years.)',
      gcse: 'In the upper course the river has too little energy for much lateral erosion, so it swings around more resistant high ground rather than eroding through it. Vertical erosion deepens the winding course, leaving interlocking spurs projecting alternately from each side of the V-shaped valley. Spurs are found where the river bends, with high ground inside the bend.',
      enter: (ctx) => ctx.geo(100000),
      camera: 'top',
      overlay: 'none',
      labels: (ctx) => vValleyLabels(ctx, { valley: true, spurs: true }),
    },
  ],
  exam: {
    question: 'Explain the formation of interlocking spurs. (4 marks)',
    marks: 4,
    model:
      'In the upper course the river has a steep gradient and its energy is mainly used for vertical erosion (1). It lacks the energy to erode laterally through areas of more resistant rock, so it winds around them (1). Vertical erosion by abrasion and hydraulic action deepens the channel, while weathering and mass movement on the valley sides form a V-shaped valley (1). The high ground the river winds around is left as spurs that interlock from alternate sides of the valley (1).',
  },
  misconception: {
    wrong: 'Valleys are V-shaped because the river is as wide as the valley.',
    right: 'The river only cuts the bottom of the V. The sides are shaped by weathering and mass movement bringing material down to the river, which carries it away.',
  },
};
