/**
 * Guided local model (spec G3 "Meander: faster outer flow/lateral erosion + reduced inner-bank
 * energy/deposition; progressive neck and eventual cutoff"). Plan view of a meandering river.
 *
 * The channel centre line is a sine-generated curve (Langbein & Leopold 1966) — the shape real
 * meanders take: its direction θ(s) = ω sin(2π s / M) along the channel (s = distance along it,
 * M = meander length). As the outer banks are eroded and the inner banks built out, the maximum
 * angle ω grows, the bends tighten and the neck of a loop narrows (a uniform curve self-touches near
 * ω ≈ 2.2 rad); here the middle bend grows fastest. When a neck is narrower than the channel the river cuts through it (usually in a
 * flood): the channel straightens there and the abandoned loop becomes an oxbow lake, which later
 * silts up into a meander scar. Down-valley migration and channel width are fixed for clarity.
 * Units: metres. x down-valley, y across the valley.
 */
export interface Pt {
  x: number;
  y: number;
}

export const MEANDER_LENGTH_M = 1000;
export const CHANNEL_WIDTH_M = 40;
const LOOPS = 4;
const STEPS_PER_LOOP = 160;

/**
 * Centre line for growth stage q (0 … 1+). The middle bend grows fastest (real meanders do not all
 * grow at once): ω(s) = ω₀ + (ω_mid − ω₀)·exp(−((s − s_mid)/(0.6 M))²), with ω₀ = 0.3 + 0.8 q and
 * ω_mid = 0.4 + 1.8 q, so only the middle loop's neck closes.
 */
export function meanderCurve(q: number): Pt[] {
  const pts: Pt[] = [{ x: 0, y: 0 }];
  const n = LOOPS * STEPS_PER_LOOP;
  const ds = MEANDER_LENGTH_M / STEPS_PER_LOOP;
  const w0 = 0.3 + 0.8 * q;
  const wm = 0.4 + 1.8 * q;
  const sMid = 2 * MEANDER_LENGTH_M;
  let x = 0;
  let y = 0;
  for (let k = 0; k < n; k++) {
    const s = (k + 0.5) * ds;
    const omega = w0 + (wm - w0) * Math.exp(-(((s - sMid) / (0.6 * MEANDER_LENGTH_M)) ** 2));
    const th = omega * Math.sin((2 * Math.PI * s) / MEANDER_LENGTH_M);
    x += ds * Math.cos(th);
    y += ds * Math.sin(th);
    pts.push({ x, y });
  }
  return pts;
}

/** Sinuosity = channel length / straight down-valley distance. */
export function sinuosity(pts: Pt[]): number {
  let len = 0;
  for (let k = 1; k < pts.length; k++) len += Math.hypot(pts[k].x - pts[k - 1].x, pts[k].y - pts[k - 1].y);
  const a = pts[0];
  const b = pts[pts.length - 1];
  return len / Math.max(1e-9, Math.hypot(b.x - a.x, b.y - a.y));
}

/**
 * Narrowest neck of the middle loop: the closest approach of the channel to itself between points
 * 0.3 … 1.0 meander lengths apart along the channel, searched around the middle bend.
 */
export function neck(pts: Pt[]): { widthM: number; i: number; j: number } {
  const lo = Math.round(0.3 * STEPS_PER_LOOP);
  const hi = STEPS_PER_LOOP;
  let best = { widthM: Infinity, i: 0, j: 0 };
  const from = Math.round(1.4 * STEPS_PER_LOOP);
  const to = Math.round(2.2 * STEPS_PER_LOOP);
  for (let i = from; i < to; i++)
    for (let j = i + lo; j <= Math.min(pts.length - 1, i + hi); j++) {
      const d = Math.hypot(pts[j].x - pts[i].x, pts[j].y - pts[i].y);
      if (d < best.widthM) best = { widthM: d, i, j };
    }
  return best;
}

export interface MeanderState {
  /** Channel centre line now. */
  channel: Pt[];
  /** Abandoned loop (oxbow lake) after a cutoff, as a closed outline; null before. */
  oxbow: Pt[] | null;
  /** 0 = open water … 1 = silted up into a meander scar. */
  oxbowInfill: number;
  sinuosity: number;
  neckM: number;
  /** Ends of the narrowest neck on the channel (before a cutoff), for labelling. */
  neckA: Pt | null;
  neckB: Pt | null;
  cutoff: boolean;
}

/** Growth stage q at which the middle neck narrows to the channel width (cutoff). */
export const CUTOFF_Q = (() => {
  let lo = 0.3;
  let hi = 1.5;
  for (let k = 0; k < 40; k++) {
    const m = (lo + hi) / 2;
    if (neck(meanderCurve(m)).widthM > CHANNEL_WIDTH_M) lo = m;
    else hi = m;
  }
  return (lo + hi) / 2;
})();

/**
 * Stage parameter p: 0 … 1 bends grow (to the cutoff stage); 1 … 2 after the cutoff the
 * oxbow silts up (infill 0 → 1).
 */
export function meanderAt(p: number): MeanderState {
  const grow = Math.min(1, Math.max(0, p));
  const pts = meanderCurve(CUTOFF_Q * grow);
  const nk = neck(pts);
  if (p < 1)
    return {
      channel: pts,
      oxbow: null,
      oxbowInfill: 0,
      sinuosity: sinuosity(pts),
      neckM: nk.widthM,
      neckA: pts[nk.i],
      neckB: pts[nk.j],
      cutoff: false,
    };
  // Cutoff: the river flows straight across the neck; the loop between i and j is abandoned.
  const channel = [...pts.slice(0, nk.i + 1), ...pts.slice(nk.j)];
  const oxbow = pts.slice(nk.i, nk.j + 1);
  return {
    channel,
    oxbow,
    oxbowInfill: Math.min(1, Math.max(0, p - 1)),
    sinuosity: sinuosity(channel),
    neckM: 0,
    neckA: null,
    neckB: null,
    cutoff: true,
  };
}

/** Bank cross-section across a bend (m): outer river cliff steep, inner slip-off slope gentle with a point bar. */
export function bendSection(): {
  bed: { x: number; z: number }[];
  water: number;
  thalwegX: number;
} {
  const W = CHANNEL_WIDTH_M;
  const bed: { x: number; z: number }[] = [];
  for (let k = 0; k <= 40; k++) {
    const x = (k / 40) * W; // 0 = inner bank … W = outer bank
    // Deepest near the outer bank (thalweg at 0.8 W): shallow point bar inside, steep cliff outside.
    const u = x / W;
    const z = u < 0.8 ? -3 * Math.pow(u / 0.8, 1.6) : -3 * (1 - Math.pow((u - 0.8) / 0.2, 3));
    bed.push({ x, z });
  }
  return {
    bed: [{ x: -8, z: 1.5 }, { x: 0, z: 0.4 }, ...bed, { x: W, z: 3.5 }, { x: W + 8, z: 3.5 }],
    water: 0.6,
    thalwegX: 0.8 * W,
  };
}
