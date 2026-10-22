import type { WorldState } from '../engine/world';
import { clampRect, type CellRect } from '../utils/rect';

export type BrushKind = 'raise' | 'lower' | 'smooth' | 'flatten' | 'paint' | 'add-sediment' | 'remove-sediment';

export interface BrushParams {
  kind: BrushKind;
  radiusM: number;
  /**
   * raise/lower/add-sediment/remove-sediment: peak vertical rate in m/s.
   * smooth/flatten: relaxation rate in 1/s (fraction of the gap closed per second at centre).
   */
  rate: number;
  /** 0 = soft (cosine from centre), 1 = hard edge. */
  hardness: number;
  /** flatten: target surface elevation (m). */
  targetM?: number;
  /** paint: bedrock material id. */
  materialId?: number;
}

/** Called before cells in `rect` are modified so undo can capture originals. */
export type BeforeModify = (rect: CellRect) => void;

export function brushWeight(r: number, hardness: number): number {
  if (r >= 1) return 0;
  const h = Math.min(0.98, Math.max(0, hardness));
  if (r <= h) return 1;
  return 0.5 * (1 + Math.cos((Math.PI * (r - h)) / (1 - h)));
}

/**
 * Apply a signed surface elevation change to one cell under the physical edit rule:
 * gains add bedrock; losses remove loose sediment first, then bedrock.
 */
export function applySurfaceDelta(w: WorldState, i: number, dz: number): void {
  if (dz >= 0) {
    w.bedrockElevationM[i] += dz;
    return;
  }
  let loss = -dz;
  const sed = w.looseSedimentThicknessM[i];
  const fromSed = Math.min(sed, loss);
  w.looseSedimentThicknessM[i] = sed - fromSed;
  loss -= fromSed;
  if (loss > 0) w.bedrockElevationM[i] -= loss;
}

export function brushRect(w: WorldState, xM: number, yM: number, radiusM: number): CellRect | null {
  const cs = w.cellSizeM;
  return clampRect(
    {
      x0: Math.floor((xM - radiusM) / cs),
      y0: Math.floor((yM - radiusM) / cs),
      x1: Math.ceil((xM + radiusM) / cs) + 1,
      y1: Math.ceil((yM + radiusM) / cs) + 1,
    },
    w.width,
    w.height,
  );
}

/**
 * Apply one brush step for duration dt (s) centred at world (xM, yM).
 * `surface` is the derived surface cache; it is updated for modified cells.
 * Returns the modified cell rect, or null if nothing was touched.
 */
export function applyBrush(
  w: WorldState,
  surface: Float32Array,
  xM: number,
  yM: number,
  p: BrushParams,
  dt: number,
  beforeModify?: BeforeModify,
): CellRect | null {
  if (!(dt > 0) || !(p.radiusM > 0)) return null;
  const rect = brushRect(w, xM, yM, p.radiusM);
  if (!rect) return null;
  beforeModify?.(rect);
  const cs = w.cellSizeM;
  const W = w.width;
  const invR = 1 / p.radiusM;

  let avg: Float32Array | null = null;
  if (p.kind === 'smooth') avg = boxAverage(surface, W, w.height, rect, Math.max(1, Math.round((p.radiusM / cs) * 0.15)));

  for (let y = rect.y0; y < rect.y1; y++) {
    for (let x = rect.x0; x < rect.x1; x++) {
      const wgt = brushWeight(Math.hypot(x * cs - xM, y * cs - yM) * invR, p.hardness);
      if (wgt <= 0) continue;
      const i = y * W + x;
      switch (p.kind) {
        case 'raise':
          applySurfaceDelta(w, i, p.rate * dt * wgt);
          break;
        case 'lower':
          applySurfaceDelta(w, i, -p.rate * dt * wgt);
          break;
        case 'smooth': {
          const a = avg![(y - rect.y0) * (rect.x1 - rect.x0) + (x - rect.x0)];
          applySurfaceDelta(w, i, (a - surface[i]) * Math.min(1, p.rate * dt * wgt));
          break;
        }
        case 'flatten': {
          const target = p.targetM ?? surface[i];
          applySurfaceDelta(w, i, (target - surface[i]) * Math.min(1, p.rate * dt * wgt));
          break;
        }
        case 'paint':
          if (wgt >= 0.35 && p.materialId !== undefined) w.materialId[i] = p.materialId;
          break;
        case 'add-sediment':
          w.looseSedimentThicknessM[i] += p.rate * dt * wgt;
          break;
        case 'remove-sediment': {
          const s = w.looseSedimentThicknessM[i];
          w.looseSedimentThicknessM[i] = Math.max(0, s - p.rate * dt * wgt);
          break;
        }
      }
      surface[i] = w.bedrockElevationM[i] + w.looseSedimentThicknessM[i];
    }
  }
  return rect;
}

/** Box-filtered average of `src` over rect, kernel half-width k, clamped at map edges. */
function boxAverage(src: Float32Array, W: number, H: number, rect: CellRect, k: number): Float32Array {
  const rw = rect.x1 - rect.x0;
  const rh = rect.y1 - rect.y0;
  const out = new Float32Array(rw * rh);
  for (let y = rect.y0; y < rect.y1; y++) {
    for (let x = rect.x0; x < rect.x1; x++) {
      let sum = 0;
      let cnt = 0;
      const ya = Math.max(0, y - k);
      const yb = Math.min(H - 1, y + k);
      const xa = Math.max(0, x - k);
      const xb = Math.min(W - 1, x + k);
      for (let yy = ya; yy <= yb; yy++) {
        let j = yy * W + xa;
        for (let xx = xa; xx <= xb; xx++, j++) sum += src[j];
        cnt += xb - xa + 1;
      }
      out[(y - rect.y0) * rw + (x - rect.x0)] = sum / cnt;
    }
  }
  return out;
}
