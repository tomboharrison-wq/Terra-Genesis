import { describe, expect, it } from 'vitest';
import { advanceWaterfall, buildLiveWaterfallWorld, waterfallMetrics, waterfallRock, FALL_CHANNEL_Y0, FALL_CHANNEL_Y1 } from '../src/sim/river/solidWaterfall';
import { cloneWorld, validateWorld } from '../src/engine/world';
import { decodeWorld, encodeWorld } from '../src/persistence/format';
import { Engine } from '../src/engine/engine';

describe('M19 solid main-world river waterfall', () => {
  it('rejects damaged solid saves and keeps the incoming river below its fixed banks', () => {
    const w = buildLiveWaterfallWorld();
    expect(validateWorld(w)).toEqual([]);
    expect(w.bedrockElevationM[20 * w.width + 10]).toBeLessThan(w.bedrockElevationM[10 * w.width + 10]);
    w.meta.solidWaterfall!.solid.pop();
    expect(() => decodeWorld(encodeWorld(w))).toThrow('solid domain field size mismatch');
    w.meta.solidWaterfall!.hardFactor = -1;
    expect(validateWorld(w)).toContain('invalid waterfall parameters');
  });

  it('river attack cuts a pool and an actual undercut, then removes unsupported cap and retreats', () => {
    const w = buildLiveWaterfallWorld(), s = w.meta.solidWaterfall!;
    expect(waterfallMetrics(s).retreatM).toBe(0);
    expect(waterfallMetrics(s).undercutM).toBe(0);
    advanceWaterfall(w, 25);
    const first = waterfallMetrics(s);
    expect(first.poolDepthM).toBeGreaterThan(0);
    expect(first.undercutM).toBeGreaterThan(0);
    const rock = waterfallRock(s).solid;
    expect(rock[26 * 96 + first.lip]).toBe(1);
    expect(rock[25 * 96 + first.lip]).toBe(0);
    advanceWaterfall(w, 75);
    expect(waterfallMetrics(s).retreatM).toBeGreaterThan(0);
    advanceWaterfall(w, 200);
    expect(waterfallMetrics(s).retreatM).toBeGreaterThan(0);
    expect(s.collapsedM3).toBeGreaterThan(0);
    expect(s.erodedM3).toBeGreaterThan(0);
    const volume = waterfallRock(s).solid.reduce((a, v) => a + v, 0) * (FALL_CHANNEL_Y1 - FALL_CHANNEL_Y0);
    expect(volume + s.exportedM3).toBe(s.initialRockM3);
    expect(s.erodedM3 + s.collapsedM3).toBe(s.exportedM3);
  });

  it('dry river cannot erode; higher discharge changes actual rock sooner', () => {
    const dry = buildLiveWaterfallWorld(), wet = cloneWorld(dry), fast = cloneWorld(dry);
    dry.meta.solidWaterfall!.dischargeM3PerS = 0;
    fast.meta.solidWaterfall!.dischargeM3PerS = 24;
    for (const w of [dry, wet, fast]) advanceWaterfall(w, 100);
    expect(dry.meta.solidWaterfall!.exportedM3).toBe(0);
    expect(fast.meta.solidWaterfall!.exportedM3).toBeGreaterThan(wet.meta.solidWaterfall!.exportedM3);
  });

  it('save/reload, split runs and replay preserve the solid, damage and continued retreat', () => {
    const whole = buildLiveWaterfallWorld(), split = cloneWorld(whole);
    advanceWaterfall(whole, 300.7);
    advanceWaterfall(split, 25.2);
    const saved = decodeWorld(encodeWorld(split)).world;
    advanceWaterfall(saved, 275.5);
    expect(saved.meta.solidWaterfall).toEqual(whole.meta.solidWaterfall);
    const e = new Engine(saved);
    const frame = { years: 300.7, bed: saved.bedrockElevationM.slice(), soil: saved.looseSedimentThicknessM.slice(), material: saved.materialId.slice(), meander: null,
      solidWaterfall: structuredClone(saved.meta.solidWaterfall) };
    e.geoStep(100);
    e.restoreGeoFrame(frame);
    expect(e.world.meta.solidWaterfall).toEqual(frame.solidWaterfall);
    expect(e.world.bedrockElevationM).toEqual(whole.bedrockElevationM);
  });
});
