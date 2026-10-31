import { refreshExposed, type WorldState } from '../engine/world';
import { MATERIALS, LOOSE_REPOSE_DEG } from './materials';
import { WET_LOOSE_WEAKENING, WET_ROCK_WEAKENING } from '../sim/sediment/sedimentSim';

/**
 * Generation-time slope settling: apply the simulator's own stability rules for SATURATED ground
 * (rockfall above each lithology's wet cliff angle, loose sediment above its wet angle of repose —
 * the limits the sediment model uses in heavy rain) until the terrain is stable, so a new world
 * starts in equilibrium with its physics instead of collapsing on the first step or the first storm.
 * Real slopes have been soaked countless times; the ones that exist are those that survive it.
 * (Settling only to the dry limits made the first heavy rain fail ~90 million m³ of a plateau in an
 * hour, M04-C06.) Exactly conservative (bedrock → talus, pairwise talus transfers).
 * Returns the number of passes used.
 */
export function settleSlopes(w: WorldState, maxPasses = 300): number {
  const W = w.width;
  const H = w.height;
  const cs = w.cellSizeM;
  const b = w.bedrockElevationM;
  const loose = w.looseSedimentThicknessM;
  const tanCliff = new Float32Array(256);
  for (const m of MATERIALS) tanCliff[m.id] = Math.tan((m.cliffDeg * Math.PI) / 180) * (1 - WET_ROCK_WEAKENING);
  const tanLoose = Math.tan((LOOSE_REPOSE_DEG * Math.PI) / 180) * (1 - WET_LOOSE_WEAKENING);
  const z = new Float32Array(W * H);
  const NB = [1, -1, W, -W];
  let pass = 0;
  for (; pass < maxPasses; pass++) {
    let moved = 0;
    let largest = 0; // biggest single move this pass (m): stop once only millimetres are still moving
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
          largest = Math.max(largest, b[i] - nb);
          b[i] = nb;
          refreshExposed(w, i);
          moved++;
        }
      }
    // Talus slides (Gauss–Seidel pairwise transfers), sweeping in alternate directions each pass so
    // debris runs the length of a long slope in a few passes rather than one cell per pass.
    const fwd = pass % 2 === 0;
    for (let yy = 0; yy < H; yy++)
      for (let xx = 0; xx < W; xx++) {
        const y = fwd ? yy : H - 1 - yy;
        const x = fwd ? xx : W - 1 - xx;
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
          largest = Math.max(largest, amt);
          moved++;
        }
      }
    if (moved === 0 || largest < 0.005) break;
  }
  return pass;
}
