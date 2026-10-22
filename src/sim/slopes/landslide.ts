import { refreshExposed, type WorldState } from '../../engine/world';
import { clampRect, expandRect, type CellRect } from '../../utils/rect';
import { MATERIALS } from '../../terrain/materials';
import { TAN_LOOSE } from '../sediment/sedimentSim';

export interface LandslideOptions {
  /** Trigger centre (world metres) and radius of the destabilised zone. */
  xM: number;
  yM: number;
  radiusM: number;
  /** Factor applied to tan(stable angle) inside the zone (0.5 = strongly weakened). */
  weakening: number;
  /** Relaxation passes (each moves a fraction of the excess). */
  iterations: number;
}

export interface LandslideResult {
  /** Cells that may have changed (for dirty marking / undo capture). */
  rect: CellRect;
  /** Bedrock converted to debris inside the zone (m³). */
  failedRockM3: number;
  /** Net volume displaced: total surface lowering over the affected area (m³). */
  movedM3: number;
}

/**
 * Landslide event (spec E4, E12): a saturated, weakened zone fails. Inside the zone bedrock
 * steeper than the weakened cliff angle breaks into debris, and loose material above the
 * weakened angle of repose slides downhill; debris may run out beyond the zone (where normal,
 * unweakened angles apply). Pairwise transfers ⇒ solids are conserved exactly.
 * Generalised mass movement on the heightfield; the curved-slip rotational slump with a
 * back-tilted block needs local 3D geometry and is a separate model (M04-C04).
 */
export function triggerLandslide(w: WorldState, surface: Float32Array, o: LandslideOptions, beforeModify?: (r: CellRect) => void): LandslideResult {
  const W = w.width;
  const H = w.height;
  const cs = w.cellSizeM;
  const A = cs * cs;
  const rCells = o.radiusM / cs;
  const cx = o.xM / cs;
  const cy = o.yM / cs;
  const rect = clampRect(expandRect({ x0: Math.floor(cx - rCells), y0: Math.floor(cy - rCells), x1: Math.ceil(cx + rCells) + 1, y1: Math.ceil(cy + rCells) + 1 }, Math.ceil(rCells * 2) + 2), W, H);
  if (!rect) return { rect: { x0: 0, y0: 0, x1: 0, y1: 0 }, failedRockM3: 0, movedM3: 0 };
  beforeModify?.(rect);
  const z0 = new Float32Array((rect.x1 - rect.x0) * (rect.y1 - rect.y0));
  for (let y = rect.y0; y < rect.y1; y++) for (let x = rect.x0; x < rect.x1; x++) z0[(y - rect.y0) * (rect.x1 - rect.x0) + (x - rect.x0)] = surface[y * W + x];
  const b = w.bedrockElevationM;
  const loose = w.looseSedimentThicknessM;
  const tanCliff = MATERIALS.map((m) => Math.tan((m.cliffDeg * Math.PI) / 180));
  const rw = rect.x1 - rect.x0;
  const zone = new Float32Array(rw * (rect.y1 - rect.y0));
  for (let y = rect.y0; y < rect.y1; y++)
    for (let x = rect.x0; x < rect.x1; x++) {
      const d = Math.hypot(x - cx, y - cy) / Math.max(rCells, 1e-6);
      zone[(y - rect.y0) * rw + (x - rect.x0)] = d < 1 ? 1 : 0;
    }
  const factor = (x: number, y: number) => (zone[(y - rect.y0) * rw + (x - rect.x0)] ? o.weakening : 1);
  let failed = 0;
  const NB = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  for (let it = 0; it < o.iterations; it++) {
    // Rock failure inside the zone.
    for (let y = rect.y0; y < rect.y1; y++)
      for (let x = rect.x0; x < rect.x1; x++) {
        if (!zone[(y - rect.y0) * rw + (x - rect.x0)]) continue;
        const i = y * W + x;
        let low = b[i];
        for (const [dx, dy] of NB) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < W && ny < H) low = Math.min(low, b[ny * W + nx]);
        }
        const excess = b[i] - low - cs * (tanCliff[w.materialId[i]] ?? 1) * o.weakening;
        if (excess > 0) {
          const nb = Math.fround(b[i] - 0.25 * excess);
          const act = b[i] - nb;
          b[i] = nb;
          loose[i] += act;
          surface[i] = b[i] + loose[i];
          failed += act;
          refreshExposed(w, i);
        }
      }
    // Debris slides: Gauss–Seidel pairwise transfers (each exactly conservative).
    for (let y = rect.y0; y < rect.y1; y++)
      for (let x = rect.x0; x < rect.x1; x++) {
        const i = y * W + x;
        for (const [dx, dy] of NB) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < rect.x0 || ny < rect.y0 || nx >= rect.x1 || ny >= rect.y1) continue;
          const j = ny * W + nx;
          const dz = surface[i] - surface[j];
          if (dz <= 0 || loose[i] <= 0) continue;
          const excess = dz - cs * TAN_LOOSE * factor(x, y);
          if (excess <= 0) continue;
          const amt = Math.min(0.25 * excess, loose[i]);
          loose[i] -= amt;
          loose[j] += amt;
          surface[i] = b[i] + loose[i];
          surface[j] = b[j] + loose[j];
        }
      }
  }
  let lowered = 0;
  for (let y = rect.y0; y < rect.y1; y++)
    for (let x = rect.x0; x < rect.x1; x++) lowered += Math.max(0, z0[(y - rect.y0) * rw + (x - rect.x0)] - surface[y * W + x]);
  return { rect, failedRockM3: failed * A, movedM3: lowered * A };
}
