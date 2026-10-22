import { clamp } from '../utils/math';

/** Minimal heightfield view used for sampling/picking (surface elevation, metres). */
export interface HeightfieldView {
  width: number;
  height: number;
  cellSizeM: number;
  /** Surface elevation per cell, index y*width+x. */
  z: Float32Array;
}

/** Bilinear surface elevation at world position (metres), clamped to the map. */
export function sampleBilinear(hf: HeightfieldView, xM: number, yM: number): number {
  const fx = clamp(xM / hf.cellSizeM, 0, hf.width - 1);
  const fy = clamp(yM / hf.cellSizeM, 0, hf.height - 1);
  const x0 = Math.min(Math.floor(fx), hf.width - 2);
  const y0 = Math.min(Math.floor(fy), hf.height - 2);
  const tx = fx - x0;
  const ty = fy - y0;
  const i = y0 * hf.width + x0;
  const z = hf.z;
  const a = z[i] + (z[i + 1] - z[i]) * tx;
  const b = z[i + hf.width] + (z[i + hf.width + 1] - z[i + hf.width]) * tx;
  return a + (b - a) * ty;
}

/** Slope magnitude (dz/ds, dimensionless) at a cell using central differences. */
export function slopeAt(hf: HeightfieldView, x: number, y: number): number {
  const w = hf.width;
  const xl = x > 0 ? x - 1 : x;
  const xr = x < w - 1 ? x + 1 : x;
  const yd = y > 0 ? y - 1 : y;
  const yu = y < hf.height - 1 ? y + 1 : y;
  const dzdx = (hf.z[y * w + xr] - hf.z[y * w + xl]) / ((xr - xl) * hf.cellSizeM);
  const dzdy = (hf.z[yu * w + x] - hf.z[yd * w + x]) / ((yu - yd) * hf.cellSizeM);
  return Math.hypot(dzdx, dzdy);
}

export interface RayHit {
  xM: number;
  yM: number;
  zM: number;
  distance: number;
}

/**
 * Ray-march a world-space ray (x east, y north, z up) against the heightfield.
 * Coarse steps of half a cell, then bisection refinement. Returns null if no hit.
 */
export function raycastHeightfield(
  hf: HeightfieldView,
  origin: [number, number, number],
  dir: [number, number, number],
  maxDistance = 1e6,
): RayHit | null {
  const len = Math.hypot(dir[0], dir[1], dir[2]);
  if (len === 0) return null;
  const dx = dir[0] / len;
  const dy = dir[1] / len;
  const dz = dir[2] / len;
  const ex = (hf.width - 1) * hf.cellSizeM;
  const ey = (hf.height - 1) * hf.cellSizeM;

  // Clip ray to the map's XY box (slab method).
  let tMin = 0;
  let tMax = maxDistance;
  for (const [o, d, hi] of [
    [origin[0], dx, ex],
    [origin[1], dy, ey],
  ] as const) {
    if (Math.abs(d) < 1e-12) {
      if (o < 0 || o > hi) return null;
    } else {
      let t0 = (0 - o) / d;
      let t1 = (hi - o) / d;
      if (t0 > t1) [t0, t1] = [t1, t0];
      tMin = Math.max(tMin, t0);
      tMax = Math.min(tMax, t1);
      if (tMin > tMax) return null;
    }
  }

  const above = (t: number) =>
    origin[2] + dz * t - sampleBilinear(hf, origin[0] + dx * t, origin[1] + dy * t);
  const step = hf.cellSizeM * 0.5;
  let tPrev = tMin;
  let hPrev = above(tPrev);
  if (hPrev <= 0) {
    return { xM: origin[0] + dx * tMin, yM: origin[1] + dy * tMin, zM: origin[2] + dz * tMin, distance: tMin };
  }
  for (let t = tMin + step; t <= tMax + step; t += step) {
    const tc = Math.min(t, tMax);
    const h = above(tc);
    if (h <= 0) {
      let a = tPrev;
      let b = tc;
      for (let k = 0; k < 24; k++) {
        const m = 0.5 * (a + b);
        if (above(m) > 0) a = m;
        else b = m;
      }
      const th = 0.5 * (a + b);
      const xM = origin[0] + dx * th;
      const yM = origin[1] + dy * th;
      return { xM, yM, zM: sampleBilinear(hf, xM, yM), distance: th };
    }
    tPrev = tc;
    hPrev = h;
    if (tc >= tMax) break;
  }
  return null;
}
