import type { Lesson, LessonLabel, StageContext } from '../types';
import { buildLowlandWorld, buildUplandWorld, buildWaterfallWorld } from '../scenarioWorlds';
import { bankHeight, cellXY, crossSection, findSpurs, findWaterfall, leveeHeight, mainRiver, meanderBends, type RiverPath } from '../geoFeatures';
import { channelDistance, createMeander, floodplainZ, sinuosity } from '../../sim/geology/meander';
import { computeSurface, type WorldState } from '../../engine/world';

/**
 * Emergent geological-time lessons: the landscape evolution model (sim/geology) runs between
 * stages, and every label is a measurement of the simulated landscape at that stage.
 */

const fmtKm = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m / 10) * 10} m`);
const at = (w: WorldState, i: number) => cellXY(w, i);
const surfAt = (w: WorldState, i: number) => w.bedrockElevationM[i] + w.looseSedimentThicknessM[i];

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

// ---------------- meanders, oxbow lakes, floodplain and levees ----------------

let lowland: ReturnType<typeof buildLowlandWorld> | null = null;
const lowlandStart = () => (lowland ??= buildLowlandWorld());

function lowlandLabels(ctx: StageContext, show: { bends?: boolean; oxbow?: boolean; levee?: boolean }): LessonLabel[] {
  const w = ctx.engine.world;
  const m = ctx.engine.geoMeander;
  if (!m) return [];
  const out: LessonLabel[] = [];
  const mid = Math.floor(m.xs.length * 0.5);
  const sin = sinuosity(m);
  out.push({ text: `River: ${sin.toFixed(1)}× longer than its valley${sin > 1.5 ? ' (meandering)' : ''}`, xM: m.xs[mid], yM: m.ys[mid] });
  // Floodplain width across the valley at the middle of the map (thick alluvium below flood level).
  const W = w.width;
  const xMid = Math.floor(W / 2);
  let cells = 0;
  for (let y = 0; y < w.height; y++) {
    const i = y * W + xMid;
    if (w.looseSedimentThicknessM[i] >= 3 && surfAt(w, i) < floodplainZ(m, xMid * w.cellSizeM, y * w.cellSizeM) + m.params.floodHeightM + 1) cells++;
  }
  const fpLabelY = (w.height * 0.27) * w.cellSizeM;
  out.push({ text: `Floodplain: ${fmtKm(cells * w.cellSizeM)} wide, flat land built of river sediment`, xM: xMid * w.cellSizeM, yM: fpLabelY });
  if (show.bends) {
    const bends = meanderBends(m).filter((b) => b.k > m.xs.length * 0.15 && b.k < m.xs.length * 0.85);
    const b = bends.sort((p, q) => Math.abs(q.curvature) - Math.abs(p.curvature))[0];
    if (b) {
      out.push({ text: `River cliff: outer bank ${bankHeight(w, m, b.k, b.outer).toFixed(1)} m high — erosion`, ...b.outer });
      out.push({ text: 'Slip-off slope (point bar): gentle inner bank — deposition', ...b.inner });
    }
  }
  if (show.oxbow) {
    const lake = ctx.engine.geoRivers?.lake;
    for (let q = m.oxbows.length - 1; q >= 0; q--) {
      const o = m.oxbows[q];
      const k = Math.floor(o.xs.length / 2);
      const i = Math.round(o.ys[k] / w.cellSizeM) * W + Math.round(o.xs[k] / w.cellSizeM);
      const water = lake ? lake[i] - surfAt(w, i) : 0;
      const ago = Math.round((m.years - o.year) / 10) * 10;
      const depth = floodplainZ(m, o.xs[k], o.ys[k]) - surfAt(w, i);
      if (water <= 0.3 && depth > 1 && q > 0) continue; // rejoined by the river: look at an older loop
      out.push({
        text:
          water > 0.3
            ? `Oxbow lake: cut off ${ago.toLocaleString()} years ago, ${water.toFixed(1)} m deep`
            : depth > 1
              ? `Abandoned meander, cut off ${ago.toLocaleString()} years ago (joined to the river again)`
              : `Meander scar: an old oxbow lake filled in with flood mud (cut off ${ago.toLocaleString()} years ago)`,
        xM: o.xs[k],
        yM: o.ys[k],
      });
      break;
    }
    if (!m.oxbows.length) out.push({ text: 'No cut-off yet: watch the narrowest neck', xM: m.xs[mid], yM: m.ys[mid] });
  }
  if (show.levee) {
    const lv = leveeHeight(w, m, 700);
    out.push({ text: `Levees: river banks ${lv.heightM.toFixed(1)} m higher than the floodplain 700 m away (typical straight reach)`, ...lv.at });
    // Floodplain built up by floods since Year 0, away from the channel and old loops.
    const s0 = lowlandStart().world.looseSedimentThicknessM;
    const dist = channelDistance(w, m.xs, m.ys, 60);
    let sum = 0;
    let n = 0;
    for (let i = 0; i < dist.length; i++) if (dist[i] > 150 && dist[i] < 600 && s0[i] >= 3) {
      sum += w.looseSedimentThicknessM[i] - s0[i];
      n++;
    }
    if (n) out.push({ text: `Floods have built the floodplain up ${(sum / n).toFixed(2)} m since Year 0`, xM: xMid * w.cellSizeM, yM: w.height * 0.73 * w.cellSizeM });
    // Backswamp: the largest stretch of water behind the levees that is not an old meander loop.
    const lake = ctx.engine.geoRivers?.lake;
    if (lake) {
      const near = new Uint8Array(dist.length);
      for (const o of m.oxbows) {
        const od = channelDistance(w, o.xs, o.ys, 60, false);
        for (let i = 0; i < od.length; i++) if (od[i] <= 60) near[i] = 1;
      }
      const seen = new Uint8Array(dist.length);
      let best = { cells: 0, deep: -1, depth: 0 };
      for (let i0 = 0; i0 < dist.length; i0++) {
        if (seen[i0] || near[i0] || dist[i0] < 60 || lake[i0] - surfAt(w, i0) <= 0.5) continue;
        const stack = [i0];
        seen[i0] = 1;
        let cells = 0;
        let deep = i0;
        while (stack.length) {
          const i = stack.pop()!;
          cells++;
          if (lake[i] - surfAt(w, i) > lake[deep] - surfAt(w, deep)) deep = i;
          const x = i % W;
          const y = (i / W) | 0;
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const xn = x + dx;
            const yn = y + dy;
            if (xn < 0 || yn < 0 || xn >= W || yn >= w.height) continue;
            const j = yn * W + xn;
            if (!seen[j] && !near[j] && dist[j] >= 60 && lake[j] - surfAt(w, j) > 0.5) {
              seen[j] = 1;
              stack.push(j);
            }
          }
        }
        if (cells > best.cells) best = { cells, deep, depth: lake[deep] - surfAt(w, deep) };
      }
      if (best.cells * w.cellSizeM ** 2 > 2e4)
        out.push({ text: `Backswamp: low, wet ground behind the levees, flooded up to ${best.depth.toFixed(1)} m`, ...at(w, best.deep) });
    }
  }
  return out;
}

export const meandersFloodplain: Lesson = {
  id: 'meanders-floodplain-model',
  module: 'rivers',
  title: 'Meanders, oxbow lakes, floodplains and levees (geological time)',
  kind: 'emergent',
  geological: true,
  objective:
    'Explain how lateral erosion and deposition make meanders migrate, how a neck cut-off leaves an oxbow lake, and how floods build a floodplain and levees — watched over about 15,000 years of a simulated lowland river.',
  build: () => buildLowlandWorld().world, // a fresh copy; the river centreline is added in stage 1
  stages: [
    {
      title: 'A lowland river on its floodplain',
      ks3: 'Near the sea the land is low and flat. A big river winds gently across a wide, flat floodplain made of mud, sand and gravel that the river has dropped. Low hills form the valley sides.',
      gcse: 'The lower course: a gentle gradient (1 : 1,250), a large discharge from the whole basin upstream, and a channel 50 m wide and 3 m deep cut into thick alluvium. Energy now goes into lateral erosion and transport rather than vertical erosion. The river’s course is measured each stage: length along the channel ÷ length of the valley (sinuosity).',
      enter: (ctx) => {
        const s = lowlandStart();
        ctx.engine.setMeander(createMeander(s.xs, s.ys, s.zIn, s.zOut));
      },
      camera: 'top',
      overlay: 'none',
      labels: (ctx) => lowlandLabels(ctx, {}),
    },
    {
      title: 'Meanders grow: erosion outside, deposition inside',
      ks3: 'Water flows fastest on the outside of each bend, wearing away the bank into a steep river cliff. On the inside the water is slow and drops sand and gravel, building a gentle slip-off slope. The bends grow bigger and move downstream. (6,000 years.)',
      gcse: 'In a bend, the thalweg (fastest flow) swings to the outer bank and helicoidal flow carries sediment from the outer bank to the inner bank. Lateral erosion by hydraulic action and abrasion undercuts the outer bank (river cliff); deposition on the inner bank forms a point bar (slip-off slope). The model moves each bend by bank erosion that depends on its curvature and on the bends upstream (Howard & Knutson 1984), so bends grow and migrate downstream.',
      enter: (ctx) => ctx.geo(6000),
      camera: 'top',
      overlay: 'none',
      predict: 'The outsides of two bends are getting closer. What could happen next?',
      labels: (ctx) => lowlandLabels(ctx, { bends: true }),
    },
    {
      title: 'The neck is cut through: an oxbow lake',
      ks3: 'Two bends erode towards each other until only a narrow neck of land is left. In a flood the river cuts straight through the neck, taking the shorter route. Deposition seals off the old bend, which is left as a curved lake: an oxbow lake. (The model runs until a neck is cut through.)',
      gcse: 'Continued lateral erosion on the outer banks narrows the meander neck. During high discharge the river breaches the neck (a neck cut-off) and follows the steeper, shorter course; deposition seals the ends of the abandoned meander, forming an oxbow lake. In the model a cut-off happens when two parts of the channel come within 1.5 channel widths; the abandoned loop stays lower than the floodplain, so it holds water.',
      enter: async (ctx) => {
        // Run on until a neck is cut through (at most 8,000 years), then 200 years more.
        const c0 = ctx.engine.geoMeander?.cutoffs ?? 0;
        for (let t = 0; t < 8000 && (ctx.engine.geoMeander?.cutoffs ?? 0) === c0; t += 1000) await ctx.geo(1000);
        await ctx.geo(200);
      },
      camera: 'top',
      overlay: 'none',
      labels: (ctx) => lowlandLabels(ctx, { bends: true, oxbow: true }),
    },
    {
      title: 'Floods build the floodplain and levees',
      ks3: 'When the river floods, water spreads over the floodplain and slows down. The heaviest sediment drops first, right next to the river, building raised banks called levees. Finer mud settles further away, slowly raising the whole floodplain. Old oxbow lakes slowly fill with mud. (5,000 more years.)',
      gcse: 'In flood, water leaves the channel, loses velocity and deposits its load: coarse sediment close to the channel builds levees, finer silt and clay settles across the floodplain, so it aggrades over time; low ground behind the levees stays wet (backswamps). Lateral migration of meanders also reworks the floodplain, leaving point-bar deposits and meander scars. In the model flood deposits thin out away from the channel (exponential decay, as measured on real floodplains) up to the flood level.',
      enter: (ctx) => ctx.geo(5000),
      camera: 'oblique',
      overlay: 'none',
      labels: (ctx) => lowlandLabels(ctx, { oxbow: true, levee: true }),
    },
  ],
  exam: {
    question: 'Explain the formation of an oxbow lake. (4 marks)',
    marks: 4,
    model:
      'Lateral erosion by hydraulic action and abrasion is greatest on the outside of a meander, where velocity is highest, while deposition occurs on the inside (1). Erosion on the outer banks of two bends narrows the neck of the meander (1). During a flood the river cuts through the neck, taking the shortest route (1). Deposition seals off the old meander, leaving it as an oxbow lake, which may later fill in to become a meander scar (1).',
  },
  misconception: {
    wrong: 'Meanders stay in the same place.',
    right: 'Meanders migrate across and down the floodplain as the outer banks erode and the inner banks build out — that is how cut-offs and oxbow lakes happen, and why old meander scars are found all over floodplains.',
  },
};
