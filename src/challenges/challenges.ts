import type { GenerateOptions } from '../terrain/generate';
import { MM_PER_H, type WorldState } from '../engine/world';

/**
 * Challenges (spec F6): goals scored only from the simulated world, from reproducible seeded starts,
 * with a stated success calculation. Every metric below is a sum or maximum over real world arrays
 * compared with the state at the start of the challenge.
 */

/** What a metric reads (Engine satisfies it). */
export interface ChallengeSource {
  world: WorldState;
  surface: Float32Array;
  water: { ledger: { seaOut: number } };
}

/** State captured when a challenge starts. */
export interface Baseline {
  startSimS: number;
  surface: Float32Array;
  /** 1 where the ground was below sea level at the start. */
  sea: Uint8Array;
  /** 1 on the cells a challenge is about (e.g. the plateau top). */
  zone: Uint8Array;
  /** Samples of cumulative water delivered to the sea (simulated time, m³). */
  seaOut: { t: number; v: number }[];
}

export interface Progress {
  value: number;
  target: number;
  unit: string;
  /** Plain-language reading, e.g. "12.4 of 20 m³/s". */
  text: string;
  pass: boolean;
}

export interface ChallengeDef {
  id: string;
  title: string;
  brief: string;
  /** How success is calculated, shown to the player. */
  rule: string;
  /** Simulated time allowed (s), or null when time does not matter. */
  timeLimitS: number | null;
  setup: GenerateOptions;
  /** Cells the challenge measures (default: none). */
  zone?(w: WorldState, surface: Float32Array): Uint8Array;
  measure(s: ChallengeSource, b: Baseline): Progress;
}

export function makeBaseline(s: ChallengeSource, def: ChallengeDef): Baseline {
  const w = s.world;
  const n = w.width * w.height;
  const sea = new Uint8Array(n);
  for (let i = 0; i < n; i++) sea[i] = s.surface[i] < w.seaLevelM ? 1 : 0;
  return {
    startSimS: w.simTimeSeconds,
    surface: s.surface.slice(),
    sea,
    zone: def.zone ? def.zone(w, s.surface) : new Uint8Array(n),
    seaOut: [{ t: w.simTimeSeconds, v: s.water.ledger.seaOut }],
  };
}

// ---------- metrics (pure, tested) ----------

/** Mean flow into the sea (m³/s) over the last `windowS` of samples, or 0 before a full window has passed. */
export function seaInflowRate(samples: { t: number; v: number }[], windowS: number): number {
  if (samples.length < 2) return 0;
  const last = samples[samples.length - 1];
  if (last.t - samples[0].t < windowS) return 0;
  let k = samples.length - 1;
  while (k > 0 && last.t - samples[k].t < windowS) k--;
  const first = samples[k];
  return (last.v - first.v) / Math.max(1e-9, last.t - first.t);
}

/** Ground built up (m³) on cells that were sea at the start. */
export function raisedOnStartSea(b: Baseline, surface: Float32Array, cellSizeM: number): number {
  let v = 0;
  for (let i = 0; i < surface.length; i++) if (b.sea[i]) v += Math.max(0, surface[i] - b.surface[i]);
  return v * cellSizeM * cellSizeM;
}

/** New land: area (m²) of start-sea cells now above sea, and the highest of them above sea (m). */
export function newLand(b: Baseline, surface: Float32Array, w: WorldState): { areaM2: number; heightM: number } {
  let n = 0;
  let top = 0;
  for (let i = 0; i < surface.length; i++)
    if (b.sea[i] && surface[i] > w.seaLevelM) {
      n++;
      top = Math.max(top, surface[i] - w.seaLevelM);
    }
  return { areaM2: n * w.cellSizeM * w.cellSizeM, heightM: top };
}

/** Ground removed (m³) from the zone cells since the start. */
export function loweredInZone(b: Baseline, surface: Float32Array, cellSizeM: number): number {
  let v = 0;
  for (let i = 0; i < surface.length; i++) if (b.zone[i]) v += Math.max(0, b.surface[i] - surface[i]);
  return v * cellSizeM * cellSizeM;
}

const fmtVol = (m3: number) => (m3 >= 1e6 ? `${(m3 / 1e6).toFixed(2)} million m³` : `${Math.round(m3).toLocaleString()} m³`);
const HOUR = 3600;
const DAY = 86400;

export const CHALLENGES: ChallengeDef[] = [
  {
    id: 'river-to-sea',
    title: 'River to the sea',
    brief:
      'The land is dry. Get a river flowing into the sea and keep it flowing. Use rain, springs and the terrain tools — but the rain may not be heavier than 20 mm/h.',
    rule: 'Pass: an average of at least 10 m³/s of river water reaches the sea over two simulated hours, with rain no heavier than 20 mm/h. Time allowed: 1 simulated day.',
    timeLimitS: DAY,
    setup: {
      presetId: 'river-delta',
      seed: 4101,
      size: 192,
      cellSizeM: 30,
      reliefM: 600,
      seaLevelM: 0,
      roughness: 0.45,
      rainMmH: 0,
      erosion: false,
      name: 'Challenge: river to the sea',
    },
    measure: (s, b) => {
      const rate = seaInflowRate(b.seaOut, 2 * HOUR);
      const rainOk = s.world.water.rainMPerS <= 20 * MM_PER_H + 1e-12;
      return {
        value: rate,
        target: 10,
        unit: 'm³/s',
        text: `${rate.toFixed(1)} of 10 m³/s reaching the sea (2-hour average)${rainOk ? '' : ' — rain is over 20 mm/h, lower it to count'}`,
        pass: rainOk && rate >= 10,
      };
    },
  },
  {
    id: 'delta',
    title: 'Build a delta',
    brief:
      'Erosion is on but it is not raining. Rivers carry sediment to the coast — set the weather (and use any tool) so they build a delta: new ground on what was the sea floor.',
    rule: 'Pass: at least 500,000 m³ of new ground built up on cells that were sea at the start. Time allowed: 5 simulated days.',
    timeLimitS: 5 * DAY,
    setup: {
      presetId: 'river-delta',
      seed: 4102,
      size: 192,
      cellSizeM: 30,
      reliefM: 600,
      seaLevelM: 0,
      roughness: 0.45,
      rainMmH: 0,
      erosion: true,
      speedup: 300,
      name: 'Challenge: build a delta',
    },
    measure: (s, b) => {
      const v = raisedOnStartSea(b, s.surface, s.world.cellSizeM);
      return {
        value: v,
        target: 5e5,
        unit: 'm³',
        text: `${fmtVol(v)} of 500,000 m³ deposited in the sea`,
        pass: v >= 5e5,
      };
    },
  },
  {
    id: 'island',
    title: 'Make a volcanic island',
    brief: 'Open sea, 60 m deep. Use the Volcano tool to raise a new island: at least 0.1 km² of land, standing 30 m above the waves.',
    rule: 'Pass: cells that were sea at the start now hold at least 0.1 km² of land, and the highest of them is at least 30 m above sea level. No time limit.',
    timeLimitS: null,
    setup: {
      presetId: 'flat',
      seed: 4103,
      size: 160,
      cellSizeM: 30,
      reliefM: 0,
      seaLevelM: 70,
      roughness: 0,
      name: 'Challenge: volcanic island',
    },
    measure: (s, b) => {
      const l = newLand(b, s.surface, s.world);
      const a = l.areaM2 / 1e6;
      return {
        value: Math.min(a / 0.1, l.heightM / 30),
        target: 1,
        unit: '',
        text: `${a.toFixed(3)} of 0.1 km² new land · highest ${l.heightM.toFixed(0)} of 30 m above sea`,
        pass: a >= 0.1 && l.heightM >= 30,
      };
    },
  },
  {
    id: 'plateau',
    title: 'Wear down the plateau',
    brief: 'A hard cap rock protects this dry plateau. Use rain, erosion and time (and any other tool) to remove rock and soil from the plateau top.',
    rule: 'Pass: at least 100 million m³ of rock and soil removed from the plateau top (cells above 60 % of the relief at the start) — washed away, or collapsed from the cliff edges when the rocks are soaked. Time allowed: 10 simulated days.',
    timeLimitS: 10 * DAY,
    setup: {
      presetId: 'plateau',
      seed: 4104,
      size: 192,
      cellSizeM: 25,
      reliefM: 400,
      seaLevelM: -100,
      roughness: 0.35,
      rainMmH: 0,
      erosion: true,
      speedup: 1000,
      name: 'Challenge: wear down the plateau',
    },
    zone: (w, z) => {
      const zone = new Uint8Array(z.length);
      for (let i = 0; i < z.length; i++) zone[i] = z[i] >= 0.6 * w.meta.reliefM ? 1 : 0;
      return zone;
    },
    measure: (s, b) => {
      const v = loweredInZone(b, s.surface, s.world.cellSizeM);
      return {
        value: v,
        target: 1e8,
        unit: 'm³',
        text: `${fmtVol(v)} of 100 million m³ removed from the plateau top`,
        pass: v >= 1e8,
      };
    },
  },
];

export function challengeById(id: string): ChallengeDef | undefined {
  return CHALLENGES.find((c) => c.id === id);
}
