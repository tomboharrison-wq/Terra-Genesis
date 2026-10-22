import type { WorldState } from '../../engine/world';
import type { ClimateField } from '../climate/climate';

/**
 * Vegetation (spec Part J M06-C04): a per-cell plant cover fraction c ∈ [0, 1], CPU, on a slow
 * cadence in accelerated plant time (yearsPerSimHour, like glaciers).
 *
 * Suitability S = S_T · S_W · S_soil · S_slope (each 0 … 1):
 *   S_T     warmth: warmest-month temperature T_w = T_annual + seasonal amplitude at the cell's
 *           height; 0 at ≤ 6 °C (treeline), 1 at ≥ 14 °C.
 *   S_W     moisture: annual precipitation P = annualPrecipMm × climate rain factor (1 without
 *           climate); 0 at ≤ 150 mm (desert), 1 at ≥ 800 mm.
 *   S_soil  needs loose sediment: min(1, loose / 0.3 m) (bare rock ⇒ none).
 *   S_slope 1 − slope (rise/run), ≥ 0 (cliffs ⇒ none).
 *   S = 0 in the sea, under ice (> 1 m) or in standing water deeper than 0.5 m.
 * Dynamics: c relaxes exponentially towards S — growth (including colonisation of bare ground)
 *   at growthPerYr, dieback at diebackPerYr (faster): c' = S + (c − S)·exp(−k·Δt).
 * Effect: hydraulic erosion is scaled by (1 − erosionShield · c) — roots and litter protect soil.
 * Simplifications: one generic plant type; no competition, fire, grazing or seed dispersal.
 */
export interface VegetationParams {
  enabled: boolean;
  /** Annual precipitation of the climate (mm/yr), scaled per cell by the rain factor. */
  annualPrecipMm: number;
  /** Plant time per simulated hour (years). */
  yearsPerSimHour: number;
  growthPerYr: number;
  diebackPerYr: number;
  /** Fraction of hydraulic erosion prevented under full cover. */
  erosionShield: number;
  intervalS: number;
}

export function defaultVegetationParams(): VegetationParams {
  return { enabled: false, annualPrecipMm: 900, yearsPerSimHour: 10, growthPerYr: 0.15, diebackPerYr: 0.4, erosionShield: 0.8, intervalS: 600 };
}

export const TREELINE_WARM_C = 6;

export class VegetationSim {
  private sinceLast = 0;
  /** Suitability at the last update (for display). */
  readonly suitability: Float32Array;

  constructor(
    private world: WorldState,
    private surface: Float32Array,
    private climate: ClimateField,
  ) {
    this.suitability = new Float32Array(world.width * world.height);
  }

  get params(): VegetationParams {
    return this.world.vegetation;
  }

  accumulate(dtWater: number): boolean {
    if (!this.params.enabled) return false;
    this.sinceLast += dtWater;
    return this.sinceLast >= this.params.intervalS;
  }

  update(): boolean {
    const dt = this.sinceLast;
    this.sinceLast = 0;
    if (!this.params.enabled || dt <= 0) return false;
    this.run((dt * this.params.yearsPerSimHour) / 3600);
    return true;
  }

  /** Suitability of every cell (0 … 1). */
  computeSuitability(): Float32Array {
    const w = this.world;
    const W = w.width;
    const H = w.height;
    const cs = w.cellSizeM;
    const z = this.surface;
    const c = w.climate;
    const p = this.params;
    const S = this.suitability;
    const lapse = c.lapseRateCPerKm / 1000;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (z[i] < w.seaLevelM || w.iceThicknessM[i] > 1 || w.waterDepthM[i] > 0.5) {
          S[i] = 0;
          continue;
        }
        const tWarm = c.seaLevelTempC + c.seasonalAmpC - lapse * Math.max(0, z[i] - w.seaLevelM);
        const sT = clamp01((tWarm - TREELINE_WARM_C) / 8);
        const precip = p.annualPrecipMm * (c.enabled ? this.climate.rainFactor[i] : 1);
        const sW = clamp01((precip - 150) / 650);
        const sSoil = Math.min(1, w.looseSedimentThicknessM[i] / 0.3);
        const xl = x > 0 ? x - 1 : x;
        const xr = x < W - 1 ? x + 1 : x;
        const yd = y > 0 ? y - 1 : y;
        const yu = y < H - 1 ? y + 1 : y;
        const sx = (z[y * W + xr] - z[y * W + xl]) / ((xr - xl) * cs);
        const sy = (z[yu * W + x] - z[yd * W + x]) / ((yu - yd) * cs);
        const sSlope = clamp01(1 - Math.hypot(sx, sy));
        S[i] = sT * sW * sSoil * sSlope;
      }
    return S;
  }

  /** Advance plant time by `years`. */
  run(years: number) {
    const p = this.params;
    const S = this.computeSuitability();
    const v = this.world.vegCover;
    const eg = Math.exp(-p.growthPerYr * years);
    const ed = Math.exp(-p.diebackPerYr * years);
    for (let i = 0; i < v.length; i++) {
      const s = S[i];
      const c = v[i];
      v[i] = s + (c - s) * (c < s ? eg : ed);
    }
  }

  /** Total covered area (m², cover-weighted) and forest share (cells with c > 0.6). */
  stats(): { coverPct: number; forestPct: number } {
    const w = this.world;
    let land = 0;
    let cov = 0;
    let forest = 0;
    for (let i = 0; i < w.vegCover.length; i++) {
      if (this.surface[i] < w.seaLevelM) continue;
      land++;
      cov += w.vegCover[i];
      if (w.vegCover[i] > 0.6) forest++;
    }
    return { coverPct: land ? (100 * cov) / land : 0, forestPct: land ? (100 * forest) / land : 0 };
  }
}

/** Erosion multiplier at a cell from its plant cover. */
export function vegErosionFactor(w: WorldState, i: number): number {
  return 1 - w.vegetation.erosionShield * w.vegCover[i];
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
