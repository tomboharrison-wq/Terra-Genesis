import { refreshExposed, STRATA_BOUNDS, STRATA_NONE, type WorldState } from '../../engine/world';
import type { CellRect } from '../../utils/rect';
import { settleLoose } from './tephra';

/**
 * Caldera collapse (spec E10: "a separate structural process"): after a big eruption empties the
 * magma chamber, the roof above it drops in as a piston bounded by a ring fault.
 * Every cell whose centre lies within radius R of the centre subsides by depth d — bedrock, the
 * rock layers in it and the soil on top move down together (the volume removed is exactly
 * n·cs²·d, the space the emptied chamber left). The ring-fault walls stay as steep as the rock
 * allows; loose material on them slides to its angle of repose. A closed caldera floor then
 * collects rain as a crater lake (the water model does that, nothing is added here).
 */
export interface CalderaOptions {
  xM: number;
  yM: number;
  radiusM: number;
  depthM: number;
}

export interface CalderaResult {
  rect: CellRect;
  cells: number;
  /** Ground volume that dropped away (m³). */
  volumeM3: number;
}

export function caldera(w: WorldState, surface: Float32Array, o: CalderaOptions, beforeModify?: (r: CellRect) => void): CalderaResult {
  const W = w.width;
  const H = w.height;
  const cs = w.cellSizeM;
  const cx = o.xM / cs;
  const cy = o.yM / cs;
  const rc = o.radiusM / cs;
  const rect: CellRect = {
    x0: Math.max(0, Math.floor(cx - rc - 2)),
    y0: Math.max(0, Math.floor(cy - rc - 2)),
    x1: Math.min(W, Math.ceil(cx + rc + 3)),
    y1: Math.min(H, Math.ceil(cy + rc + 3)),
  };
  beforeModify?.(rect);
  const b = w.bedrockElevationM;
  let cells = 0;
  let vol = 0;
  for (let y = rect.y0; y < rect.y1; y++)
    for (let x = rect.x0; x < rect.x1; x++) {
      if (Math.hypot(x - cx, y - cy) > rc) continue;
      const i = y * W + x;
      const nb = Math.fround(b[i] - o.depthM);
      const dz = nb - b[i];
      b[i] = nb;
      for (let k = 0; k < STRATA_BOUNDS; k++) {
        const ix = i * STRATA_BOUNDS + k;
        if (w.strataBoundsM[ix] !== STRATA_NONE) w.strataBoundsM[ix] += dz;
      }
      refreshExposed(w, i);
      surface[i] = b[i] + w.looseSedimentThicknessM[i];
      vol -= dz * cs * cs;
      cells++;
    }
  settleLoose(w, surface, rect);
  return { rect, cells, volumeM3: vol };
}
