import { LandscapeEvolution, addGeoStats, emptyGeoStats, type GeoParams, type GeoStepStats } from './landscapeEvolution';
import { carve, migrate, type MeanderState } from './meander';
import type { GlacierSim } from '../glacier/glacierSim';
import type { CoastSim } from '../coast/coastSim';
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

/** Coasts in geological time: the engine's (or the worker's) coast model and surface cache. */
export interface CoastalGeo {
  sim: CoastSim;
  surface: Float32Array;
}

/**
 * Coast model rate in geological time: × this on its water-time cliffK (6e-11 m/s per W/m), so cliffs
 * of clay retreat ~0.3 m/yr and of chalk ~0.15 m/yr under 2 m, 8 s waves — the range measured on the
 * Dorset and Yorkshire coasts (fast Holderness clay reaches ~1–2 m/yr).
 */
export const COAST_GEO_RATE = 0.05;
/** Coast sub-step (years): a cell's worth of cliff is never worn back in a single step. */
export const COAST_STEP_YEARS = 10;
const COAST_LANDSCAPE_STEP = 50;
/** Shore-platform down-wearing at the shoreline for chalk (m/yr; Stephenson & Kirk measure ~1–2 mm/yr). */
export const PLATFORM_WEAR_M_YR = 0.002;
/** Share of eroded cliff material coarse enough to stay as beach and nearshore sediment. */
export const COARSE_FRACTION = 0.2;

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
export function runGeologic(
  geo: LandscapeEvolution,
  years: number,
  p: GeoParams,
  maxStepYears: number,
  meander: MeanderState | null,
  glacial: GlacialGeo | null = null,
  coastal: CoastalGeo | null = null,
): GeoStepStats {
  if (glacial && glacial.sim.params.enabled && geo.w.climate.enabled) return runGlacial(geo, years, p, maxStepYears, glacial);
  if (coastal && geo.w.coast.wavesOn) return runCoastal(geo, years, p, maxStepYears, coastal);
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

/**
 * Geological time on a coast: the landscape model (rivers, weathering, cliff-top collapse — over-steep
 * cliffs fail down to sea level) every few decades, and the coast model (wave attack down to a
 * wave-cut platform, foreshore attenuation, longshore drift, platform down-wearing) in short sub-steps
 * at its geological rate.
 * Only the coarse share of eroded cliff stays as beach / nearshore sediment; the fines are carried
 * offshore (off the map).
 */
function runCoastal(geo: LandscapeEvolution, years: number, p: GeoParams, maxStepYears: number, c: CoastalGeo): GeoStepStats {
  const w = geo.w;
  const tot = emptyGeoStats();
  const L = c.sim.ledger;
  c.sim.coarseFraction = COARSE_FRACTION;
  let left = years;
  while (left > 1e-9) {
    const dt = Math.min(left, COAST_LANDSCAPE_STEP, maxStepYears);
    addGeoStats(tot, geo.run(dt, p, dt));
    computeSurface(w, c.surface);
    const e0 = L.cliffEroded;
    const f0 = L.exportedFines;
    for (let t = 0; t < dt - 1e-9; ) {
      const d = Math.min(COAST_STEP_YEARS, dt - t);
      c.sim.run(d * YEAR_S, COAST_GEO_RATE, 1); // cliffs at their geological rate, drift and onshore transport at their own (physical) rates
      c.sim.wearPlatform(d, PLATFORM_WEAR_M_YR);
      t += d;
    }
    tot.coastEroded += L.cliffEroded - e0;
    tot.exported += L.exportedFines - f0;
    left -= dt;
  }
  c.sim.coarseFraction = 1;
  tot.years = years;
  return tot;
}
