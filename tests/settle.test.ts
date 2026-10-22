import { describe, expect, it } from 'vitest';
import { createWorld, setUniformStrata } from '../src/engine/world';
import { settleSlopes } from '../src/terrain/settle';
import { generateWorld, defaultOptions } from '../src/terrain/generate';
import { MATERIALS, LOOSE_REPOSE_DEG } from '../src/terrain/materials';

describe('generation-time slope settling', () => {
  it('turns an over-steep cliff into a stable cliff + talus apron, conserving material', () => {
    const w = createWorld({ width: 30, height: 10, cellSizeM: 5, seed: 1 });
    for (let y = 0; y < 10; y++) for (let x = 0; x < 30; x++) w.bedrockElevationM[y * 30 + x] = x >= 15 ? 40 : 0;
    w.materialId.fill(3); // clay, 45°
    setUniformStrata(w);
    const sum = () => w.bedrockElevationM.reduce((a, v) => a + v, 0) + w.looseSedimentThicknessM.reduce((a, v) => a + v, 0);
    const v0 = sum();
    settleSlopes(w);
    expect(Math.abs(sum() - v0) / v0).toBeLessThan(1e-5);
    const tan = Math.tan((45 * Math.PI) / 180) * 5;
    for (let x = 0; x < 29; x++) expect(Math.abs(w.bedrockElevationM[5 * 30 + x] - w.bedrockElevationM[5 * 30 + x + 1])).toBeLessThanOrEqual(tan + 0.01);
    expect(w.looseSedimentThicknessM.some((v) => v > 1)).toBe(true);
  });

  it('generated presets start with no bedrock face steeper than its lithology allows', () => {
    for (const id of ['coastal-headland', 'plateau', 'mountain-range'] as const) {
      const w = generateWorld(defaultOptions(id, 4, 96));
      const N = 96;
      const cs = w.cellSizeM;
      let worst = 0;
      for (let y = 0; y < N; y++)
        for (let x = 0; x < N - 1; x++) {
          const i = y * N + x;
          const drop = w.bedrockElevationM[i] - w.bedrockElevationM[i + 1];
          const lim = cs * Math.tan((MATERIALS[w.materialId[i]].cliffDeg * Math.PI) / 180);
          worst = Math.max(worst, drop - lim);
        }
      expect(worst).toBeLessThan(0.05 * cs);
      expect(LOOSE_REPOSE_DEG).toBe(33);
    }
  });
});
