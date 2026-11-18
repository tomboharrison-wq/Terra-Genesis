import { describe, expect, it } from 'vitest';
import { computeSurface, createWorld } from '../src/engine/world';
import { evolveDetailedShoreline, findSandyCoast } from '../src/sim/coast/detailedShoreline';

describe('M18-C03 world-coupled detailed shoreline', () => {
  it('moves existing beach sand into real terrain and conserves the world sediment volume', () => {
    const N = 128;
    const w = createWorld({ width: N, height: N, cellSizeM: 50, seed: 1803, seaLevelM: 0 });
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        const i = y * N + x;
        const bay = x > 48 && x < 82 ? 12 : 0;
        const shore = 52 - bay;
        w.bedrockElevationM[i] = y < shore ? 2 : -2;
        if (Math.abs(y - shore) <= 3) w.looseSedimentThicknessM[i] = 3;
      }
    w.coast.waveHeightM = 2.5;
    w.coast.waveFromDeg = 225;
    const surface = new Float32Array(N * N);
    computeSurface(w, surface);
    const centre = findSandyCoast(w);
    expect(centre).toBeGreaterThanOrEqual(0);
    const before = w.looseSedimentThicknessM.slice();
    const r = evolveDetailedShoreline(w, centre, 3650);
    expect(r).not.toBeNull();
    expect(r!.movedM3).toBeGreaterThan(100);
    expect(r!.builtCells).toBeGreaterThan(0);
    expect(r!.erodedCells).toBeGreaterThan(0);
    expect(r!.afterM3).toBeCloseTo(r!.beforeM3, 2);
    expect(w.looseSedimentThicknessM).not.toEqual(before);
  });
});
