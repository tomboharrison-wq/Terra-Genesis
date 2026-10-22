import { cloneWorld, computeSurface, type WorldState } from '../engine/world';
import type { ClimateParams } from '../sim/climate/climate';
import { ClimateField } from '../sim/climate/climate';
import type { GlacierParams } from '../sim/glacier/glacierSim';
import { VegetationSim, type VegetationParams } from '../sim/vegetation/vegetationSim';

/** Thickest starting ice laid by the spin-up (m). */
const SPIN_UP_ICE_CAP_M = 120;

export type BiomeId = 'temperate' | 'alpine' | 'rain-shadow' | 'tundra';

interface BiomeDef {
  climate: Partial<ClimateParams>;
  vegetation: Partial<VegetationParams>;
  glacier: Partial<GlacierParams>;
  /** Glacier years run at generation so ice is already in place (0 = none). */
  glacierSpinUpYears: number;
}

/** Climate settings of the biome presets (all values physical; see src/sim/climate, vegetation, glacier). */
export const BIOMES: Record<BiomeId, BiomeDef> = {
  temperate: {
    climate: { enabled: true, seaLevelTempC: 11, seasonalAmpC: 7, windFromDeg: 240 },
    vegetation: { enabled: true, annualPrecipMm: 1100 },
    glacier: { enabled: false },
    glacierSpinUpYears: 0,
  },
  alpine: {
    climate: { enabled: true, seaLevelTempC: 10, seasonalAmpC: 8, windFromDeg: 260 },
    vegetation: { enabled: true, annualPrecipMm: 1300 },
    glacier: { enabled: true, elaTempC: -3.5 },
    glacierSpinUpYears: 150,
  },
  'rain-shadow': {
    climate: { enabled: true, seaLevelTempC: 16, seasonalAmpC: 8, windFromDeg: 270, orographic: 1.5, shadowScaleM: 300 },
    vegetation: { enabled: true, annualPrecipMm: 650 },
    glacier: { enabled: false },
    glacierSpinUpYears: 0,
  },
  tundra: {
    climate: { enabled: true, seaLevelTempC: -3, seasonalAmpC: 13, windFromDeg: 250 },
    vegetation: { enabled: true, annualPrecipMm: 450 },
    glacier: { enabled: true, elaTempC: -5 },
    glacierSpinUpYears: 100,
  },
};

export interface SpinUpResult {
  coverPct: number;
  forestPct: number;
  treelineM: number;
  snowlineM: number;
  iceM3: number;
  iceAreaPct: number;
}

/**
 * Spin a world's climate-driven state up to a mature starting point: lay starting ice above the
 * snowline (`glacierYears` of accumulation, ≤ 120 m, no flow), then set plant cover to its
 * equilibrium (the suitability, which excludes iced ground). Deterministic; CPU.
 */
export function spinUp(w: WorldState, glacierYears: number): SpinUpResult {
  const surface = new Float32Array(w.width * w.height);
  computeSurface(w, surface);
  const climate = new ClimateField(w.width * w.height);
  climate.compute(w, surface);
  if (w.glacier.enabled && glacierYears > 0) {
    // Starting ice: the accumulation above the snowline over `glacierYears`, capped — laid in place
    // without flow (fast and deterministic); the live glacier model then flows and reshapes it.
    const c = w.climate;
    const g = w.glacier;
    const zEla = w.seaLevelM + ((c.seaLevelTempC - g.elaTempC) / c.lapseRateCPerKm) * 1000;
    for (let i = 0; i < surface.length; i++) {
      if (surface[i] < w.seaLevelM) continue;
      const b = Math.min(g.maxAccumulation, g.balanceGradient * (surface[i] - zEla)) * climate.rainFactor[i];
      if (b > 0) w.iceThicknessM[i] = Math.min(SPIN_UP_ICE_CAP_M, b * glacierYears);
    }
  }
  const veg = new VegetationSim(w, surface, climate);
  if (w.vegetation.enabled) w.vegCover.set(veg.computeSuitability());
  const st = veg.stats();
  const c = w.climate;
  let ice = 0;
  let iceCells = 0;
  let land = 0;
  for (let i = 0; i < surface.length; i++) {
    ice += w.iceThicknessM[i];
    if (w.iceThicknessM[i] > 1) iceCells++;
    if (surface[i] >= w.seaLevelM) land++;
  }
  return {
    coverPct: st.coverPct,
    forestPct: st.forestPct,
    treelineM: w.seaLevelM + ((c.seaLevelTempC + c.seasonalAmpC - 6) / c.lapseRateCPerKm) * 1000,
    snowlineM: w.seaLevelM + ((c.seaLevelTempC - w.glacier.elaTempC) / c.lapseRateCPerKm) * 1000,
    iceM3: ice * w.cellSizeM * w.cellSizeM,
    iceAreaPct: land ? (100 * iceCells) / land : 0,
  };
}

/** Set a biome's climate, plants and glaciers on a freshly generated world and spin it up. */
export function applyBiome(w: WorldState, id: BiomeId) {
  const b = BIOMES[id];
  Object.assign(w.climate, b.climate);
  Object.assign(w.vegetation, b.vegetation);
  Object.assign(w.glacier, b.glacier);
  spinUp(w, b.glacierSpinUpYears);
}

export type ClimateChange = 'warmer' | 'colder' | 'wetter' | 'drier';

export const CLIMATE_CHANGES: { id: ClimateChange; label: string }[] = [
  { id: 'warmer', label: '2 °C warmer' },
  { id: 'colder', label: '2 °C colder' },
  { id: 'wetter', label: '30 % wetter' },
  { id: 'drier', label: '30 % drier' },
];

export interface CompareResult {
  change: ClimateChange;
  now: SpinUpResult;
  whatIf: SpinUpResult;
  /** What-if minus now plant cover per cell (−1 … 1). */
  coverDiff: Float32Array;
}

/**
 * "What if?" comparison: two copies of the world, both started ice-free and spun up the same way
 * (100 years of starting ice above the snowline, mature plant cover) — one as it is, one with the
 * change. Same terrain, same rules: the difference is the climate change alone.
 */
export function compareClimate(w: WorldState, change: ClimateChange): CompareResult {
  const a = cloneWorld(w);
  const b = cloneWorld(w);
  for (const x of [a, b]) {
    x.iceThicknessM.fill(0);
    x.vegCover.fill(0);
    x.vegetation.enabled = true;
    x.glacier.enabled = true;
  }
  if (change === 'warmer') b.climate.seaLevelTempC += 2;
  if (change === 'colder') b.climate.seaLevelTempC -= 2;
  if (change === 'wetter') b.vegetation.annualPrecipMm *= 1.3;
  if (change === 'drier') b.vegetation.annualPrecipMm *= 0.7;
  const years = 100;
  const now = spinUp(a, years);
  const whatIf = spinUp(b, years);
  const coverDiff = new Float32Array(w.vegCover.length);
  for (let i = 0; i < coverDiff.length; i++) coverDiff[i] = b.vegCover[i] - a.vegCover[i];
  return { change, now, whatIf, coverDiff };
}
