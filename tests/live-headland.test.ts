import { describe, expect, it } from 'vitest';
import { advanceHeadland, buildLiveHeadlandWorld, headlandModel } from '../src/sim/coast/solidHeadland';
import { cloneWorld } from '../src/engine/world';
import { decodeWorld, encodeWorld } from '../src/persistence/format';
import { Engine } from '../src/engine/engine';

describe('M19 live main-world solid headland', () => {
  it('forms a real arch, then loses its roof, with every removed voxel accounted for', () => {
    const w = buildLiveHeadlandWorld();
    const s = w.meta.solidHeadland!;
    let arch = false;
    for (let k = 0; k < 1500; k++) {
      advanceHeadland(w, 10);
      const m = headlandModel(s);
      if (m.currentStage === 'arch') {
        arch = true;
        expect(m.hasArchOpening()).toBe(true);
      }
      expect(m.count() + s.exportedM3).toBe(s.initialVoxels);
      if (m.currentStage === 'stump') break;
    }
    expect(arch).toBe(true);
    expect(s.history.map((h) => h.stage)).toEqual(['headland', 'cave', 'arch', 'stack', 'stump']);
    expect(s.erodedVoxels).toBeGreaterThan(0);
    expect(s.collapsedVoxels).toBeGreaterThan(0);
  }, 30000);

  it('split runs and a file reload preserve damage, fractional time and future evolution exactly', () => {
    const whole = buildLiveHeadlandWorld();
    const split = cloneWorld(whole);
    advanceHeadland(whole, 717);
    advanceHeadland(split, 153);
    const restored = decodeWorld(encodeWorld(split)).world;
    for (const y of [4, 90, 170, 300]) advanceHeadland(restored, y);
    expect(restored.meta.solidHeadland).toEqual(whole.meta.solidHeadland);
    expect(restored.bedrockElevationM).toEqual(whole.bedrockElevationM);
  }, 30000);

  it('waves off pauses the rock; stronger waves and weaker joints change the actual solid', () => {
    const calm = buildLiveHeadlandWorld();
    const fast = cloneWorld(calm);
    const weak = cloneWorld(calm);
    calm.coast.wavesOn = false;
    advanceHeadland(calm, 300);
    expect(calm.meta.solidHeadland!.step).toBe(0);
    calm.coast.wavesOn = true;
    fast.coast.waveHeightM = 4;
    weak.meta.solidHeadland!.params.jointFactor = 1;
    advanceHeadland(calm, 100);
    advanceHeadland(fast, 100);
    advanceHeadland(weak, 100);
    expect(fast.meta.solidHeadland!.exportedM3).toBeGreaterThan(calm.meta.solidHeadland!.exportedM3);
    expect(weak.meta.solidHeadland!.solid).not.toEqual(calm.meta.solidHeadland!.solid);
  });

  it('engine geological statistics, checkpoints and replay carry the actual rock state', () => {
    const e = new Engine(buildLiveHeadlandWorld());
    e.geoStep(203);
    const w = e.world;
    const frame = { years: e.geologicYears, bed: w.bedrockElevationM.slice(), soil: w.looseSedimentThicknessM.slice(),
      material: w.materialId.slice(), meander: null, solidHeadland: structuredClone(w.meta.solidHeadland) };
    const cp = cloneWorld(w);
    e.geoStep(400);
    e.restoreGeoFrame(frame);
    expect(e.world.meta.solidHeadland).toEqual(cp.meta.solidHeadland);
    e.geoStep(400);
    const direct = new Engine(cp);
    direct.geoStep(400);
    expect(e.world.meta.solidHeadland).toEqual(direct.world.meta.solidHeadland);
    expect(e.geoTotals.coastEroded).toBeGreaterThan(0);
  });
});
