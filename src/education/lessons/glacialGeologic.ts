import type { Lesson, LessonLabel, StageContext } from '../types';
import { buildMountainWorld } from '../scenarioWorlds';
import { at, findGlacialFeatures } from '../glacialFeatures';
import { crossSection, mainRiver } from '../geoFeatures';

/**
 * Emergent geological-time lesson: river-carved mountains are glaciated for 120,000 years (the UK
 * uplands were glaciated many times in the last 2.6 million years) and the ice melts away. Labels are
 * measurements of the simulated landscape.
 */
const COLD_C = -1; // sea-level mean temperature in the ice age → snowline (equilibrium line) ≈ 570 m here
const WARM_C = 10;

// The land before the ice age and the ice at its greatest (kept when the stages are first run).
let pre: Float32Array | null = null;
let iceMax: Float32Array | null = null;

/** The ice-age snowline (equilibrium-line height) of this world. */
const snowlineCold = (ctx: StageContext) => {
  const w = ctx.engine.world;
  const c = w.climate;
  return w.seaLevelM + (COLD_C - w.glacier.elaTempC) / (c.lapseRateCPerKm / 1000);
};

const snowline = (ctx: StageContext) => {
  const w = ctx.engine.world;
  const c = w.climate;
  return w.seaLevelM + (c.seaLevelTempC - w.glacier.elaTempC) / (c.lapseRateCPerKm / 1000);
};

function iceLabels(ctx: StageContext): LessonLabel[] {
  const w = ctx.engine.world;
  const ice = w.iceThicknessM;
  let thick = 0;
  let cells = 0;
  for (let i = 0; i < ice.length; i++) {
    if (ice[i] > ice[thick]) thick = i;
    if (ice[i] > 1) cells++;
  }
  const out: LessonLabel[] = [];
  if (ice[thick] > 1) {
    out.push({ text: `Valley glacier: ice ${Math.round(ice[thick])} m thick`, ...at(w, thick) });
    out.push({ text: `Ice covers ${((cells * w.cellSizeM ** 2) / 1e6).toFixed(1)} km² of the mountains`, xM: w.width * 0.12 * w.cellSizeM, yM: w.height * 0.88 * w.cellSizeM });
  }
  // Snowline: a point on the land near the equilibrium-line height.
  const ela = snowline(ctx);
  let best = -1;
  for (let i = 0; i < ice.length; i++) {
    const z = ctx.engine.surface[i];
    if (Math.abs(z - ela) < 15 && (best < 0 || ice[i] > ice[best])) best = i;
  }
  if (best >= 0) out.push({ text: `Snowline ≈ ${Math.round(ela)} m: above it more snow falls than melts each year`, ...at(w, best) });
  return out;
}

export const glaciatedUpland: Lesson = {
  id: 'glaciated-upland-model',
  module: 'glaciation',
  title: 'Glaciated upland: corries, arêtes, U-shaped valleys (geological time)',
  kind: 'emergent',
  geological: true,
  objective:
    'Explain how glaciers erode and deposit to form corries, arêtes, pyramidal peaks, U-shaped troughs, hanging valleys, ribbon lakes and moraines — watched as river-carved mountains are glaciated for 120,000 years and the ice melts.',
  build: () => buildMountainWorld(),
  stages: [
    {
      title: 'Mountains carved by rivers',
      ks3: 'Before the ice age, rivers have worn deep, V-shaped valleys into these mountains of hard volcanic rock, like the Lake District. (300,000 years of river erosion.)',
      gcse: 'A pre-glacial landscape: fluvial erosion has cut V-shaped valleys radiating from the summits, separated by interlocking spurs. Glaciers will follow these valleys. The rock is resistant volcanic rock, like the Borrowdale Volcanic Group of the Lake District.',
      enter: (ctx) => ctx.geo(300000),
      camera: 'oblique',
      overlay: 'none',
      labels: (ctx) => {
        const w = ctx.engine.world;
        const p = mainRiver(w, 20);
        const k = Math.floor(p.cells.length * 0.55);
        const xs = crossSection(w, p, k, 1200);
        let top = 0;
        for (let i = 0; i < ctx.engine.surface.length; i++) if (ctx.engine.surface[i] > ctx.engine.surface[top]) top = i;
        return [
          { text: `V-shaped river valley: ${Math.round(xs.depthM)} m deep, sides ${Math.round(xs.sideDeg)}°`, ...at(w, p.cells[k]) },
          { text: `Highest summit: ${Math.round(ctx.engine.surface[top])} m`, ...at(w, top) },
        ];
      },
    },
    {
      title: 'An ice age: snow builds up into glaciers',
      ks3: 'The climate cools. Above the snowline more snow falls each winter than melts each summer. It piles up, squashes into ice and starts to flow downhill as glaciers, first in sheltered hollows facing north-east, then filling the valleys. (4,000 years.)',
      gcse: 'With a colder climate the equilibrium line drops below the summits. Accumulation exceeds ablation above it; snow is compacted to firn and glacier ice, which flows by internal deformation and basal sliding (the model uses the shallow-ice approximation of Glen’s flow law). Shaded north- to east-facing slopes, where drifting snow collects and melting is slowest, get extra accumulation in the model, as in the UK.',
      enter: (ctx) => {
        pre = ctx.engine.surface.slice();
        ctx.engine.setClimateParams({ enabled: true, seaLevelTempC: COLD_C, seasonalAmpC: 0, seasonsRun: false });
        ctx.engine.setGlacierParams({ enabled: true, aspectBalance: 0.4, erosionLaw: 'linear', slidingCoupling: 4, maxErosionMmYr: 10 });
        return ctx.geo(4000);
      },
      camera: 'oblique',
      overlay: 'none',
      labels: iceLabels,
    },
    {
      title: 'Glaciers erode: plucking and abrasion',
      ks3: 'The moving ice freezes onto rocks and plucks them out, then drags them along its bed like sandpaper (abrasion). It deepens and widens the valleys. Frost shatters the rock walls above the ice. Meltwater rivers carry most of the rubble away. (120,000 years of ice.)',
      gcse: 'Basal sliding drives erosion by plucking and abrasion (in the model: bed lowering proportional to sliding speed, at most 10 mm a year, the measured range for temperate glaciers). The debris is carried in the ice; where the ice melts most of it (95 % in the model) leaves in meltwater rivers (outwash) and the rest is left as moraine. Above the ice, freeze-thaw weathering and rockfall keep the back walls of the corries steep.',
      enter: (ctx) => ctx.geo(116000),
      camera: 'oblique',
      overlay: 'none',
      labels: (ctx) => {
        const out = iceLabels(ctx);
        const t = ctx.engine.geoTotals;
        out.push({
          text: `Rock removed by the ice so far: ${(t.glacialEroded / 1e9).toFixed(2)} km³`,
          xM: ctx.engine.world.width * 0.12 * ctx.engine.world.cellSizeM,
          yM: ctx.engine.world.height * 0.1 * ctx.engine.world.cellSizeM,
        });
        return out;
      },
    },
    {
      title: 'The ice melts: a glaciated landscape',
      ks3: 'The climate warms and the glaciers melt away in a few thousand years. Now we can see what they made. There are armchair-shaped hollows (corries) and knife-edge ridges (arêtes). The main valleys are deeper, with steep sides. Side valleys are left hanging high above them. Piles of rubble (moraine) mark where the ice ended.',
      gcse: 'Deglaciation reveals erosional landforms — corries, arêtes, pyramidal peaks, glacial troughs with steep sides and wide flat floors, truncated spurs, hanging valleys (tributary glaciers eroded their valleys less deeply), ribbon lakes in over-deepened rock basins — and depositional landforms (moraine). Each label is measured on the model landscape and compared with the river-carved land before the ice age. Corries smaller than ~1 km are at the edge of what this 60 m grid can show.',
      enter: (ctx) => {
        iceMax = ctx.engine.world.iceThicknessM.slice();
        ctx.engine.setClimateParams({ seaLevelTempC: WARM_C });
        return ctx.geo(3000);
      },
      camera: 'oblique',
      overlay: 'none',
      labels: (ctx) => {
        const w = ctx.engine.world;
        if (!pre || !iceMax) return [];
        const f = findGlacialFeatures(w, pre, iceMax, ctx.engine.moraineField(), snowlineCold(ctx), ctx.engine.glacialErosionField());
        const out: LessonLabel[] = [];
        if (f.trough) {
          const t = f.trough;
          const widened = t.after.floorM > t.before.floorM;
          out.push({
            text: widened
              ? `U-shaped valley: ${Math.round(t.deepenedM)} m deeper, floor widened ${Math.round(t.before.floorM)} → ${Math.round(t.after.floorM)} m, sides up to ${Math.round(t.after.sideDeg)}°`
              : `Glacial trough: ${Math.round(t.deepenedM)} m deeper, sides up to ${Math.round(t.after.sideDeg)}°`,
            ...at(w, t.cell),
          });
        }
        for (const c of f.corries.slice(0, 2))
          out.push({ text: c.tarnM > 0.5 ? `Corrie with a tarn (${c.tarnM.toFixed(0)} m deep), facing ${c.facing}` : `Corrie, facing ${c.facing}`, ...at(w, c.cell) });
        if (f.arete) out.push({ text: `Arête: narrow ridge between two corries`, ...at(w, f.arete.cell) });
        if (f.peak) out.push({ text: `Pyramidal peak: corries cut into ${f.peak.corries} sides`, ...at(w, f.peak.cell) });
        if (f.hanging) out.push({ text: `Hanging valley: ${Math.round(f.hanging.dropM)} m above the main valley floor`, ...at(w, f.hanging.cell) });
        if (f.ribbon) out.push({ text: `Ribbon lake: ${(f.ribbon.lengthM / 1000).toFixed(1)} km long, ${f.ribbon.depthM.toFixed(0)} m deep`, ...at(w, f.ribbon.cell) });
        if (f.moraine) out.push({ text: `Moraine: ${f.moraine.thickM.toFixed(0)} m of rock debris left by the ice`, ...at(w, f.moraine.cell) });
        return out;
      },
    },
    {
      title: 'Where the ice wore the land down',
      ks3: 'The darker the red, the more rock the ice scraped away. The deepest red runs along the old river valleys, which the glaciers deepened, and around the summits where the corries are. The ridges between valleys were hardly touched — that is why they stand out as sharp arêtes.',
      gcse: 'The map shows the ground worn away by glacial erosion alone (recorded cell by cell in the model), not by rivers or weathering. Erosion is concentrated beneath fast-sliding ice — trunk glaciers in the former river valleys and corrie glaciers below the summits — while interfluves are lowered least, so glacial erosion increases relief: selective linear erosion.',
      camera: 'top',
      overlay: 'glacial',
      labels: (ctx) => {
        const w = ctx.engine.world;
        const g = ctx.engine.glacialErosionField();
        let k = 0;
        let tot = 0;
        for (let i = 0; i < g.length; i++) {
          if (g[i] > g[k]) k = i;
          tot += g[i];
        }
        return [
          { text: `Worn away most: ${Math.round(g[k])} m by the ice`, ...at(w, k) },
          { text: `Rock removed by glaciers in all: ${((tot * w.cellSizeM ** 2) / 1e9).toFixed(2)} km³`, xM: w.width * 0.15 * w.cellSizeM, yM: w.height * 0.9 * w.cellSizeM },
        ];
      },
    },
  ],
  exam: {
    question: 'Explain the formation of a corrie. (4 marks)',
    marks: 4,
    model:
      'Snow accumulates in a hollow on a sheltered (often north- or east-facing) mountainside and is compressed into glacier ice (1). The ice moves by rotational slip, plucking rock from the back wall and abrading the floor, deepening the hollow (1). Freeze-thaw weathering above the ice steepens the back wall (1). Less erosion at the front leaves a rock lip; when the ice melts, water may fill the hollow to form a tarn (1).',
  },
  misconception: {
    wrong: 'Glaciers carved the valleys from nothing.',
    right: 'Glaciers mostly followed and reshaped valleys that rivers had already cut — deepening, widening and straightening them from a V to a U shape.',
  },
};
