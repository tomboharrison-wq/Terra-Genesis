import { describe, expect, it } from 'vitest';
import { Engine } from '../src/engine/engine';
import { computeSurface, createWorld, MM_PER_H, type WorldState } from '../src/engine/world';
import { ClimateField, YEAR_S } from '../src/sim/climate/climate';
import { closureError } from '../src/sim/water/ledger';
import { decodeWorld, encodeWorld } from '../src/persistence/format';

/** 64 × 32 world, 100 m cells, a north–south ridge (peak 1200 m) at x = 32 on 200 m plains. */
function ridgeWorld(): WorldState {
  const w = createWorld({ width: 64, height: 32, cellSizeM: 100, seed: 1, seaLevelM: 0 });
  for (let y = 0; y < 32; y++)
    for (let x = 0; x < 64; x++) w.bedrockElevationM[y * 64 + x] = 200 + 1000 * Math.max(0, 1 - Math.abs(x - 32) / 10);
  w.water.boundary = 'closed';
  return w;
}

const surfaceOf = (w: WorldState) => {
  const s = new Float32Array(w.width * w.height);
  computeSurface(w, s);
  return s;
};

describe('M06-C01 climate: temperature, season, orographic rain and rain shadow', () => {
  it('temperature falls with height at the lapse rate', () => {
    const w = ridgeWorld();
    w.climate.enabled = true;
    const c = new ClimateField(64 * 32);
    c.compute(w, surfaceOf(w));
    const low = c.temperatureC[5 * 64 + 2]; // 200 m
    const peak = c.temperatureC[5 * 64 + 32]; // 1200 m
    expect(low - peak).toBeCloseTo(6.5, 4);
  });

  it('season shifts temperature by twice the seasonal amplitude from winter to summer', () => {
    const w = ridgeWorld();
    w.climate.enabled = true;
    const c = new ClimateField(64 * 32);
    w.climate.seasonPhase = 0;
    c.computeTemperature(w, surfaceOf(w));
    const winter = c.temperatureC[0];
    w.climate.seasonPhase = 0.5;
    c.computeTemperature(w, surfaceOf(w));
    expect(c.temperatureC[0] - winter).toBeCloseTo(2 * w.climate.seasonalAmpC, 4);
  });

  it('wind from the west: wetter windward slope, rain shadow in the lee, map mean 1', () => {
    const w = ridgeWorld();
    w.climate.enabled = true;
    w.climate.windFromDeg = 270;
    const c = new ClimateField(64 * 32);
    c.compute(w, surfaceOf(w));
    const at = (x: number) => c.rainFactor[16 * 64 + x];
    const windward = at(27);
    const plainUp = at(5);
    const lee = at(40);
    const farLee = at(60);
    expect(windward).toBeGreaterThan(plainUp);
    expect(windward).toBeGreaterThan(2 * lee);
    expect(lee).toBeLessThan(plainUp);
    expect(farLee).toBeLessThan(plainUp); // the shadow persists over the lee plain
    let mean = 0;
    for (const v of c.rainFactor) mean += v;
    expect(mean / c.rainFactor.length).toBeCloseTo(1, 5);
    // Reverse the wind and the wet side swaps.
    w.climate.windFromDeg = 90;
    c.compute(w, surfaceOf(w));
    expect(at(37)).toBeGreaterThan(2 * at(24));
  });

  it('climate off is uniform forcing, identical to the pre-climate model', () => {
    const run = (withField: boolean) => {
      const w = ridgeWorld();
      const e = new Engine(w);
      if (!withField) e.water.climate = null;
      e.setWaterParams({ rainMPerS: 20 * MM_PER_H, evaporationMPerS: 2 * MM_PER_H, infiltrationMPerS: 1 * MM_PER_H });
      e.advance(300);
      return Array.from(e.world.waterDepthM);
    };
    expect(run(true)).toEqual(run(false));
  });

  it('spatial rain and temperature-dependent evaporation keep the water ledger closed', () => {
    const w = ridgeWorld();
    const e = new Engine(w);
    e.setClimateParams({ enabled: true, windFromDeg: 270, seaLevelTempC: 15 });
    e.setWaterParams({ rainMPerS: 30 * MM_PER_H, evaporationMPerS: 3 * MM_PER_H, infiltrationMPerS: 1 * MM_PER_H });
    e.advance(1200);
    const L = e.water.ledger;
    expect(L.evaporated).toBeGreaterThan(0);
    expect(L.infiltrated).toBeGreaterThan(0);
    expect(Math.abs(closureError(L, e.water.storedVolume()))).toBeLessThan(1e-5);
    // Total rain equals the map average × land area × time (the pattern only redistributes it).
    expect(L.rainIn).toBeCloseTo(30 * MM_PER_H * 1200 * 64 * 32 * 100 * 100, -1);
  });

  it('no evaporation where it is below freezing', () => {
    const w = ridgeWorld();
    const e = new Engine(w);
    e.setClimateParams({ enabled: true, seaLevelTempC: 2, seasonPhase: 0, seasonalAmpC: 4 });
    expect(e.climate.temperatureC[0]).toBeLessThan(0);
    expect(e.climate.evapFactor[0]).toBe(0);
  });

  it('seasons advance with simulated time when running', () => {
    const e = new Engine(ridgeWorld());
    e.setClimateParams({ enabled: true, seasonsRun: true, seasonPhase: 0 });
    const t0 = e.climate.temperatureC[0];
    e.advance(YEAR_S / 4); // a quarter of a year (no water: fast)
    expect(e.world.climate.seasonPhase).toBeCloseTo(0.25, 2);
    expect(e.climate.temperatureC[0]).toBeGreaterThan(t0 + 0.9 * e.world.climate.seasonalAmpC);
  }, 180000); // ~36 s alone (788k steps at the 10 s max step); slower under load — backlog M11-C05

  it('climate settings are saved; older files load with climate off', () => {
    const w = ridgeWorld();
    w.climate = { ...w.climate, enabled: true, windFromDeg: 200, orographic: 1.5 };
    const back = decodeWorld(encodeWorld(w)).world;
    expect(back.climate).toEqual(w.climate);
    const old = { ...w } as Partial<WorldState>;
    delete old.climate;
    const migrated = decodeWorld(encodeWorld(old as WorldState)).world;
    expect(migrated.climate.enabled).toBe(false);
  });
});
