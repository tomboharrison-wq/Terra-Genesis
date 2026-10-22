/**
 * Guided local model: rotational slump of a cohesive cliff in 2D cross-section (spec E4, G3).
 *
 * Geometry: ground profile g(x) — flat cliff top at height H for x ≤ 0, a straight face at
 * angle β down to the toe at x_t = H / tan β, flat ground (z = 0) beyond. x points seaward.
 *
 * Stability: circular slip surfaces, ordinary method of slices (Fellenius):
 *   FoS = Σ [c′·l + (W cos α − u·l) tan φ′] / Σ W sin α,   u = r_u · γ · h
 * where α is the base inclination, sin α = (x_c − x)/R (positive where the base dips seaward).
 * with r_u (pore-pressure ratio) = 0.4 × saturation. The critical surface is the minimum-FoS
 * circle from a grid search over entry/exit points and radius.
 *
 * Motion (only if FoS < 1): the block between ground and arc rotates rigidly about the circle
 * centre (it slides along the arc; its top tilts back towards the scarp). Rotation stops when
 * the driving moment arm has shrunk so that FoS·arm₀/arm(θ) ≥ 1 (capped at 30°). Material
 * carried past the exit point becomes a toe lobe of equal area on the ground in front.
 * This is a teaching approximation, not a geotechnical design tool.
 */

export interface SlumpParams {
  heightM: number;
  faceDeg: number;
  cohesionKPa: number;
  frictionDeg: number;
  unitWeightKNm3: number;
  /** 0 = dry, 1 = fully saturated. */
  saturation: number;
  /** Cross-sectional area of slumped debris resting against the toe (m² per metre of cliff). */
  toeDebrisM2?: number;
}

export interface Circle {
  xc: number;
  zc: number;
  r: number;
  xIn: number;
  xOut: number;
}

export interface Pt {
  x: number;
  z: number;
}

export interface SlumpResult {
  params: SlumpParams;
  critical: Circle | null;
  fos: number;
  failed: boolean;
  /** Rotation at rest (radians, counter-clockwise = downslope). */
  thetaFinal: number;
}

export const SOIL_PRESETS: Record<string, Omit<SlumpParams, 'heightM' | 'faceDeg' | 'saturation'> & { label: string }> = {
  // Indicative effective-stress strengths of intact material (teaching values).
  clay: { label: 'Stiff clay (e.g. London Clay)', cohesionKPa: 20, frictionDeg: 22, unitWeightKNm3: 19 },
  till: { label: 'Glacial till (e.g. Holderness)', cohesionKPa: 12, frictionDeg: 30, unitWeightKNm3: 20 },
  sand: { label: 'Weak sandstone / sand', cohesionKPa: 6, frictionDeg: 34, unitWeightKNm3: 19 },
};

/**
 * Toe debris apron: flat-topped at height h against the face, then sloping seaward at
 * tan(φ/2) to the ground. Area h²/2 · (1/tan β + 1/s) = toeDebrisM2.
 */
export function debrisWedge(p: SlumpParams): { h: number; x0: number; xt: number; x1: number } | null {
  const A = p.toeDebrisM2 ?? 0;
  if (A <= 0) return null;
  const tb = Math.tan((p.faceDeg * Math.PI) / 180);
  const s = Math.tan(((p.frictionDeg / 2) * Math.PI) / 180);
  const h = Math.min(p.heightM, Math.sqrt((2 * A) / (1 / tb + 1 / s)));
  const xt = p.heightM / tb;
  return { h, x0: xt - h / tb, xt, x1: xt + h / s };
}

export function ground(p: SlumpParams, x: number): number {
  const xt = p.heightM / Math.tan((p.faceDeg * Math.PI) / 180);
  const face = x <= 0 ? p.heightM : x >= xt ? 0 : p.heightM * (1 - x / xt);
  const w = debrisWedge(p);
  if (!w) return face;
  const apron = x <= w.xt ? w.h : x < w.x1 ? w.h * (1 - (x - w.xt) / (w.x1 - w.xt)) : 0;
  return Math.max(face, apron);
}

/** Profile breakpoints (where ground() has kinks). */
function breakpoints(p: SlumpParams): number[] {
  const w = debrisWedge(p);
  return w ? [0, w.x0, w.xt, w.x1] : [0, toeX(p)];
}

export function toeX(p: SlumpParams): number {
  return p.heightM / Math.tan((p.faceDeg * Math.PI) / 180);
}

/** Lower arc elevation at x (NaN outside the circle). */
export function arcZ(c: Circle, x: number): number {
  const dx = x - c.xc;
  const q = c.r * c.r - dx * dx;
  return q < 0 ? NaN : c.zc - Math.sqrt(q);
}

const SLICES = 40;

/** Factor of safety of a circle, or Infinity if it is not a valid slip surface. */
export function factorOfSafety(p: SlumpParams, c: Circle): number {
  const b = (c.xOut - c.xIn) / SLICES;
  const tanPhi = Math.tan((p.frictionDeg * Math.PI) / 180);
  const ru = 0.4 * Math.min(1, Math.max(0, p.saturation));
  let resist = 0;
  let drive = 0;
  for (let k = 0; k < SLICES; k++) {
    const x = c.xIn + (k + 0.5) * b;
    const base = arcZ(c, x);
    const top = ground(p, x);
    if (!Number.isFinite(base) || base > top + 1e-6) return Infinity;
    const h = top - base;
    const W = p.unitWeightKNm3 * h * b;
    const sinA = (c.xc - x) / c.r; // slope descends toward +x: soil left of the centre drives
    const cosA = Math.sqrt(Math.max(1e-6, 1 - sinA * sinA));
    const l = b / cosA;
    const u = ru * p.unitWeightKNm3 * h;
    resist += p.cohesionKPa * l + Math.max(0, W * cosA - u * l) * tanPhi;
    drive += W * sinA;
  }
  return drive > 1e-9 ? resist / drive : Infinity;
}

/** Circle through (xIn, g(xIn)) and (xOut, g(xOut)) with radius r, centre above the chord. */
export function circleThrough(p: SlumpParams, xIn: number, xOut: number, r: number): Circle | null {
  const ax = xIn;
  const az = ground(p, xIn);
  const bx = xOut;
  const bz = ground(p, xOut);
  const mx = (ax + bx) / 2;
  const mz = (az + bz) / 2;
  const dx = bx - ax;
  const dz = bz - az;
  const chord = Math.hypot(dx, dz);
  if (r < chord / 2 + 1e-6) return null;
  const hgt = Math.sqrt(r * r - (chord / 2) ** 2);
  // Unit normal to the chord pointing "up-left" (towards the cliff interior, above).
  let nx = -dz / chord;
  let nz = dx / chord;
  if (nz < 0) {
    nx = -nx;
    nz = -nz;
  }
  return { xc: mx + nx * hgt, zc: mz + nz * hgt, r, xIn, xOut };
}

/** Grid search for the minimum-FoS circle. */
export function criticalCircle(p: SlumpParams): { circle: Circle | null; fos: number } {
  const H = p.heightM;
  const xt = toeX(p);
  const apron = debrisWedge(p);
  const reach = xt + 0.6 * H + (apron ? apron.x1 - apron.xt : 0);
  let best: Circle | null = null;
  let bestF = Infinity;
  const NI = 30;
  const NO = 24;
  const NR = 24;
  for (let a = 0; a < NI; a++) {
    const xIn = -1.5 * H + (a / (NI - 1)) * (1.5 * H + 0.8 * xt);
    for (let o = 0; o < NO; o++) {
      const xOut = Math.max(xIn + 0.2 * H, xt * 0.3) + (o / (NO - 1)) * reach;
      if (xOut <= xIn) continue;
      const chord = Math.hypot(xOut - xIn, ground(p, xOut) - ground(p, xIn));
      for (let k = 0; k < NR; k++) {
        const r = (chord / 2) * (1.02 + (k / (NR - 1)) * 2.5);
        const c = circleThrough(p, xIn, xOut, r);
        if (!c) continue;
        const f = factorOfSafety(p, c);
        if (f < bestF) {
          bestF = f;
          best = c;
        }
      }
    }
  }
  return { circle: best, fos: bestF };
}

export function rotate(pt: Pt, c: Circle, theta: number): Pt {
  const dx = pt.x - c.xc;
  const dz = pt.z - c.zc;
  const co = Math.cos(theta);
  const si = Math.sin(theta);
  return { x: c.xc + dx * co - dz * si, z: c.zc + dx * si + dz * co };
}

/** Block polygon: ground surface from entry to exit, then the arc back to the entry. */
export function blockPolygon(p: SlumpParams, c: Circle, n = 60): Pt[] {
  const pts: Pt[] = [];
  const xs = [c.xIn, ...breakpoints(p).filter((x) => x > c.xIn && x < c.xOut).sort((a, b) => a - b), c.xOut];
  for (let k = 0; k < xs.length; k++) pts.push({ x: xs[k], z: ground(p, xs[k]) });
  for (let k = n - 1; k >= 1; k--) {
    const x = c.xIn + (k / n) * (c.xOut - c.xIn);
    pts.push({ x, z: arcZ(c, x) });
  }
  return pts;
}

export function polygonArea(pts: Pt[]): number {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    a += p.x * q.z - q.x * p.z;
  }
  return Math.abs(a) / 2;
}

/** Sutherland–Hodgman clip of a polygon to x ≤ xMax. */
export function clipLeft(pts: Pt[], xMax: number): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const ain = a.x <= xMax;
    const bin = b.x <= xMax;
    if (ain) out.push(a);
    if (ain !== bin) {
      const t = (xMax - a.x) / (b.x - a.x);
      out.push({ x: xMax, z: a.z + t * (b.z - a.z) });
    }
  }
  return out;
}

/** Horizontal moment arm of the block's weight about the circle centre (positive = driving). */
function arm(pts: Pt[], c: Circle): number {
  let a = 0;
  let cx = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    const cr = p.x * q.z - q.x * p.z;
    a += cr;
    cx += (p.x + q.x) * cr;
  }
  return c.xc - cx / (3 * a);
}

export function analyse(p: SlumpParams): SlumpResult {
  const { circle, fos } = criticalCircle(p);
  if (!circle || !Number.isFinite(fos)) return { params: p, critical: null, fos: Infinity, failed: false, thetaFinal: 0 };
  const failed = fos < 1;
  let thetaFinal = 0;
  if (failed) {
    const block = blockPolygon(p, circle);
    const a0 = arm(block, circle);
    for (let th = 0; th <= (30 * Math.PI) / 180; th += 0.002) {
      thetaFinal = th;
      const moved = block.map((q) => rotate(q, circle, th));
      const at = arm(moved, circle);
      if (at <= 0 || fos * (a0 / at) >= 1) break;
    }
  }
  return { params: p, critical: circle, fos, failed, thetaFinal };
}

export interface SlumpGeometry {
  /** Rigid block after rotation θ, clipped at the exit point. */
  block: Pt[];
  /** Toe lobe (closed polygon on the ground in front of the exit point). */
  lobe: Pt[];
  /** Exposed back scarp: arc segment vacated by the block. */
  scarp: Pt[];
  areaOriginal: number;
  areaBlock: number;
  areaLobe: number;
  /** Vertical drop of the crown (m). */
  crownDrop: number;
  /** Back-tilt of the block's top surface (degrees). */
  tiltDeg: number;
}

/** Geometry of the slump at rotation θ (0 … thetaFinal). */
export function slumpGeometry(p: SlumpParams, c: Circle, theta: number): SlumpGeometry {
  const original = blockPolygon(p, c);
  const moved = original.map((q) => rotate(q, c, theta));
  const xExit = c.xOut;
  const block = clipLeft(moved, xExit);
  const areaOriginal = polygonArea(original);
  const areaBlock = polygonArea(block);
  const areaLobe = Math.max(0, areaOriginal - areaBlock);
  // Lobe: thickness tapering linearly from h at the exit to 0 at exit + L, slope ~ φ/2.
  const s = Math.tan(((p.frictionDeg / 2) * Math.PI) / 180);
  const L = areaLobe > 0 ? Math.sqrt((2 * areaLobe) / s) : 0;
  const h = s * L;
  const lobe: Pt[] = [];
  const NL = 24;
  if (areaLobe > 0) {
    for (let k = 0; k <= NL; k++) {
      const x = xExit + (k / NL) * L;
      lobe.push({ x, z: ground(p, x) + h * (1 - k / NL) });
    }
    for (let k = NL; k >= 0; k--) {
      const x = xExit + (k / NL) * L;
      lobe.push({ x, z: ground(p, x) });
    }
  }
  // Scarp: arc from the entry point to where the rotated crown now sits.
  const scarp: Pt[] = [];
  const NS = 16;
  for (let k = 0; k <= NS; k++) {
    const pt = rotate({ x: c.xIn, z: ground(p, c.xIn) }, c, (k / NS) * theta);
    scarp.push(pt);
  }
  const crown = rotate({ x: c.xIn, z: ground(p, c.xIn) }, c, theta);
  const topEnd = rotate({ x: Math.min(0, c.xOut), z: ground(p, Math.min(0, c.xOut)) }, c, theta);
  const tiltDeg = c.xIn < 0 ? (Math.atan2(topEnd.z - crown.z, topEnd.x - crown.x) * 180) / Math.PI : 0;
  return { block, lobe, scarp, areaOriginal, areaBlock, areaLobe, crownDrop: ground(p, c.xIn) - crown.z, tiltDeg };
}
