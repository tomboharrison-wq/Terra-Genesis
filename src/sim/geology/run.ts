import { LandscapeEvolution, addGeoStats, emptyGeoStats, type GeoParams, type GeoStepStats } from './landscapeEvolution';
import { carve, migrate, type MeanderState } from './meander';
import type { GlacierSim } from '../glacier/glacierSim';
import type { ClimateField } from '../climate/climate';
import { YEAR_S } from '../climate/climate';
import { computeSurface } from '../../engine/world';

/** Glaciers in geological time: the engine's (or the worker's) glacier model with its climate field and surface cache. */
export interface GlacialGeo {
  sim: GlacierSim;
  climate: ClimateField;
  surface: Float32Array;
  /** Moraine left by the ice so far (m per cell), accumulated across runs. */
  moraine: Float32Array;
  /** Ground eroded by the ice so far (m per cell), accumulated across runs. */
  eroded: Float32Array;
}

/** Geological step while glaciers are active (years), and the ice-time spell run per step. */
export const GLACIAL_STEP_YEARS = 2000;
export const ICE_SPELL_YEARS = 3;
/** Keep running ice spells (up to this much ice time) while the ice volume is still changing by > 2 % per spell. */
const ICE_SETTLE_MAX_YEARS = 400;
/** Share of glacial debris carried off by meltwater rivers rather than left as moraine. */
export const MELTWATER_SHARE = 0.95;

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
export function runGeologic(geo: LandscapeEvolution, years: number, p: GeoParams, maxStepYears: number, meander: MeanderState | null, glacial: GlacialGeo | null = null): GeoStepStats {
  if (glacial && glacial.sim.params.enabled && geo.w.climate.enabled) return runGlacial(geo, years, p, maxStepYears, glacial);
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

/**
 * Geological time with glaciers. Ice reaches a near-steady state for a given bed within a few
 * centuries, while the bed changes over tens of thousands of years, so each geological step of up to
 * GLACIAL_STEP_YEARS runs the ice model for a short spell (ICE_SPELL_YEARS of ice time, longer while the
 * ice is still building up or melting) and applies its abrasion for the whole step (erosion factor =
 * step ÷ ice time run). Rivers do not cut down under ice; hillslope processes (frost weathering,
 * creep, rockfall of over-steep walls) carry on everywhere.
 */
function runGlacial(geo: LandscapeEvolution, years: number, p: GeoParams, maxStepYears: number, g: GlacialGeo): GeoStepStats {
  const w = geo.w;
  const n = w.width * w.height;
  const tot = emptyGeoStats();
  const fixed = new Uint8Array(n);
  let left = years;
  const outwash = new Float64Array(n);
  const sedimentIn = new Float64Array(n);
  const A = w.cellSizeM * w.cellSizeM;
  g.sim.outwash = outwash;
  g.sim.meltwaterShare = MELTWATER_SHARE;
  g.sim.moraine = g.moraine;
  g.sim.erosionRecord = g.eroded;
  while (left > 1e-9) {
    const dt = Math.min(left, GLACIAL_STEP_YEARS, maxStepYears);
    computeSurface(w, g.surface);
    g.climate.compute(w, g.surface);
    // One ice spell carries the whole step's abrasion (erosion factor = step ÷ spell); while the ice is
    // still building up or melting (volume changing > 2 % per spell), more spells without extra erosion.
    const before = g.sim.ledger.eroded;
    const spell = Math.min(ICE_SPELL_YEARS, dt);
    let v0 = g.sim.iceVolume();
    g.sim.erosionFactor = dt / spell;
    g.sim.run(spell * YEAR_S, spell * YEAR_S);
    g.sim.erosionFactor = 0;
    for (let iceYears = spell; iceYears < ICE_SETTLE_MAX_YEARS; iceYears += spell) {
      const v1 = g.sim.iceVolume();
      if (Math.abs(v1 - v0) <= 0.02 * Math.max(v0, v1) + 1) break;
      v0 = v1;
      g.sim.run(spell * YEAR_S, spell * YEAR_S);
    }
    g.sim.erosionFactor = 1;
    tot.glacialEroded += g.sim.ledger.eroded - before;
    // Meltwater carries the outwash into the rivers; the landscape step routes it (lakes, sea, off the map).
    for (let i = 0; i < n; i++) {
      sedimentIn[i] = outwash[i] * A;
      tot.outwash += sedimentIn[i];
    }
    outwash.fill(0);
    geo.sedimentIn = sedimentIn;
    for (let i = 0; i < n; i++) fixed[i] = w.iceThicknessM[i] > 1 ? 1 : 0;
    geo.fixed = fixed;
    geo.ice = fixed;
    addGeoStats(tot, geo.run(dt, p, dt));
    geo.fixed = null;
    geo.ice = null;
    geo.sedimentIn = null;
    left -= dt;
  }
  g.sim.outwash = null;
  g.sim.meltwaterShare = 0;
  g.sim.moraine = null;
  g.sim.erosionRecord = null;
  computeSurface(w, g.surface);
  tot.years = years;
  return tot;
}
