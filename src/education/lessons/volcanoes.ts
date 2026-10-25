import type { Lesson, LessonLabel, StageContext } from '../types';

/** Highest ground point in a vertical strip of the map (fraction of the width), as a label anchor. */
function summitIn(ctx: StageContext, u0: number, u1: number): { xM: number; yM: number; z: number } {
  const w = ctx.engine.world;
  const z = ctx.engine.surface;
  let best = -1;
  for (let y = 0; y < w.height; y++)
    for (let x = Math.floor(u0 * w.width); x < Math.ceil(u1 * w.width); x++) {
      const i = y * w.width + x;
      if (best < 0 || z[i] > z[best]) best = i;
    }
  return {
    xM: (best % w.width) * w.cellSizeM,
    yM: Math.floor(best / w.width) * w.cellSizeM,
    z: z[best],
  };
}

const shieldAt = (ctx: StageContext) => ({
  xM: 0.3 * (ctx.engine.world.width - 1) * ctx.engine.world.cellSizeM,
  yM: 0.5 * (ctx.engine.world.height - 1) * ctx.engine.world.cellSizeM,
});
const compositeAt = (ctx: StageContext) => ({
  xM: 0.72 * (ctx.engine.world.width - 1) * ctx.engine.world.cellSizeM,
  yM: 0.5 * (ctx.engine.world.height - 1) * ctx.engine.world.cellSizeM,
});

function build(ctx: StageContext, type: 'shield' | 'composite', at: { xM: number; yM: number }, eruptions: number) {
  const b = ctx.engine.buildVolcano(at.xM, at.yM, type, eruptions);
  while (b.step());
}

const labels = (ctx: StageContext, which: ('shield' | 'composite' | 'crater')[]): LessonLabel[] => {
  const out: LessonLabel[] = [];
  const base = ctx.engine.world.seaLevelM + 10;
  if (which.includes('shield')) {
    const s = summitIn(ctx, 0.05, 0.5);
    if (s.z > base + 2)
      out.push({
        text: `Shield volcano (${Math.round(s.z - base)} m high)`,
        xM: s.xM,
        yM: s.yM,
      });
  }
  if (which.includes('composite')) {
    const c = summitIn(ctx, 0.5, 0.95);
    if (c.z > base + 2)
      out.push({
        text: `Composite volcano (${Math.round(c.z - base)} m high)`,
        xM: c.xM,
        yM: c.yM,
      });
  }
  if (which.includes('crater')) out.push({ text: 'Crater / vent', ...compositeAt(ctx) });
  return out;
};

/** Emergent lesson: build a shield and a composite volcano with the real eruption physics and compare them. */
export const volcanoTypes: Lesson = {
  id: 'volcano-types',
  module: 'volcanoes',
  title: 'Shield and composite volcanoes',
  kind: 'emergent',
  objective: 'Compare shield and composite volcanoes and explain how the type of magma and eruption controls their shape.',
  setup: {
    presetId: 'flat',
    seed: 5201,
    size: 160,
    cellSizeM: 30,
    reliefM: 0,
    seaLevelM: 0,
    roughness: 0,
    name: 'Lesson: volcanoes',
  },
  stages: [
    {
      title: 'A flat plain',
      ks3: 'Here is a flat plain. We will open two vents in it and let them erupt many times — one with runny lava, one with sticky lava and explosions.',
      gcse: 'The two volcanoes will be built by the model’s own lava-flow and ash-fall physics (each eruption simulated; the long rests between them skipped).',
      camera: 'oblique',
    },
    {
      title: 'Runny lava builds a shield volcano',
      ks3: 'Basalt lava is very hot and runny. It flows a long way before it cools and sets, so eruption after eruption builds a wide volcano with gentle slopes.',
      gcse: 'Low-silica basaltic magma has low viscosity and gas escapes easily, giving effusive eruptions. Lava flows travel far before solidifying, building a broad, gently sloping shield volcano (e.g. Mauna Loa, Hawaii) — typical of hotspots and constructive margins.',
      enter: (ctx) => build(ctx, 'shield', shieldAt(ctx), 6),
      labels: (ctx) => labels(ctx, ['shield']),
      camera: 'oblique',
      overlay: 'elevation',
    },
    {
      title: 'Sticky lava and ash build a composite volcano',
      ks3: 'Andesite lava is cooler and sticky. Gas gets trapped, so some eruptions explode, throwing out ash and cinder; others ooze thick lava that does not flow far. Layers of ash and lava build a steep cone with a crater.',
      gcse: 'Higher-silica andesitic magma is viscous and traps gas, giving explosive eruptions alternating with short, thick lava flows. Alternating layers of ash (tephra) and lava build a steep-sided composite (strato) volcano with a summit crater (e.g. Mount Fuji) — typical of destructive margins.',
      enter: (ctx) => build(ctx, 'composite', compositeAt(ctx), 8),
      labels: (ctx) => labels(ctx, ['shield', 'composite', 'crater']),
      camera: 'oblique',
      overlay: 'elevation',
      predict: 'Which volcano will have the steeper sides, and why?',
    },
    {
      title: 'Compare the slopes',
      ks3: 'The slope map shows it clearly: the shield’s sides are gentle (pale), the composite cone’s sides are steep (dark orange).',
      gcse: 'The slope overlay quantifies the contrast: shield flanks of a few degrees against composite flanks of tens of degrees. The shape follows from magma viscosity and eruption style, not from size.',
      labels: (ctx) => labels(ctx, ['shield', 'composite']),
      camera: 'top',
      overlay: 'slope',
    },
  ],
  exam: {
    question: 'Compare the characteristics of shield and composite volcanoes. (4 marks)',
    marks: 4,
    model:
      'Shield volcanoes have gentle slopes and a wide base because runny basaltic lava flows a long way before cooling (1), whereas composite volcanoes are steep-sided cones (1) built from alternating layers of ash and viscous andesitic lava that cools near the vent (1). Shield eruptions are usually effusive, while composite volcanoes erupt explosively because gas is trapped in the viscous magma (1).',
  },
  misconception: {
    wrong: 'Shield volcanoes are small because their eruptions are gentle.',
    right: 'Shield volcanoes are often the largest volcanoes on Earth (Mauna Loa); "gentle" describes the eruption style and slopes, not the size.',
  },
};
