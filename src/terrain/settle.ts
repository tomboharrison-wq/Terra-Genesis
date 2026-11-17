import { refreshExposed, type WorldState } from '../engine/world';
import { MATERIALS, LOOSE_REPOSE_DEG } from './materials';

const SQRT2 = Math.SQRT2;

/**
 * Generation-time 8-neighbour isotropic slope settling: apply the simulator's dry stability rules
 * (rockfall above each lithology's cliff angle, loose sediment above its angle of repose) across
 * all 8 cardinal + diagonal neighbours until the terrain is stable, so a new world starts in
 * equilibrium with its physics without 4-neighbour diamond pyramid artifacts.
 * Exactly conservative (bedrock → talus, pairwise talus transfers).
 * Returns the number of passes used.
 */
export function settleSlopes(w: WorldState, maxPasses = 300): number {
  const W = w.width;
  const H = w.height;
  const cs = w.cellSizeM;
  const csDiag = cs * SQRT2;
  const b = w.bedrockElevationM;
  const loose = w.looseSedimentThicknessM;
  const tanCliff = new Float32Array(256);
  for (const m of MATERIALS) tanCliff[m.id] = Math.tan((m.cliffDeg * Math.PI) / 180);
  const tanLoose = Math.tan((LOOSE_REPOSE_DEG * Math.PI) / 180);
  const limCard = cs * tanLoose;
  const limDiag = csDiag * tanLoose;
  let pass = 0;
  for (; pass < maxPasses; pass++) {
    let moved = 0;
    // 1. Rockfall: over-steep bedrock breaks into talus that stays on the cell (then slides).
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        const bi = b[i];
        let lowCard = bi;
        if (x > 0 && b[i - 1] < lowCard) lowCard = b[i - 1];
        if (x < W - 1 && b[i + 1] < lowCard) lowCard = b[i + 1];
        if (y > 0 && b[i - W] < lowCard) lowCard = b[i - W];
        if (y < H - 1 && b[i + W] < lowCard) lowCard = b[i + W];
        let lowDiag = bi;
        if (x > 0 && y > 0 && b[i - W - 1] < lowDiag) lowDiag = b[i - W - 1];
        if (x < W - 1 && y > 0 && b[i - W + 1] < lowDiag) lowDiag = b[i - W + 1];
        if (x > 0 && y < H - 1 && b[i + W - 1] < lowDiag) lowDiag = b[i + W - 1];
        if (x < W - 1 && y < H - 1 && b[i + W + 1] < lowDiag) lowDiag = b[i + W + 1];
        const tc = tanCliff[w.materialId[i]];
        const exCard = bi - lowCard - cs * tc;
        const exDiag = (bi - lowDiag - csDiag * tc) / SQRT2;
        const excess = exCard >= exDiag ? exCard : exDiag;
        if (excess > 1e-3) {
          const nb = Math.fround(bi - 0.5 * excess);
          loose[i] += bi - nb;
          b[i] = nb;
          refreshExposed(w, i);
          moved++;
        }
      }
    }
    // 2. Talus slides (8-neighbour Gauss–Seidel pairwise transfers).
    const slide = (i: number, j: number, lim: number, weight: number) => {
      const zi = b[i] + loose[i];
      const zj = b[j] + loose[j];
      const excess = zi - zj - lim;
      if (excess <= 1e-3 || loose[i] <= 0) return;
      const amt = Math.min(weight * excess, loose[i]);
      loose[i] -= amt;
      loose[j] += amt;
      moved++;
    };
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (loose[i] <= 0) continue;
        if (x < W - 1) slide(i, i + 1, limCard, 0.45);
        if (x > 0) slide(i, i - 1, limCard, 0.45);
        if (y < H - 1) slide(i, i + W, limCard, 0.45);
        if (y > 0) slide(i, i - W, limCard, 0.45);
        if (x < W - 1 && y < H - 1) slide(i, i + W + 1, limDiag, 0.32);
        if (x > 0 && y < H - 1) slide(i, i + W - 1, limDiag, 0.32);
        if (x < W - 1 && y > 0) slide(i, i - W + 1, limDiag, 0.32);
        if (x > 0 && y > 0) slide(i, i - W - 1, limDiag, 0.32);
      }
    }
    if (moved === 0) break;
  }
  return pass;
}
