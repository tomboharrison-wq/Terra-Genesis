import type { WorldState } from '../../engine/world';

/**
 * Climate (spec E7): temperature, season and spatial rainfall / evaporation, as per-cell fields that
 * scale the map-wide water forcing (WaterParams.rainMPerS / evaporationMPerS).
 *
 * Temperature  T = T₀ + season − Γ · max(0, z − sea level), with lapse rate Γ (°C per km) and
 *   season = −A · cos(2π · phase)  (phase 0 = mid-winter, 0.5 = mid-summer).
 * Rainfall factor (dimensionless, mean 1 over land, so the Water panel's rainfall stays the map
 *   average and total rain is unchanged):
 *   uplift  = 1 + orographic · tanh(max(0, s) / 0.1), s = terrain slope along the wind (windward
 *             rise) — saturating, so steep slopes at most (1 + orographic)× wetter;
 *   shadow  = exp(−max(0, B − z) / shadowScaleM), B = max over the upwind ray (to shadowReachM) of
 *             z_up − 0.01 · distance  (a barrier upwind casts a shadow that fades with distance);
 *   factor  = uplift · shadow, renormalised to mean 1 over land.
 * Evaporation factor: exp(0.065 · (T − T₀)) above 0 °C (≈ Clausius–Clapeyron, 6.5 % per °C),
 *   0 at or below freezing — so the Water panel's evaporation is the rate at the sea-level
 *   annual-mean temperature.
 * Snow (M06-C02, in the water solvers): with climate on, precipitation on a cell below 0 °C is added
 *   to its snowpack (snow water equivalent, m) instead of its surface water; a snowpack melts at
 *   meltMmPerDegDay · max(0, T) (degree-day law) into surface water; snow on a cell that becomes sea
 *   joins the sea. Snow is stored water: the water ledger's stored volume includes it.
 * Climate off ⇒ all factors 1 (uniform forcing, exactly as before). Simplifications: no moisture
 * budget or advection of humidity, no wind field over terrain; no sublimation, avalanching or
 * wind-drift of snow.
 */
export interface ClimateParams {
  enabled: boolean;
  /** Annual mean temperature at sea level (°C). */
  seaLevelTempC: number;
  /** Temperature fall with height (°C per km). */
  lapseRateCPerKm: number;
  /** Half the summer–winter difference (°C). */
  seasonalAmpC: number;
  /** Time of year, 0 … 1 (0 = mid-winter). */
  seasonPhase: number;
  /** Advance the season with simulated time (one year = 365.25 days). */
  seasonsRun: boolean;
  /** Bearing the prevailing wind blows FROM (degrees, 0 = north, 90 = east). */
  windFromDeg: number;
  /** Extra rain on windward slopes: up to (1 + orographic)× on steep windward rises (≈ ×1.76 at a 10 % rise when 1). */
  orographic: number;
  /** Height deficit below an upwind barrier that cuts rain by e (m). */
  shadowScaleM: number;
  /** How far upwind barriers are looked for (m). */
  shadowReachM: number;
  /** Degree-day snowmelt factor (mm of water per °C above 0 per day). */
  meltMmPerDegDay: number;
}

export function defaultClimateParams(): ClimateParams {
  return {
    enabled: false,
    seaLevelTempC: 10,
    lapseRateCPerKm: 6.5,
    seasonalAmpC: 6,
    seasonPhase: 0.5,
    seasonsRun: false,
    windFromDeg: 240,
    orographic: 1,
    shadowScaleM: 400,
    shadowReachM: 30000,
    meltMmPerDegDay: 4,
  };
}

export const YEAR_S = 365.25 * 86400;
const SHADOW_DECAY = 0.01; // barrier influence falls 10 m per km downwind

export function seasonalOffsetC(p: ClimateParams): number {
  return -p.seasonalAmpC * Math.cos(2 * Math.PI * p.seasonPhase);
}

export function temperatureAt(p: ClimateParams, zM: number, seaLevelM: number): number {
  return p.seaLevelTempC + seasonalOffsetC(p) - (p.lapseRateCPerKm / 1000) * Math.max(0, zM - seaLevelM);
}

export class ClimateField {
  readonly temperatureC: Float32Array;
  readonly rainFactor: Float32Array;
  readonly evapFactor: Float32Array;

  constructor(n: number) {
    this.temperatureC = new Float32Array(n);
    this.rainFactor = new Float32Array(n).fill(1);
    this.evapFactor = new Float32Array(n).fill(1);
  }

  /** Recompute everything (rain pattern + temperature/evaporation). */
  compute(w: WorldState, surface: Float32Array) {
    this.computeRain(w, surface);
    this.computeTemperature(w, surface);
  }

  /** Temperature and evaporation (cheap: run whenever the season changes). */
  computeTemperature(w: WorldState, surface: Float32Array) {
    const p = w.climate;
    const n = surface.length;
    for (let i = 0; i < n; i++) {
      const t = temperatureAt(p, surface[i], w.seaLevelM);
      this.temperatureC[i] = t;
      this.evapFactor[i] = !p.enabled ? 1 : t > 0 ? Math.exp(0.065 * (t - p.seaLevelTempC)) : 0;
    }
  }

  /** Orographic rain + rain shadow (a ray march per cell: run when terrain or wind changes). */
  computeRain(w: WorldState, surface: Float32Array) {
    const p = w.climate;
    const W = w.width;
    const H = w.height;
    const cs = w.cellSizeM;
    const rf = this.rainFactor;
    if (!p.enabled) {
      rf.fill(1);
      return;
    }
    // Unit vector the wind blows TOWARDS (x east, y north); upwind = −u.
    const a = (p.windFromDeg * Math.PI) / 180;
    const ux = -Math.sin(a);
    const uy = -Math.cos(a);
    const sample = (x: number, y: number) => {
      const xi = Math.max(0, Math.min(W - 1, Math.round(x)));
      const yi = Math.max(0, Math.min(H - 1, Math.round(y)));
      return Math.max(surface[yi * W + xi], w.seaLevelM);
    };
    const steps = Math.min(Math.ceil(p.shadowReachM / cs), W + H);
    const stride = Math.max(1, Math.floor(steps / 96));
    let sum = 0;
    let land = 0;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        const z = Math.max(surface[i], w.seaLevelM);
        // Windward rise: slope along the wind over one cell each side.
        const s = (sample(x + ux, y + uy) - sample(x - ux, y - uy)) / (2 * cs);
        const uplift = 1 + p.orographic * Math.tanh(Math.max(0, s) / 0.1);
        let barrier = -Infinity;
        for (let k = 1; k <= steps; k += stride) {
          const bx = x - ux * k;
          const by = y - uy * k;
          if (bx < -0.5 || by < -0.5 || bx > W - 0.5 || by > H - 0.5) break;
          barrier = Math.max(barrier, sample(bx, by) - SHADOW_DECAY * k * cs);
        }
        const shadow = Math.exp(-Math.max(0, barrier - z) / Math.max(1, p.shadowScaleM));
        const f = uplift * shadow;
        rf[i] = f;
        if (surface[i] >= w.seaLevelM) {
          sum += f;
          land++;
        }
      }
    const mean = land ? sum / land : 1;
    if (mean > 0) for (let i = 0; i < rf.length; i++) rf[i] /= mean;
  }
}
