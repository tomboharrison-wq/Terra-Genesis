import { refreshExposed, type WorldState } from '../engine/world';
import { MATERIALS, LOOSE_REPOSE_DEG } from './materials';

/**
 * Generation-time slope settling: apply the simulator's own dry stability rules (rockfall above
 * each lithology's cliff angle, loose sediment above its angle of repose) until the terrain is
 * stable, so a new world starts in equilibrium with its physics instead of collapsing on the
 * first step. Exactly conservative (bedrock → talus, pairwise talus transfers).
 * Returns the number of passes used.
 */
export function settleSlopes(w: WorldState, maxPasses = 300): number {
  const W = w.width;
  const H = w.height;
  const cs = w.cellSizeM;
  const b = w.bedrockElevationM;
  const loose = w.looseSedimentThicknessM;
  const tanCliff = new Float32Array(256);
  for (const m of MATERIALS) tanCliff[m.id] = Math.tan((m.cliffDeg * Math.PI) / 180);
  const tanLoose = Math.tan((LOOSE_REPOSE_DEG * Math.PI) / 180);
  const z = new Float32Array(W * H);
  const NB = [1, -1, W, -W];
  let pass = 0;
  for (; pass < maxPasses; pass++) {
    let moved = 0;
    for (let i = 0; i < z.length; i++) z[i] = b[i] + loose[i];
    // Rockfall: over-steep bedrock breaks into talus that stays on the cell (then slides).
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        let low = b[i];
        if (x > 0) low = Math.min(low, b[i - 1]);
        if (x < W - 1) low = Math.min(low, b[i + 1]);
        if (y > 0) low = Math.min(low, b[i - W]);
        if (y < H - 1) low = Math.min(low, b[i + W]);
        const excess = b[i] - low - cs * tanCliff[w.materialId[i]];
        if (excess > 1e-3) {
          const nb = Math.fround(b[i] - 0.5 * excess);
          loose[i] += b[i] - nb;
          b[i] = nb;
          refreshExposed(w, i);
          moved++;
        }
      }
    // Talus slides (Gauss–Seidel pairwise transfers).
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        for (const d of NB) {
          if ((d === 1 && x === W - 1) || (d === -1 && x === 0) || (d === W && y === H - 1) || (d === -W && y === 0)) continue;
          const j = i + d;
          const zi = b[i] + loose[i];
          const zj = b[j] + loose[j];
          const excess = zi - zj - cs * tanLoose;
          if (excess <= 1e-3 || loose[i] <= 0) continue;
          const amt = Math.min(0.5 * excess, loose[i]);
          loose[i] -= amt;
          loose[j] += amt;
          moved++;
        }
      }
    if (moved === 0) break;
  }
  return pass;
}
