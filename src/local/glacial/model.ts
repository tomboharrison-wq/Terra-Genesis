/**
 * Guided local models for glaciation lessons (spec G2 Glaciation, G3). Cross-sections with stated,
 * literature-based shape rules — teaching models, not ice-flow simulations:
 *
 * Glacial trough: valley cross-sections fit z = a·|x|^b. River valleys are V-shaped (b ≈ 1); glacial
 * troughs approach b ≈ 2 (parabolic, "U-shaped", e.g. Svensson 1959; Harbor 1992), because erosion is
 * fastest where ice is thickest and slides fastest (floor and lower walls). Stage g (0 … 1) moves b
 * from 1 to 2 and deepens the floor by up to 0.35 of the valley depth; spurs are truncated.
 * A tributary valley with less ice is deepened less, so when the ice melts its floor is left high
 * above the main valley floor: a hanging valley. Melting leaves the eroded rock as moraine.
 *
 * Corrie / arête: a cross-section through a ridge. Snow hollows on both sides grow into corries
 * by plucking at the back wall and abrasion of the floor under rotational ice movement; each corrie
 * back wall retreats into the ridge. When back walls from both sides meet, the knife-edge ridge
 * left between them is an arête. After the ice melts, a rock lip holds a small lake (tarn).
 * Units: metres.
 */
export interface Pt {
  x: number;
  z: number;
}

export const VALLEY_HALF_WIDTH_M = 1200;
export const VALLEY_DEPTH_M = 600;

/** Main valley cross-section at glacial stage g (0 = river V-valley, 1 = mature U-shaped trough). */
export function troughProfile(g: number, n = 80): Pt[] {
  const b = 1 + Math.min(1, Math.max(0, g));
  const deepen = 0.35 * VALLEY_DEPTH_M * Math.min(1, Math.max(0, g));
  const pts: Pt[] = [];
  for (let k = 0; k <= n; k++) {
    const x = -VALLEY_HALF_WIDTH_M + (2 * VALLEY_HALF_WIDTH_M * k) / n;
    const u = Math.abs(x) / VALLEY_HALF_WIDTH_M;
    // Valley walls rise to the plateau; the floor is lowered by `deepen` (less towards the rim).
    pts.push({ x, z: VALLEY_DEPTH_M * Math.pow(u, b) - deepen * (1 - u * u) });
  }
  return pts;
}

/** Shape exponent b of a profile (least squares on log z vs log |x| over the walls), for checks. */
export function profileExponent(pts: Pt[]): number {
  const zMin = Math.min(...pts.map((p) => p.z));
  let sx = 0;
  let sy = 0;
  let sxx = 0;
  let sxy = 0;
  let n = 0;
  for (const p of pts) {
    const u = Math.abs(p.x) / VALLEY_HALF_WIDTH_M;
    const h = (p.z - zMin) / (VALLEY_DEPTH_M - zMin);
    if (u < 0.15 || h <= 0.001) continue;
    sx += Math.log(u);
    sy += Math.log(h);
    sxx += Math.log(u) ** 2;
    sxy += Math.log(u) * Math.log(h);
    n++;
  }
  return (n * sxy - sx * sy) / (n * sxx - sx * sx);
}

/** Ice surface height (m) in the trough at stage g (fills to 85 % of the valley depth at the maximum). */
export const iceSurface = (g: number) => 0.85 * VALLEY_DEPTH_M * Math.min(1, g / 0.3);

/** Tributary floor height above the main floor after glaciation (hanging valley), m. */
export function hangingHeight(g: number): number {
  // Main floor deepened by up to 0.35 D; the tributary (thinner ice) by a quarter of that.
  const main = 0.35 * VALLEY_DEPTH_M * Math.min(1, Math.max(0, g));
  return main * 0.75;
}

export interface RidgeState {
  /** Ridge cross-section (left corrie side to right corrie side). */
  profile: Pt[];
  /** Width of the ridge crest between the two corrie back walls (m). */
  crestWidthM: number;
  /** Corrie floors' over-deepening behind the rock lip (m) — tarn depth after melting. */
  tarnDepthM: number;
  arete: boolean;
}

const RIDGE_HALF_M = 1500;
const RIDGE_HEIGHT_M = 700;

/** Ridge with corries cutting back from both sides at stage c (0 … 1). */
export function ridgeAt(c: number, n = 120): RidgeState {
  const s = Math.min(1, Math.max(0, c));
  // Back wall position from the centre: starts 900 m out, retreats to 30 m (a knife edge).
  const wall = 900 - 870 * s;
  const crest = RIDGE_HEIGHT_M - 60 * s; // the crest itself is lowered a little by frost shattering
  const hollowDepth = 40 + 160 * s; // over-deepened floor behind the lip
  const pts: Pt[] = [];
  for (let k = 0; k <= n; k++) {
    const x = -RIDGE_HALF_M + (2 * RIDGE_HALF_M * k) / n;
    const d = Math.abs(x);
    let z: number;
    if (d <= wall)
      z = crest - 0.15 * d; // ridge top between the back walls
    else {
      // Corrie: steep back wall, rounded over-deepened floor, then a rock lip and the valley below.
      const t = (d - wall) / 700;
      const backWall = crest - 0.15 * wall - Math.min(1, t * 2.2) * 420; // steep drop
      const floor = backWall - hollowDepth * Math.sin(Math.PI * Math.min(1, Math.max(0, (t - 0.35) / 0.5)));
      z = t < 0.35 ? backWall : t < 0.85 ? floor : backWall - Math.min(260, (t - 0.85) * 900);
    }
    pts.push({ x, z });
  }
  return {
    profile: pts,
    crestWidthM: 2 * wall,
    tarnDepthM: hollowDepth * 0.6,
    arete: 2 * wall < 100,
  };
}
