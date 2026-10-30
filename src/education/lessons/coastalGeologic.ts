import type { Lesson, LessonLabel, StageContext } from '../types';
import { buildDiscordantCoastWorld } from '../scenarioWorlds';
import type { WorldState } from '../../engine/world';
import { MATERIALS } from '../../terrain/materials';

/**
 * Emergent geological-time lesson: a straight coast cut across bands of hard and soft rock (like
 * Swanage Bay, Dorset) is worn back by waves for 6,000 years. Labels are measurements of the model.
 */
const CLAY = 3;

let start: Float32Array | null = null;
const startSurface = () => {
  if (!start) {
    const w = buildDiscordantCoastWorld();
    start = new Float32Array(w.width * w.height);
    for (let i = 0; i < start.length; i++) start[i] = w.bedrockElevationM[i] + w.looseSedimentThicknessM[i];
  }
  return start;
};

const surfAt = (w: WorldState, i: number) => w.bedrockElevationM[i] + w.looseSedimentThicknessM[i];
const at = (w: WorldState, x: number, y: number) => ({ xM: x * w.cellSizeM, yM: y * w.cellSizeM });

/** x of the first sea cell from the land (west) side in row y, on surface z. */
function shoreX(w: WorldState, z: (i: number) => number, y: number): number {
  for (let x = 0; x < w.width; x++) if (z(y * w.width + x) < w.seaLevelM) return x;
  return w.width;
}

interface Band {
  rock: number;
  y0: number;
  y1: number;
  /** Row furthest out to sea (headland tip) or furthest in (bay head), and its shore x. */
  row: number;
  shore: number;
}

/** The rock bands along the coast (rows by exposed rock at the old cliff line), with their most seaward / landward shore. */
function bands(w: WorldState): Band[] {
  const W = w.width;
  const z = (i: number) => surfAt(w, i);
  const s0 = startSurface();
  const out: Band[] = [];
  let y0 = 0;
  const rockOf = (y: number) => w.strataMaterial[(y * W + Math.max(0, shoreX(w, (i) => s0[i], y) - 3)) * 4];
  for (let y = 1; y <= w.height; y++) {
    if (y < w.height && rockOf(y) === rockOf(y0)) continue;
    const rock = rockOf(y0);
    const soft = rock === CLAY;
    let row = Math.floor((y0 + y - 1) / 2);
    let shore = shoreX(w, z, row);
    // Bays: the most landward shore in the band; headlands: the most seaward (ignoring the band edges).
    for (let r = y0 + 2; r < y - 2; r++) {
      const sx = shoreX(w, z, r);
      if (soft ? sx < shore : sx > shore) (shore = sx), (row = r);
    }
    out.push({ rock, y0, y1: y - 1, row, shore });
    y0 = y;
  }
  return out;
}

function coastLabels(ctx: StageContext, show: { rocks?: boolean; landforms?: boolean; platform?: boolean; energy?: boolean }): LessonLabel[] {
  const e = ctx.engine;
  const w = e.world;
  const W = w.width;
  const s0 = startSurface();
  const z = (i: number) => surfAt(w, i);
  const bs = bands(w);
  const out: LessonLabel[] = [];
  const name = (rock: number) => (rock === CLAY ? 'soft clay' : 'hard chalk and limestone');
  const retreat = (b: Band) => (shoreX(w, (i) => s0[i], b.row) - b.shore) * w.cellSizeM;
  if (show.rocks)
    for (const b of bs) out.push({ text: `${MATERIALS[b.rock].name.split(' (')[0]}: ${name(b.rock)}`, ...at(w, Math.max(0, b.shore - 12), b.row) });
  const head = bs.filter((b) => b.rock !== CLAY).sort((a, b) => b.shore - a.shore)[0];
  const bay = bs.filter((b) => b.rock === CLAY).sort((a, b) => a.shore - b.shore)[0];
  if (show.landforms && head && bay) {
    const indent = (head.shore - bay.shore) * w.cellSizeM;
    out.push({ text: `Headland: hard rock, worn back ${Math.round(retreat(head))} m — it now juts ${Math.round(indent)} m out beyond the bays`, ...at(w, head.shore - 1, head.row) });
    // Sand and shingle in the bay: loose sediment along its shore (within 2 cells either side of the waterline).
    let sand = 0;
    let n = 0;
    for (let y = bay.y0 + 2; y <= bay.y1 - 2; y++) {
      const sx = shoreX(w, z, y);
      for (let x = Math.max(0, sx - 2); x <= Math.min(W - 1, sx + 2); x++) (sand += w.looseSedimentThicknessM[y * W + x]), n++;
    }
    out.push({ text: `Bay: soft clay worn back ${Math.round(retreat(bay))} m${n && sand / n > 0.2 ? `; sand and shingle ${(sand / n).toFixed(1)} m thick on its shore` : ''}`, ...at(w, bay.shore - 1, bay.row) });
    // Cliff height at the headland.
    let top = -Infinity;
    for (let x = Math.max(0, head.shore - 6); x < head.shore; x++) top = Math.max(top, z(head.row * W + x));
    out.push({ text: `Cliff: ${Math.round(top - w.seaLevelM)} m high, undercut by waves and collapsing`, ...at(w, head.shore - 2, Math.round((head.row + head.y1) / 2)) });
  }
  if (show.platform && head) {
    // Wave-cut platform: the shallow rock shelf seaward of the headland cliff (between 3 m below sea level and sea level).
    let x = head.shore;
    while (x < W && z(head.row * W + x) > w.seaLevelM - 3 && z(head.row * W + x) < w.seaLevelM) x++;
    const width = (x - head.shore) * w.cellSizeM;
    if (width >= 2 * w.cellSizeM)
      out.push({ text: `Wave-cut platform: a rock shelf ${Math.round(width)} m wide, just below sea level, left as the cliff retreated`, ...at(w, Math.round((head.shore + x) / 2), head.row) });
  }
  if (show.energy && head && bay) {
    // Wave energy reaching the coast: recompute the coast model's exposure for the present shoreline (no erosion).
    e.coast.run(0, 1);
    const ex = (b: Band) => {
      let best = 0;
      for (let y = b.row - 2; y <= b.row + 2; y++) for (let x = b.shore - 2; x < b.shore + 1; x++) if (x >= 0) best = Math.max(best, e.coast.exposure[y * W + x]);
      return best / 1000;
    };
    const eh = ex(head);
    const eb = ex(bay);
    if (eh > 0)
      out.push({
        text: `Wave energy reaching the cliff: headland ${eh.toFixed(1)} kW/m, bay ${eb.toFixed(1)} kW/m — the bay is more sheltered`,
        ...at(w, Math.round((head.shore + bay.shore) / 2), Math.round((head.row + bay.row) / 2)),
      });
  }
  return out;
}

export const headlandsBaysModel: Lesson = {
  id: 'headlands-bays-model',
  module: 'coasts',
  title: 'Headlands, bays and wave-cut platforms (geological time)',
  kind: 'emergent',
  geological: true,
  objective:
    'Explain how differential erosion of hard and soft rock forms headlands and bays on a discordant coast, and how cliff retreat leaves a wave-cut platform — watched over 6,000 years of simulated wave attack.',
  build: () => buildDiscordantCoastWorld(),
  stages: [
    {
      title: 'A straight coast of hard and soft rock',
      ks3: 'The coast starts straight, with cliffs about 25 m high. The rock comes in bands that reach the sea side by side: hard chalk and limestone, then soft clay, then hard rock again. Waves come in from the east.',
      gcse: 'A discordant coastline: bands of resistant rock (chalk, limestone) and less resistant rock (clay) run at right angles to the coast, as at Swanage in Dorset. Waves 2 m high with an 8-second period arrive from the east. The geology overlay shows the rock at the surface.',
      enter: (ctx) => ctx.geo(1),
      camera: 'top',
      overlay: 'geology',
      labels: (ctx) => coastLabels(ctx, { rocks: true }),
    },
    {
      title: 'Soft rock wears back faster',
      ks3: 'Waves hit the cliffs, hurling pebbles at them and forcing air into cracks. The soft clay wears away faster than the hard chalk, so the coast starts to go in and out. (2,000 years.)',
      gcse: 'Hydraulic action and abrasion erode the cliff foot; the undercut cliff collapses (mass movement) and the debris is removed by the waves. The less resistant clay retreats faster: differential erosion. In the model, wave power reaching each cliff cell lowers it at a rate set by rock strength; over-steep cliffs collapse.',
      enter: (ctx) => ctx.geo(2000),
      camera: 'top',
      overlay: 'none',
      predict: 'What shape will the coast become if this carries on?',
      labels: (ctx) => coastLabels(ctx, { landforms: true }),
    },
    {
      title: 'Headlands and bays',
      ks3: 'After 6,000 years the soft clay has been worn back into curved bays. The hard rock sticks out as headlands. The bays are more sheltered, so the waves there are weaker and sand can collect.',
      gcse: 'Headlands of resistant rock project between bays eroded in the less resistant rock. As the bays deepen, wave refraction concentrates energy on the headlands and spreads it out in the bays, so headlands become the focus of erosion and bays become sites of deposition. The model does not bend waves; it measures how much of the open sea each cliff faces and the angle the waves strike it at, which already makes the bays more sheltered.',
      enter: (ctx) => ctx.geo(4000),
      camera: 'top',
      overlay: 'none',
      labels: (ctx) => coastLabels(ctx, { landforms: true, energy: true }),
    },
    {
      title: 'Wave-cut platforms',
      ks3: 'As the cliffs were worn back, they left a flat shelf of rock at their foot, just under the sea. This is a wave-cut platform. It makes the waves break further out, so the cliff behind it wears back more slowly.',
      gcse: 'Erosion is concentrated between high and low tide at the cliff foot, cutting a wave-cut notch; the overhang collapses and the cliff retreats, leaving a gently sloping wave-cut platform. As the platform widens, waves break and lose energy before reaching the cliff, so retreat slows (in the model, shallow water within three cells of the cliff weakens the waves).',
      camera: 'oblique',
      overlay: 'none',
      labels: (ctx) => coastLabels(ctx, { landforms: true, platform: true }),
    },
  ],
  exam: {
    question: 'Explain how headlands and bays form. (4 marks)',
    marks: 4,
    model:
      'Headlands and bays form on a discordant coastline where bands of resistant and less resistant rock meet the sea at right angles (1). The less resistant rock is eroded faster by hydraulic action and abrasion, forming bays (1). The resistant rock is left jutting out as headlands (1). Wave refraction then concentrates energy on the headlands, while the sheltered bays become sites of deposition, forming beaches (1).',
  },
  misconception: {
    wrong: 'Bays are where the sea is strongest.',
    right: 'Bays form where the rock is weakest. Once formed, they are sheltered: waves bend onto the headlands, which take the most energy.',
  },
};
