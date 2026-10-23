import type { WorldState } from '../../engine/world';
import type { CellRect } from '../../utils/rect';
import { LOOSE_REPOSE_DEG } from '../../terrain/materials';

/**
 * Tephra (fragmental deposits) from explosive eruptions (spec E10). Teaching model, instantaneous fallout.
 *
 * Magma rate V̇ (dense-rock m³/s) → bulk deposit volume × BULK_FACTOR (deposit ≈ 1000 kg/m³ vs magma 2600).
 * Plume height (Mastin et al. 2009, all eruptions):  H[km] = 2.00 · V̇^0.241.
 * Split: coarse cinder / ballistic fraction f_c = clamp(0.6 − 0.03·H, 0.15, 0.6) (weaker columns drop more
 *   near the vent); the rest falls from the plume.
 * Cinder: ballistic ring, thickness ∝ (r/r₀)·exp(−r/r₀), r₀ = 60 m — most clasts land a little way from
 *   the vent, so a rim builds round a crater; the pile then avalanches to the angle
 *   of repose (33°), making steep straight-sided cones with a summit crater.
 * Fall: exponential thinning with distance (Pyle 1989) on elliptical isopachs stretched by the wind:
 *   thickness ∝ exp(−ρ),  ρ = √((u/L_u|d)² + (v/L)²),  u downwind, v crosswind,
 *   L = 150 m × H[km] (half-thickness distance grows with column height),
 *   downwind L_d = L·e, upwind L_u = L/e, elongation e = 1 + U/(5 m/s) for high-level wind U.
 * Each footprint is normalised to unit volume (numerically over a window, or analytically
 *   ∫ = π L (L_d + L_u) for large plumes); the share falling beyond the map edge is ledgered as lost.
 * Deposits are loose sediment (erodible); plants are buried (cover × max(0, 1 − d/0.5 m)).
 * Not modelled: grain sizes, fall time, pyroclastic flows, welding into tuff.
 */
export type EruptionStyle = 'lava' | 'explosive' | 'mixed';

export const BULK_FACTOR = 2.6;
export const CINDER_R0_M = 60;
export const FALL_L_PER_KM = 150;

export function plumeHeightKm(dreM3PerS: number): number {
  return dreM3PerS > 0 ? 2.0 * Math.pow(dreM3PerS, 0.241) : 0;
}

export function coarseFraction(hKm: number): number {
  return Math.max(0.15, Math.min(0.6, 0.6 - 0.03 * hKm));
}

/** Volume fractions per map cell (index + share) and the share that lands off the map. */
export interface Footprint {
  idx: Int32Array;
  share: Float64Array;
  offMap: number;
}

/**
 * Footprint of an exponential elliptical kernel centred on cell (cx, cy): e-folding lengths
 * Ld downwind, Lu upwind, Lc crosswind (m); wind blowing TOWARD bearing `toDeg`.
 */
export function footprint(w: WorldState, cx: number, cy: number, Ld: number, Lu: number, Lc: number, toDeg: number, ring = false): Footprint {
  const W = w.width;
  const H = w.height;
  const cs = w.cellSizeM;
  const a = (toDeg * Math.PI) / 180;
  const dx = Math.sin(a); // downwind unit vector (x east, y north)
  const dy = Math.cos(a);
  const Lmax = Math.max(Ld, Lu, Lc);
  const k = (px: number, py: number) => {
    const u = px * dx + py * dy;
    const v = -px * dy + py * dx;
    const uu = u / (u >= 0 ? Ld : Lu);
    const vv = v / Lc;
    const rho = Math.sqrt(uu * uu + vv * vv);
    return ring ? rho * Math.exp(-rho) : Math.exp(-rho);
  };
  const reach = Math.ceil((10 * Lmax) / cs);
  const idx: number[] = [];
  const wts: number[] = [];
  let total = 0;
  let on = 0;
  if (reach <= 300) {
    // Numerical normalisation over the whole kernel window (on and off the map).
    for (let j = -reach; j <= reach; j++)
      for (let i = -reach; i <= reach; i++) {
        const kv = k(i * cs, j * cs);
        if (kv < 1e-9) continue;
        total += kv;
        const x = cx + i;
        const y = cy + j;
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        idx.push(y * W + x);
        wts.push(kv);
        on += kv;
      }
  } else {
    total = ((ring ? 2 : 1) * Math.PI * Lc * (Ld + Lu)) / (cs * cs);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const kv = k((x - cx) * cs, (y - cy) * cs);
        if (kv < 1e-9) continue;
        idx.push(y * W + x);
        wts.push(kv);
        on += kv;
      }
    if (on > total) total = on; // grid sum can exceed the integral slightly at coarse cells
  }
  const share = new Float64Array(wts.length);
  for (let n = 0; n < wts.length; n++) share[n] = wts[n] / total;
  return { idx: Int32Array.from(idx), share, offMap: Math.max(0, 1 - on / total) };
}

export interface TephraResult {
  depositedM3: number;
  offMapM3: number;
  rect: CellRect | null;
}

/**
 * Lay `bulkM3` of tephra on the map with footprint f. Returns what landed and where. Thin ash on a
 * thick float32 sediment column can be below its resolution: the part that did not register is kept
 * per cell in `residual` (m, float64) and added to that cell's next deposit, so nothing is lost.
 */
export function depositTephra(w: WorldState, surface: Float32Array, f: Footprint, bulkM3: number, residual: Float64Array): TephraResult {
  const A = w.cellSizeM * w.cellSizeM;
  const W = w.width;
  let dep = 0;
  let r: CellRect | null = null;
  for (let n = 0; n < f.idx.length; n++) {
    const i = f.idx[n];
    const d = (bulkM3 * f.share[n]) / A + residual[i];
    if (d <= 0) {
      residual[i] = d;
      continue;
    }
    const before = w.looseSedimentThicknessM[i];
    const nl = Math.fround(before + d);
    const added = nl - before;
    residual[i] = d - added;
    w.looseSedimentThicknessM[i] = nl;
    w.tephraM[i] = Math.min(nl, w.tephraM[i] + added);
    w.vegCover[i] *= Math.max(0, 1 - added / 0.5);
    surface[i] = w.bedrockElevationM[i] + nl;
    dep += added * A;
    if (added > 1e-4) {
      const x = i % W;
      const y = (i / W) | 0;
      if (!r) r = { x0: x, y0: y, x1: x + 1, y1: y + 1 };
      else {
        r.x0 = Math.min(r.x0, x);
        r.y0 = Math.min(r.y0, y);
        r.x1 = Math.max(r.x1, x + 1);
        r.y1 = Math.max(r.y1, y + 1);
      }
    }
  }
  return { depositedM3: dep, offMapM3: bulkM3 * f.offMap, rect: r };
}

/**
 * Let loose sediment in a rect slide to its angle of repose (pairwise, exactly conservative,
 * Gauss–Seidel, at most maxPasses). Tephra marks move with the material. Returns the touched rect.
 */
export function settleLoose(w: WorldState, surface: Float32Array, rect: CellRect, maxPasses = 40): CellRect {
  const W = w.width;
  const H = w.height;
  const cs = w.cellSizeM;
  const b = w.bedrockElevationM;
  const loose = w.looseSedimentThicknessM;
  const teph = w.tephraM;
  const tanR = Math.tan((LOOSE_REPOSE_DEG * Math.PI) / 180);
  let x0 = Math.max(0, rect.x0 - 1);
  let y0 = Math.max(0, rect.y0 - 1);
  let x1 = Math.min(W, rect.x1 + 1);
  let y1 = Math.min(H, rect.y1 + 1);
  const DX = [1, -1, 0, 0];
  const DY = [0, 0, 1, -1];
  for (let pass = 0; pass < maxPasses; pass++) {
    let moved = 0;
    for (let y = y0; y < y1; y++)
      for (let x = x0; x < x1; x++) {
        const i = y * W + x;
        for (let k = 0; k < 4; k++) {
          const xn = x + DX[k];
          const yn = y + DY[k];
          if (xn < 0 || yn < 0 || xn >= W || yn >= H) continue;
          const j = yn * W + xn;
          const excess = b[i] + loose[i] - (b[j] + loose[j]) - cs * tanR;
          if (excess <= 1e-3 || loose[i] <= 0) continue;
          const amt = Math.min(0.5 * excess, loose[i]);
          const li = Math.fround(loose[i] - amt);
          const moved1 = loose[i] - li;
          const tShare = loose[i] > 0 ? (teph[i] / loose[i]) * moved1 : 0;
          loose[i] = li;
          loose[j] = Math.fround(loose[j] + moved1);
          teph[i] = Math.max(0, Math.min(loose[i], teph[i] - tShare));
          teph[j] = Math.min(loose[j], teph[j] + tShare);
          moved++;
          if (xn < x0) x0 = xn;
          if (yn < y0) y0 = yn;
          if (xn + 1 > x1) x1 = xn + 1;
          if (yn + 1 > y1) y1 = yn + 1;
        }
      }
    if (moved === 0) break;
  }
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) surface[y * W + x] = b[y * W + x] + loose[y * W + x];
  return { x0, y0, x1, y1 };
}
