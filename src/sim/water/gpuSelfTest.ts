import {
  createWorld,
  computeSurface,
  cloneWorld,
  refreshAllExposed,
  setUniformStrata,
  MM_PER_H,
  STRATA_BOUNDS,
  STRATA_LAYERS,
  type WorldState,
} from '../../engine/world';
import { WaterSim } from './waterSim';
import { SedimentSim, sedimentClosure } from '../sediment/sedimentSim';
import { GpuWater } from './gpuWater';
import { closureError } from './ledger';
import { generateWorld, defaultOptions } from '../../terrain/generate';
import { ClimateField } from '../climate/climate';
import { surgeHeight } from '../events/hazards';

export interface SelfTestCase {
  name: string;
  maxAbsDiffM: number;
  meanAbsDiffM: number;
  cpuStoredM3: number;
  gpuStoredM3: number;
  gpuClosure: number;
  cpuClosure: number;
  /** Evaporated and rained volumes (climate case: spatial factors). */
  cpuEvapM3: number;
  gpuEvapM3: number;
  cpuRainM3: number;
  gpuRainM3: number;
  cpuSnowM3: number;
  gpuSnowM3: number;
  cpuMeltM3: number;
  gpuMeltM3: number;
  steps: number;
  gpuMsPerStep: number;
  /** Erosion cases: max |Δ surface| CPU vs GPU (m), sediment ledger closures, eroded volumes. */
  maxBedDiffM?: number;
  cpuSedClosure?: number;
  gpuSedClosure?: number;
  cpuErodedM3?: number;
  gpuErodedM3?: number;
  cpuRockfallM3?: number;
  gpuRockfallM3?: number;
  cpuWeatheredM3?: number;
  gpuWeatheredM3?: number;
  /** Cells whose exposed lithology differs CPU vs GPU. */
  exposedMismatch?: number;
  /** Sea-surge case: water pushed onto the land, and max |Δ peak depth| CPU vs GPU (m). */
  cpuSurgeInM3?: number;
  gpuSurgeInM3?: number;
  maxPeakDiffM?: number;
}

/** Sea-surge fixture timing: 3 m for 20 min (5 min rise and fall), over a 1800 s run. */
const SURGE = { kind: 'surge' as const, surgeM: 3, activeS: 1200, rampS: 300 };

function fixture(name: string): WorldState {
  const mk = (N: number, cs: number, zf: (x: number, y: number) => number, sea = -1e6) => {
    const w = createWorld({ width: N, height: N, cellSizeM: cs, seed: 1, seaLevelM: sea });
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) w.bedrockElevationM[y * N + x] = zf(x, y);
    return w;
  };
  switch (name) {
    case 'slope-water': {
      const w = mk(48, 10, (x) => x * 0.8);
      w.water.sources.push({ id: 1, x: 40, y: 24, rateM3PerS: 3 });
      return w;
    }
    case 'erosion-slope': {
      const w = mk(48, 10, (x) => x * 0.8);
      w.looseSedimentThicknessM.fill(0.5);
      w.materialId.fill(2);
      setUniformStrata(w);
      w.erosion.enabled = true;
      w.water.sources.push({ id: 1, x: 40, y: 24, rateM3PerS: 6 });
      return w;
    }
    case 'veg-erosion': {
      // Erosion slope under 70 % plant cover: the GPU must apply the same erosion shield.
      const w = mk(48, 10, (x) => x * 0.8);
      w.looseSedimentThicknessM.fill(0.5);
      w.materialId.fill(2);
      setUniformStrata(w);
      w.vegCover.fill(0.7);
      for (let i = 0; i < 48 * 20; i++) w.vegCover[i] = 0; // bare southern part
      w.erosion.enabled = true;
      w.water.sources.push({ id: 1, x: 40, y: 24, rateM3PerS: 6 });
      return w;
    }
    case 'caprock': {
      // 5 cm resistant sandstone cap over clay: erosion must switch lithology mid-run.
      const w = mk(48, 10, (x) => x * 0.8);
      for (let i = 0; i < 48 * 48; i++) {
        w.strataBoundsM.fill(-1e9, i * STRATA_BOUNDS, (i + 1) * STRATA_BOUNDS);
        w.strataBoundsM[i * STRATA_BOUNDS] = (i % 48) * 0.8 - 0.05;
        w.strataMaterial.fill(3, i * STRATA_LAYERS, (i + 1) * STRATA_LAYERS);
        w.strataMaterial[i * STRATA_LAYERS] = 1;
      }
      refreshAllExposed(w);
      w.erosion.enabled = true;
      w.erosion.speedup = 50;
      w.water.sources.push({ id: 1, x: 40, y: 24, rateM3PerS: 6 });
      return w;
    }
    case 'cliff-failure': {
      // Saturated clay cliff with a loose pile on top: rockfall + avalanching + weathering.
      const w = mk(40, 5, (x) => (x >= 20 ? 25 : 0));
      w.materialId.fill(3);
      setUniformStrata(w);
      for (let y = 10; y < 30; y++) for (let x = 24; x < 30; x++) w.looseSedimentThicknessM[y * 40 + x] = 6;
      w.erosion.enabled = true;
      w.erosion.speedup = 100;
      w.water.rainMPerS = 30 * MM_PER_H;
      return w;
    }
    case 'erosion-delta': {
      const w = mk(48, 10, (x) => (x - 12) * 0.6, 0);
      w.looseSedimentThicknessM.fill(1);
      w.erosion.enabled = true;
      w.water.sources.push({ id: 1, x: 44, y: 24, rateM3PerS: 6 });
      return w;
    }
    case 'climate-ridge': {
      // Orographic rain + rain shadow over a ridge, warm-season evaporation, closed edges.
      const w = mk(48, 50, (x) => 50 + 600 * Math.max(0, 1 - Math.abs(x - 24) / 8), 0);
      w.water.boundary = 'closed';
      w.water.rainMPerS = 40 * MM_PER_H;
      w.water.evaporationMPerS = 4 * MM_PER_H;
      w.water.infiltrationMPerS = 1 * MM_PER_H;
      w.climate = { ...w.climate, enabled: true, windFromDeg: 270, seaLevelTempC: 18 };
      return w;
    }
    case 'snow-ridge': {
      // Peak below freezing (snow builds), valleys above (an initial pack melts), closed edges.
      const w = mk(48, 50, (x) => 50 + 600 * Math.max(0, 1 - Math.abs(x - 24) / 8), 0);
      w.water.boundary = 'closed';
      w.water.rainMPerS = 20 * MM_PER_H;
      w.snowSweM.fill(0.05);
      w.climate = { ...w.climate, enabled: true, seaLevelTempC: 2, seasonalAmpC: 0, meltMmPerDegDay: 200 };
      return w;
    }
    case 'sea-surge': {
      // Sea in the east, a low plain sloping to it, then a hill: the raised sea floods the plain and drains.
      const w = mk(48, 10, (x) => (x >= 34 ? -6 : x >= 16 ? 0.5 + (34 - x) * 0.1 : 4 + (16 - x) * 0.5), 0);
      w.water.boundary = 'closed';
      return w;
    }
    case 'bowl-overflow': {
      const w = mk(33, 10, (x, y) => {
        const rim = y === 0 || y === 32 || x === 0 || x === 32 ? 8 : 0;
        const saddle = x === 16 ? (y === 16 ? 3 : 8) : 0;
        return Math.max(rim, saddle, 0.002 * (y - 16) ** 2);
      });
      w.water.boundary = 'closed';
      w.water.sources.push({ id: 1, x: 8, y: 16, rateM3PerS: 20 });
      return w;
    }
    default: {
      const w = generateWorld(defaultOptions('island', 5, 96));
      w.water.rainMPerS = 100 * MM_PER_H;
      w.water.infiltrationMPerS = 5 * MM_PER_H;
      return w;
    }
  }
}

/** Run CPU reference and GPU solver side by side with identical dt sequences. */
export function runGpuSelfTest(gl?: WebGL2RenderingContext, simSeconds = 1800): SelfTestCase[] {
  const ctx = gl ?? document.createElement('canvas').getContext('webgl2');
  if (!ctx) throw new Error('WebGL2 unavailable');
  const out: SelfTestCase[] = [];
  for (const name of [
    'slope-water',
    'bowl-overflow',
    'river-catchment',
    'erosion-slope',
    'erosion-delta',
    'caprock',
    'cliff-failure',
    'climate-ridge',
    'snow-ridge',
    'veg-erosion',
    'sea-surge',
  ]) {
    const wc = fixture(name);
    const wg = cloneWorld(wc);
    const sc = new Float32Array(wc.width * wc.height);
    const sg = new Float32Array(wc.width * wc.height);
    computeSurface(wc, sc);
    computeSurface(wg, sg);
    const cpu = new WaterSim(wc, sc);
    const cpuSed = new SedimentSim(wc, sc, cpu);
    const gsim = new WaterSim(wg, sg);
    if (wc.climate.enabled) {
      const fc = new ClimateField(wc.width * wc.height);
      fc.compute(wc, sc);
      cpu.climate = fc;
      const fg = new ClimateField(wg.width * wg.height);
      fg.compute(wg, sg);
      gsim.climate = fg;
    }
    const gSed = new SedimentSim(wg, sg, gsim);
    const surge = name === 'sea-surge';
    if (surge) {
      cpu.peakDepth = new Float32Array(wc.width * wc.height);
      gsim.peakDepth = new Float32Array(wg.width * wg.height);
    }
    const gpu = new GpuWater(ctx, wg, sg, gsim, gSed);
    let t = 0;
    let steps = 0;
    let gpuMs = 0;
    while (t < simSeconds) {
      if (surge) cpu.surgeM = gsim.surgeM = surgeHeight(SURGE, t);
      const dt = cpu.stableDt();
      cpu.step(dt);
      cpuSed.step(dt);
      const t0 = performance.now();
      gpu.step(dt);
      gpuMs += performance.now() - t0;
      t += dt;
      steps++;
    }
    const t0 = performance.now();
    gpu.syncToCpu();
    gpuMs += performance.now() - t0;
    let diff = 0;
    let sum = 0;
    for (let i = 0; i < wc.waterDepthM.length; i++) {
      const a = Math.abs(wc.waterDepthM[i] - wg.waterDepthM[i]);
      diff = Math.max(diff, a);
      sum += a;
    }
    let bedDiff = 0;
    for (let i = 0; i < sc.length; i++) bedDiff = Math.max(bedDiff, Math.abs(sc[i] - sg[i]));
    const erosion = wc.erosion.enabled
      ? {
          maxBedDiffM: bedDiff,
          cpuSedClosure: sedimentClosure(cpuSed.ledger, cpuSed.suspendedVolume()),
          gpuSedClosure: sedimentClosure(gSed.ledger, gSed.suspendedVolume()),
          cpuErodedM3: cpuSed.ledger.erodedLoose + cpuSed.ledger.erodedBedrock,
          cpuRockfallM3: cpuSed.ledger.rockfall,
          gpuRockfallM3: gSed.ledger.rockfall,
          cpuWeatheredM3: cpuSed.ledger.weathered,
          gpuWeatheredM3: gSed.ledger.weathered,
          exposedMismatch: wc.materialId.reduce((a, m, i) => a + (m !== wg.materialId[i] ? 1 : 0), 0),
          gpuErodedM3: gSed.ledger.erodedLoose + gSed.ledger.erodedBedrock,
        }
      : {};
    let peakDiff = 0;
    if (surge) for (let i = 0; i < sc.length; i++) peakDiff = Math.max(peakDiff, Math.abs(cpu.peakDepth![i] - gsim.peakDepth![i]));
    const surgeRes = surge ? { cpuSurgeInM3: cpu.ledger.surgeIn, gpuSurgeInM3: gsim.ledger.surgeIn, maxPeakDiffM: peakDiff } : {};
    out.push({
      ...erosion,
      ...surgeRes,
      name,
      maxAbsDiffM: diff,
      meanAbsDiffM: sum / wc.waterDepthM.length,
      cpuStoredM3: cpu.storedVolume(),
      gpuStoredM3: gsim.storedVolume(),
      cpuClosure: closureError(cpu.ledger, cpu.storedVolume()),
      gpuClosure: closureError(gsim.ledger, gsim.storedVolume()),
      cpuEvapM3: cpu.ledger.evaporated,
      gpuEvapM3: gsim.ledger.evaporated,
      cpuRainM3: cpu.ledger.rainIn,
      gpuRainM3: gsim.ledger.rainIn,
      cpuSnowM3: cpu.snowVolume(),
      gpuSnowM3: gsim.snowVolume(),
      cpuMeltM3: cpu.ledger.snowmelt,
      gpuMeltM3: gsim.ledger.snowmelt,
      steps,
      gpuMsPerStep: gpuMs / steps,
    });
    gpu.dispose();
  }
  return out;
}
