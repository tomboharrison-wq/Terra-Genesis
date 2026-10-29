import { LandscapeEvolution, addGeoStats, emptyGeoStats, type GeoParams, type GeoStepStats } from './landscapeEvolution';
import { carve, migrate, type MeanderState } from './meander';

/** Migration sub-step and how often the channel is carved into the terrain (years). */
export const MIGRATION_STEP_YEARS = 4;
export const CARVE_EVERY_YEARS = 40;
/** Landscape steps while a meandering river is active (so drainage sees the moving channel). */
const MEANDER_LANDSCAPE_STEP = 100;

/**
 * Run geological time: the landscape model, plus the meandering lowland river when there is one
 * (it moves in short sub-steps and is carved into the terrain every few decades; its channel cells
 * are left to it, not to stream-power incision). Used by the engine and the Web Worker alike.
 */
export function runGeologic(geo: LandscapeEvolution, years: number, p: GeoParams, maxStepYears: number, meander: MeanderState | null): GeoStepStats {
  if (!meander) return geo.run(years, p, maxStepYears);
  const w = geo.w;
  const tot = emptyGeoStats();
  const fixed = new Uint8Array(w.width * w.height);
  let left = years;
  while (left > 1e-9) {
    const dt = Math.min(left, MEANDER_LANDSCAPE_STEP, maxStepYears);
    fixed.fill(0);
    for (const i of meander.mask) fixed[i] = 1;
    geo.fixed = fixed;
    addGeoStats(tot, geo.run(dt, p, dt));
    geo.fixed = null;
    let t = 0;
    while (t < dt - 1e-9) {
      const d = Math.min(MIGRATION_STEP_YEARS, dt - t);
      migrate(w, meander, d);
      t += d;
      meander.sinceCarve += d;
      if (meander.sinceCarve >= CARVE_EVERY_YEARS - 1e-9) {
        const c = carve(w, meander, meander.sinceCarve);
        meander.sinceCarve = 0;
        tot.supplied += c.suppliedM3;
        tot.bankEroded += c.cutM3;
        tot.pointBars += c.barM3;
        tot.overbank += c.overbankM3;
        // What the river still carries reaches the sea at its mouth (building a delta), or leaves the map.
        const mouth = mouthSeaCell(geo, meander);
        if (mouth >= 0) geo.depositAtSea(mouth, c.exportM3, tot);
        else tot.exported += c.exportM3;
      }
    }
    left -= dt;
  }
  tot.years = years;
  return tot;
}

/** The sea cell nearest the river's last centreline node (within 5 cells), or −1. */
function mouthSeaCell(geo: LandscapeEvolution, m: MeanderState): number {
  const w = geo.w;
  const W = w.width;
  const cx = Math.round(m.xs[m.xs.length - 1] / w.cellSizeM);
  const cy = Math.round(m.ys[m.ys.length - 1] / w.cellSizeM);
  let best = -1;
  let bd = Infinity;
  for (let dy = -5; dy <= 5; dy++)
    for (let dx = -5; dx <= 5; dx++) {
      const x = cx + dx;
      const y = cy + dy;
      if (x < 0 || y < 0 || x >= W || y >= w.height) continue;
      const i = y * W + x;
      if (w.bedrockElevationM[i] + w.looseSedimentThicknessM[i] >= w.seaLevelM) continue;
      const d = dx * dx + dy * dy;
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
  return best;
}
