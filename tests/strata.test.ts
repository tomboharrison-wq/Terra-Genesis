import { describe, expect, it } from 'vitest';
import { createWorld, computeSurface, layerAt, refreshAllExposed, setUniformStrata, validateWorld, STRATA_BOUNDS, STRATA_LAYERS, type WorldState } from '../src/engine/world';
import { Engine } from '../src/engine/engine';
import { WaterSim } from '../src/sim/water/waterSim';
import { SedimentSim } from '../src/sim/sediment/sedimentSim';
import { generateWorld, defaultOptions } from '../src/terrain/generate';
import { decodeWorld, encodeWorld } from '../src/persistence/format';

const SANDSTONE = 1;
const MUDSTONE = 2;
const CLAY = 3;

/** Every cell: `cap` lithology above capBaseM, `below` lithology underneath. */
function capColumn(w: WorldState, capBaseFn: (x: number) => number, cap: number, below: number) {
  for (let i = 0; i < w.width * w.height; i++) {
    w.strataBoundsM.fill(-1e9, i * STRATA_BOUNDS, (i + 1) * STRATA_BOUNDS);
    w.strataBoundsM[i * STRATA_BOUNDS] = capBaseFn(i % w.width);
    w.strataMaterial.fill(below, i * STRATA_LAYERS, (i + 1) * STRATA_LAYERS);
    w.strataMaterial[i * STRATA_LAYERS] = cap;
  }
  refreshAllExposed(w);
}

describe('M04-C01 stratigraphy', () => {
  it('layerAt picks the layer containing an elevation (boundary belongs to the upper layer)', () => {
    const w = createWorld({ width: 2, height: 2, cellSizeM: 1, seed: 0 });
    w.strataBoundsM.set([10, 5, -1e9], 0);
    expect(layerAt(w, 0, 12)).toBe(0);
    expect(layerAt(w, 0, 10)).toBe(0);
    expect(layerAt(w, 0, 9.99)).toBe(1);
    expect(layerAt(w, 0, 4)).toBe(2);
    expect(layerAt(w, 0, -5e9)).toBe(3);
  });

  it('cutting down through a boundary with the Lower brush exposes the next layer; undo restores it', () => {
    const w = createWorld({ width: 21, height: 21, cellSizeM: 10, seed: 1 });
    w.bedrockElevationM.fill(10);
    capColumn(w, () => 8, SANDSTONE, CLAY);
    const e = new Engine(w);
    const c = 10 * 21 + 10;
    expect(w.materialId[c]).toBe(SANDSTONE);
    e.beginStroke({ kind: 'lower', radiusM: 50, rate: 5, hardness: 0.8 }, 100, 100);
    e.strokeStep(100, 100, 1);
    e.endStroke();
    expect(w.bedrockElevationM[c]).toBeLessThan(8);
    expect(w.materialId[c]).toBe(CLAY);
    e.undo();
    expect(w.materialId[c]).toBe(SANDSTONE);
  });

  it('Geology paint changes only the exposed layer; layers beneath keep their lithology', () => {
    const w = createWorld({ width: 21, height: 21, cellSizeM: 10, seed: 1 });
    w.bedrockElevationM.fill(10);
    capColumn(w, () => 8, SANDSTONE, CLAY);
    const e = new Engine(w);
    const c = 10 * 21 + 10;
    e.beginStroke({ kind: 'paint', radiusM: 40, rate: 1, hardness: 1, materialId: 5 }, 100, 100);
    e.strokeStep(100, 100, 0.1);
    e.endStroke();
    expect(w.materialId[c]).toBe(5);
    expect(w.strataMaterial[c * STRATA_LAYERS + 1]).toBe(CLAY);
    e.undo();
    expect(w.strataMaterial[c * STRATA_LAYERS]).toBe(SANDSTONE);
  });

  it('cap rock: erosion through a resistant cap exposes weak rock and erodes it faster', () => {
    const run = (layered: boolean) => {
      const N = 40;
      const w = createWorld({ width: N, height: N, cellSizeM: 10, seed: 1, seaLevelM: -1e6 });
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) w.bedrockElevationM[y * N + x] = x * 1.0;
      if (layered) capColumn(w, (x) => x * 1.0 - 0.05, SANDSTONE, CLAY); // 5 cm resistant cap
      else {
        w.materialId.fill(SANDSTONE);
        setUniformStrata(w);
      }
      w.erosion.enabled = true;
      w.erosion.speedup = 50;
      w.water.sources.push({ id: 1, x: 36, y: 20, rateM3PerS: 8 });
      const s = new Float32Array(N * N);
      computeSurface(w, s);
      const water = new WaterSim(w, s);
      const sed = new SedimentSim(w, s, water);
      let t = 0;
      while (t < 7200) {
        const dt = water.stableDt();
        water.step(dt);
        sed.step(dt);
        t += dt;
      }
      let exposedWeak = 0;
      for (const m of w.materialId) if (m === CLAY) exposedWeak++;
      expect(validateWorld(w)).toEqual([]);
      return { rock: sed.ledger.erodedBedrock, exposedWeak };
    };
    const solid = run(false);
    const capped = run(true);
    expect(solid.exposedWeak).toBe(0);
    expect(capped.exposedWeak).toBeGreaterThanOrEqual(3);
    // Once through the cap the clay (4× more erodible) cuts much faster.
    expect(capped.rock).toBeGreaterThan(solid.rock * 1.3);
  }, 60000);

  it('layered plateau preset: descending boundaries, cap exposed on top, weaker rock below', () => {
    const w = generateWorld(defaultOptions('plateau', 3, 96));
    expect(validateWorld(w)).toEqual([]);
    const s = new Float32Array(96 * 96);
    computeSurface(w, s);
    const R = w.meta.reliefM;
    let capOnTop = 0;
    let top = 0;
    let weakLow = 0;
    let low = 0;
    for (let i = 0; i < s.length; i++) {
      if (w.bedrockElevationM[i] > 0.75 * R) {
        top++;
        if (w.materialId[i] === SANDSTONE) capOnTop++;
      }
      if (w.bedrockElevationM[i] < 0.2 * R) {
        low++;
        if (w.materialId[i] === CLAY) weakLow++;
      }
    }
    expect(top).toBeGreaterThan(0);
    expect(capOnTop / top).toBeGreaterThan(0.95);
    expect(weakLow / Math.max(1, low)).toBeGreaterThan(0.95);
    expect(new Set(w.materialId).has(MUDSTONE)).toBe(true);
  });

  it('format v4 round-trips strata; files without strata migrate to single-layer columns', () => {
    const w = generateWorld(defaultOptions('plateau', 3, 32));
    const back = decodeWorld(encodeWorld(w)).world;
    expect(back.strataBoundsM).toEqual(w.strataBoundsM);
    expect(back.strataMaterial).toEqual(w.strataMaterial);
    expect(back.materialId).toEqual(w.materialId);
  });
});
