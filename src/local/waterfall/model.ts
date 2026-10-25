/**
 * Guided local model (spec G3 "Waterfall: differentiated bedrock → undercut → unsupported cap collapse →
 * retreat → gorge"). A long profile through a waterfall where a resistant cap rock lies over less
 * resistant rock. Kinematic teaching model with stated rates (not a calibrated simulation):
 *   - the soft rock behind the plunge pool is worn back at `undercutMPerYr` (hydraulic action and
 *     abrasion by swirling rocks), the hard cap 20× more slowly, so an overhang grows;
 *   - the overhang collapses once it is longer than `maxOverhangM` (the cap can no longer support
 *     itself); the fallen block lands in the plunge pool and the lip moves back upstream;
 *   - the plunge pool deepens towards a limit set by the fall height, d = 0.5 H (1 − e^(−t/τ));
 *   - the fall has retreated R(t); the steep-sided valley it leaves behind is a gorge of length R.
 * Units: metres, years (illustrative). x runs downstream; the fall starts at x = 0.
 */
export interface WaterfallParams {
  heightM: number;
  capThicknessM: number;
  undercutMPerYr: number;
  maxOverhangM: number;
}

export const WATERFALL_DEFAULTS: WaterfallParams = {
  heightM: 20,
  capThicknessM: 6,
  undercutMPerYr: 0.25,
  maxOverhangM: 8,
};

export interface Pt {
  x: number;
  z: number;
}

export interface WaterfallState {
  /** Lip of the hard cap (x, m): it moves upstream (negative) with each collapse. */
  lipX: number;
  /** Current overhang length (m). */
  overhangM: number;
  /** Total retreat = gorge length (m). */
  retreatM: number;
  collapses: number;
  /** Plunge pool depth below the gorge floor (m). */
  poolDepthM: number;
  /** Fallen blocks (centre x, size m), most recent last. */
  blocks: { x: number; size: number }[];
  /** True if a collapse happened within the last year (to highlight it). */
  justCollapsed: boolean;
}

/** State after `years`. Collapses happen whenever the overhang reaches its limit. */
export function waterfallAt(years: number, p: WaterfallParams = WATERFALL_DEFAULTS): WaterfallState {
  const capRate = p.undercutMPerYr / 20;
  const cycle = p.maxOverhangM / (p.undercutMPerYr - capRate); // years between collapses
  const collapses = Math.floor(Math.max(0, years) / cycle);
  const since = Math.max(0, years) - collapses * cycle;
  const lipX = -(collapses * p.maxOverhangM + capRate * years);
  const blocks: { x: number; size: number }[] = [];
  for (let k = 1; k <= collapses; k++) {
    // Each block falls just below the lip of its time; older ones are broken up and carried downstream.
    const lipAtK = -(k * p.maxOverhangM + capRate * k * cycle);
    const age = years - k * cycle;
    blocks.push({
      x: lipAtK + 3 + Math.min(40, age * 0.08),
      size: Math.max(0.8, p.capThicknessM * 0.9 * Math.exp(-age / 400)),
    });
  }
  return {
    lipX,
    overhangM: (p.undercutMPerYr - capRate) * since,
    retreatM: -lipX,
    collapses,
    poolDepthM: 0.5 * p.heightM * (1 - Math.exp(-Math.max(0, years) / 60)),
    blocks: blocks.slice(-4),
    justCollapsed: collapses > 0 && since < 1,
  };
}

export interface WaterfallGeometry {
  hard: Pt[];
  soft: Pt[];
  /** Water: upstream surface, the falling curtain, downstream surface (polylines). */
  waterUp: Pt[];
  curtain: Pt[];
  waterDown: Pt[];
  /** Gorge: the stretch the fall has retreated through (from the lip to the original position). */
  gorge: { x0: number; x1: number } | null;
  pool: Pt;
  state: WaterfallState;
}

export function waterfallGeometry(years: number, p: WaterfallParams = WATERFALL_DEFAULTS, xMin = -120, xMax = 60): WaterfallGeometry {
  const s = waterfallAt(years, p);
  const H = p.heightM;
  const hc = p.capThicknessM;
  const face = s.lipX - s.overhangM; // soft-rock face behind the overhang
  const poolX = s.lipX + 0.15 * H; // water lands just beyond the lip
  const poolW = 0.6 * H;
  const base = -0.9 * H;
  const hard: Pt[] = [
    { x: xMin, z: H },
    { x: s.lipX, z: H },
    { x: s.lipX, z: H - hc },
    { x: xMin, z: H - hc },
  ];
  const soft: Pt[] = [
    { x: xMin, z: H - hc },
    { x: face, z: H - hc },
    { x: face, z: 0.2 * H },
  ];
  // Plunge pool hollow (half-sine) in the gorge floor, then the floor runs downstream at z = 0.
  const n = 16;
  for (let k = 0; k <= n; k++) {
    const x = Math.max(face, poolX - poolW / 2) + (k / n) * poolW;
    const u = (x - (poolX - poolW / 2)) / poolW;
    soft.push({
      x,
      z: -s.poolDepthM * Math.sin(Math.PI * Math.min(1, Math.max(0, u))),
    });
  }
  soft.push({ x: xMax, z: 0 }, { x: xMax, z: base }, { x: xMin, z: base });
  const curtain: Pt[] = [];
  for (let k = 0; k <= 12; k++) {
    const t = k / 12;
    curtain.push({
      x: s.lipX + 0.15 * H * Math.sqrt(t),
      z: H + 0.6 - (H + 0.6) * t,
    });
  }
  return {
    hard,
    soft,
    waterUp: [
      { x: xMin, z: H + 0.8 },
      { x: s.lipX, z: H + 0.6 },
    ],
    curtain,
    waterDown: [
      { x: s.lipX + 0.15 * H, z: 0.5 },
      { x: xMax, z: 0.5 },
    ],
    gorge: s.retreatM > 1 ? { x0: s.lipX, x1: 0 } : null,
    pool: { x: poolX, z: -s.poolDepthM / 2 },
    state: s,
  };
}
