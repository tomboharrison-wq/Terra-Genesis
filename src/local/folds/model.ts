/**
 * Guided local model (spec E9 / G3): fold mountains from horizontal shortening of a layered pile.
 * Kinematic, two conserved quantities:
 *   - layer-parallel length (buckling): each layer's folded length equals its original length L₀, so
 *     with fold wavelength λ the amplitude A solves ∫₀ᴸ √(1 + (A·k·cos kx)²) dx = L₀, k = 2π/λ,
 *     L = L₀(1 − s) for shortening s;
 *   - area (rock is not created or destroyed): all boundaries share the fold shape (similar folds),
 *     so each layer's thickness becomes t·L₀/L — the pile thickens as it shortens.
 * Optional thrust: from s > 0.25 a 30° ramp through the centre; each layer is clipped into footwall
 *   and hanging-wall pieces and the hanging wall rides up the ramp over the footwall (rigid
 *   translation, area unchanged), taking up part of the shortening so the folds are gentler.
 * Optional erosion: a flat surface cuts the folds, exposing layer bands (old rock in anticline cores,
 *   young rock in synclines).
 * Units: km.
 */
export interface FoldParams {
  /** Shortening 0 … 0.6. */
  shortening: number;
  wavelengthKm: number;
  thrust: boolean;
  /** Erosion level as a fraction of the pile height (0 = none). */
  erosion: number;
}

export interface Pt {
  x: number;
  z: number;
}

export const L0_KM = 60;
export const LAYERS = [
  { name: 'Limestone', km: 1.2, colour: '#c9c2a8' },
  { name: 'Shale', km: 0.9, colour: '#7d7466' },
  { name: 'Sandstone', km: 1.4, colour: '#c4a26e' },
  { name: 'Mudstone', km: 0.8, colour: '#8e7f74' },
  { name: 'Old sandstone', km: 1.3, colour: '#a8865f' },
];
export const BASEMENT_KM = 3;

/** Arc length of A·sin(kx) over [0, L], Simpson's rule. */
function arcLength(A: number, k: number, L: number): number {
  const n = 400;
  const f = (x: number) => Math.sqrt(1 + (A * k * Math.cos(k * x)) ** 2);
  let s = f(0) + f(L);
  for (let i = 1; i < n; i++) s += (i % 2 ? 4 : 2) * f((i * L) / n);
  return (s * L) / (3 * n);
}

/** Fold amplitude (km) for which a sinusoid over length L has arc length L0. */
export function foldAmplitude(L0: number, L: number, wavelength: number): number {
  if (L >= L0) return 0;
  const k = (2 * Math.PI) / wavelength;
  let lo = 0;
  let hi = L0;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (arcLength(mid, k, L) < L0) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export interface FoldGeometry {
  lengthKm: number;
  amplitudeKm: number;
  thickening: number;
  /** Folded boundary curves (before any thrust), top of the youngest layer first. */
  boundaries: Pt[][];
  /** Polygon pieces per layer (top layer first): one piece, or two once a thrust cuts it. */
  layers: Pt[][][];
  /** Basement below the folded pile (follows its folded base down to z = 0), pieces like layers. */
  basement: Pt[][];
  /** Thrust trace (or null) and its slip (km). */
  thrust: Pt[] | null;
  thrustSlipKm: number;
  erosionZ: number | null;
  /** Fold crests (anticlines) and troughs (synclines) on the top surface. */
  anticlines: Pt[];
  synclines: Pt[];
}

/** Sutherland–Hodgman clip of a polygon to the half-plane side·(z − f(x)) ≥ 0, f linear. */
function clipHalf(poly: Pt[], f: (x: number) => number, side: 1 | -1): Pt[] {
  const out: Pt[] = [];
  const inside = (q: Pt) => side * (q.z - f(q.x)) >= 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const ia = inside(a);
    const ib = inside(b);
    if (ia) out.push(a);
    if (ia !== ib) {
      const ga = a.z - f(a.x);
      const gb = b.z - f(b.x);
      const t = ga / (ga - gb);
      out.push({ x: a.x + t * (b.x - a.x), z: a.z + t * (b.z - a.z) });
    }
  }
  return out;
}

export function foldGeometry(p: FoldParams): FoldGeometry {
  const s = Math.max(0, Math.min(0.6, p.shortening));
  const dip = Math.PI / 6;
  // A thrust (from 25 % shortening) takes up part of the shortening: the hanging wall rides up the
  // 30° ramp over the footwall, so the folds only need to account for the rest.
  const thrustOn = p.thrust && s > 0.25;
  const slip = thrustOn ? Math.min(8, (s - 0.25) * L0_KM * 0.6) : 0;
  const L = L0_KM * (1 - s);
  const Lpre = L + slip * Math.cos(dip); // folded length before thrusting
  const A = foldAmplitude(L0_KM, Lpre, p.wavelengthKm);
  const thick = L0_KM / Lpre;
  const k = (2 * Math.PI) / p.wavelengthKm;
  const phase = Math.PI / 2 - k * (Lpre / 2); // anticline crest at the centre
  const shape = (x: number) => A * Math.sin(k * x + phase);
  const N = 240;
  const totals = LAYERS.map((l) => l.km * thick);
  const tops: number[] = [];
  let acc = BASEMENT_KM * thick + totals.reduce((x, y) => x + y, 0);
  tops.push(acc);
  for (let i = 0; i < LAYERS.length; i++) {
    acc -= totals[i];
    tops.push(acc);
  }
  const boundaries: Pt[][] = tops.map((base) => {
    const pts: Pt[] = [];
    for (let j = 0; j <= N; j++) {
      const x = (j / N) * Lpre;
      pts.push({ x, z: base + shape(x) });
    }
    return pts;
  });
  // Thrust ramp rising towards +x from the base of the pile at the centre.
  const x0 = Lpre / 2 - 6;
  const zb = tops[LAYERS.length] - A - 0.5;
  const fault = (x: number) => zb + (x - x0) * Math.tan(dip);
  const dx = slip * Math.cos(dip);
  const dz = slip * Math.sin(dip);
  const cut = (poly: Pt[]): Pt[][] => {
    if (!thrustOn) return [poly];
    // Footwall (below the ramp) stays; hanging wall (above, to the west) moves up the ramp. Then
    // shift everything west by dx so the belt starts at x = 0 again (total length L).
    const foot = clipHalf(poly, fault, -1).map((q) => ({ x: q.x - dx, z: q.z }));
    const hang = clipHalf(poly, fault, 1).map((q) => ({ x: q.x, z: q.z + dz }));
    return [foot, hang].filter((q) => q.length > 2);
  };
  const layers: Pt[][][] = [];
  for (let i = 0; i < LAYERS.length; i++) layers.push(cut([...boundaries[i], ...[...boundaries[i + 1]].reverse()]));
  const basement = cut([...boundaries[LAYERS.length], { x: Lpre, z: 0 }, { x: 0, z: 0 }]);
  const anticlines: Pt[] = [];
  const synclines: Pt[] = [];
  if (A > 0.05)
    for (let j = 1; j < N; j++) {
      const a = boundaries[0][j - 1].z;
      const b = boundaries[0][j].z;
      const c = boundaries[0][j + 1].z;
      if (b > a && b >= c) anticlines.push(boundaries[0][j]);
      if (b < a && b <= c) synclines.push(boundaries[0][j]);
    }
  const erosionZ = p.erosion > 0 ? tops[0] + A - p.erosion * (2 * A + totals.reduce((x, y) => x + y, 0)) : null;
  return {
    lengthKm: L,
    amplitudeKm: A,
    thickening: thick,
    boundaries,
    layers,
    basement,
    thrust: thrustOn ? [{ x: x0 - dx, z: zb }, { x: x0 - dx + (tops[0] + A - zb) / Math.tan(dip), z: tops[0] + A }] : null,
    thrustSlipKm: slip,
    erosionZ,
    anticlines,
    synclines,
  };
}

/** Polygon area (shoelace), for conservation checks. */
export function polygonArea(pts: Pt[]): number {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    a += p.x * q.z - q.x * p.z;
  }
  return Math.abs(a) / 2;
}
