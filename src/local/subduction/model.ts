/**
 * Guided local model (spec E9 / G3): a subduction-zone cross-section. Schematic geometry from a few
 * physical relations, not a geodynamic simulation:
 *   - the oceanic slab bends at the trench and descends at the dip angle δ;
 *   - magma forms where the slab reaches ~100 km depth (water released into the mantle wedge lowers
 *     its melting point), so the volcanic arc sits a horizontal distance 100 km / tan δ inboard of
 *     the trench (steep slabs ⇒ arcs close to the trench);
 *   - earthquakes (Wadati–Benioff zone) lie along the top of the slab, from the surface down to
 *     ~660 km, frequent shallow and sparse deep;
 *   - over time t the oceanic plate advances by v·t towards the trench (markers move with it).
 * Units: km (x to the right = towards the overriding plate, z down = depth).
 */
export interface SubductionParams {
  /** Convergence (mm/yr). */
  convergenceMmYr: number;
  /** Slab dip below ~50 km (degrees). */
  dipDeg: number;
  overriding: 'continental' | 'oceanic';
}

export interface Pt {
  x: number;
  z: number;
}

export interface SubductionGeometry {
  trenchX: number;
  trenchDepthKm: number;
  /** Slab top surface from the trench down to 660 km (polyline). */
  slabTop: Pt[];
  slabBottom: Pt[];
  /** Horizontal distance trench → arc (km) and arc x. */
  arcDistanceKm: number;
  arcX: number;
  /** Melt source in the mantle wedge (above the slab at 100 km depth). */
  melt: Pt;
  /** Earthquake foci (deterministic). */
  quakes: (Pt & { mag: number })[];
  /** Overriding crust thickness (km). */
  crustKm: number;
}

export const SLAB_THICK_KM = 80;
export const MELT_DEPTH_KM = 100;
export const MAX_QUAKE_DEPTH_KM = 660;

/** Slab top depth below the trench: a smooth bend from 0 to dip over the first 50 km of depth. */
function slabTopAt(p: SubductionParams, dx: number): number {
  // Curvature: dip grows linearly from ~8° at the trench to δ by 60 km horizontal distance.
  const d0 = (8 * Math.PI) / 180;
  const d1 = (p.dipDeg * Math.PI) / 180;
  const L = 60;
  if (dx <= 0) return 0;
  if (dx < L) return dx * Math.tan(d0) + ((Math.tan(d1) - Math.tan(d0)) * dx * dx) / (2 * L);
  const zL = L * Math.tan(d0) + ((Math.tan(d1) - Math.tan(d0)) * L) / 2;
  return zL + (dx - L) * Math.tan(d1);
}

/** Horizontal distance from the trench at which the slab top reaches depth z (km). */
export function slabXAtDepth(p: SubductionParams, z: number): number {
  let lo = 0;
  let hi = 3000;
  for (let k = 0; k < 60; k++) {
    const mid = (lo + hi) / 2;
    if (slabTopAt(p, mid) < z) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

function hash(k: number): number {
  let h = Math.imul(k ^ 0x9e3779b9, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function subductionGeometry(p: SubductionParams, trenchX = 0): SubductionGeometry {
  const slabTop: Pt[] = [];
  const slabBottom: Pt[] = [];
  const xEnd = slabXAtDepth(p, MAX_QUAKE_DEPTH_KM);
  const N = 80;
  const nrm = (dx: number): [number, number] => {
    const e = 0.5;
    const s = (slabTopAt(p, dx + e) - slabTopAt(p, dx - e)) / (2 * e);
    const l = Math.hypot(1, s);
    return [-s / l, 1 / l]; // normal pointing down-left (into the slab)
  };
  for (let k = 0; k <= N; k++) {
    const dx = (k / N) * xEnd;
    const z = slabTopAt(p, dx);
    slabTop.push({ x: trenchX + dx, z });
    const [nx, nz] = nrm(dx);
    slabBottom.push({ x: trenchX + dx + nx * SLAB_THICK_KM, z: z + nz * SLAB_THICK_KM });
  }
  const arcDistanceKm = slabXAtDepth(p, MELT_DEPTH_KM);
  // Benioff zone: quake density falls with depth; jittered a little within the slab top layer.
  const quakes: (Pt & { mag: number })[] = [];
  for (let k = 0; k < 90; k++) {
    const u = hash(k + 1);
    const depth = MAX_QUAKE_DEPTH_KM * Math.pow(u, 2.2) + 2; // shallow-heavy
    const dx = slabXAtDepth(p, depth);
    const off = (hash(k + 101) - 0.2) * 18;
    const [nx, nz] = nrm(dx);
    quakes.push({ x: trenchX + dx + nx * off, z: depth + nz * off, mag: 4 + 4 * hash(k + 201) * (depth < 70 ? 1 : 0.7) });
  }
  return {
    trenchX,
    trenchDepthKm: p.overriding === 'continental' ? 7 : 9,
    slabTop,
    slabBottom,
    arcDistanceKm,
    arcX: trenchX + arcDistanceKm,
    melt: { x: trenchX + arcDistanceKm, z: MELT_DEPTH_KM - 15 },
    quakes,
    crustKm: p.overriding === 'continental' ? 35 : 8,
  };
}
