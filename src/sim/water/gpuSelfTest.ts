import { createWorld, computeSurface, cloneWorld, MM_PER_H, type WorldState } from '../../engine/world';
import { WaterSim } from './waterSim';
import { GpuWater } from './gpuWater';
import { closureError } from './ledger';
import { generateWorld, defaultOptions } from '../../terrain/generate';

export interface SelfTestCase {
  name: string;
  maxAbsDiffM: number;
  meanAbsDiffM: number;
  cpuStoredM3: number;
  gpuStoredM3: number;
  gpuClosure: number;
  cpuClosure: number;
  steps: number;
  gpuMsPerStep: number;
}

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
  for (const name of ['slope-water', 'bowl-overflow', 'river-catchment']) {
    const wc = fixture(name);
    const wg = cloneWorld(wc);
    const sc = new Float32Array(wc.width * wc.height);
    const sg = new Float32Array(wc.width * wc.height);
    computeSurface(wc, sc);
    computeSurface(wg, sg);
    const cpu = new WaterSim(wc, sc);
    const gsim = new WaterSim(wg, sg);
    const gpu = new GpuWater(ctx, wg, sg, gsim);
    let t = 0;
    let steps = 0;
    let gpuMs = 0;
    while (t < simSeconds) {
      const dt = cpu.stableDt();
      cpu.step(dt);
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
    out.push({
      name,
      maxAbsDiffM: diff,
      meanAbsDiffM: sum / wc.waterDepthM.length,
      cpuStoredM3: cpu.storedVolume(),
      gpuStoredM3: gsim.storedVolume(),
      cpuClosure: closureError(cpu.ledger, cpu.storedVolume()),
      gpuClosure: closureError(gsim.ledger, gsim.storedVolume()),
      steps,
      gpuMsPerStep: gpuMs / steps,
    });
    gpu.dispose();
  }
  return out;
}
