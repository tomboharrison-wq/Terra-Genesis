import { describe, expect, it } from 'vitest';
import { computeSurface, createWorld, MM_PER_H, type WorldState } from '../src/engine/world';
import { ClimateField } from '../src/sim/climate/climate';
import { VegetationSim } from '../src/sim/vegetation/vegetationSim';
import { Engine } from '../src/engine/engine';
import { decodeWorld, encodeWorld } from '../src/persistence/format';

/** 40 × 10 strip, 100 m cells: height rises 0 → 3900 m along x (gentle slope 0.1), 1 m of soil. */
function strip(): WorldState {
  const w = createWorld({ width: 40, height: 10, cellSizeM: 1000, seed: 1, seaLevelM: -1 });
  for (let y = 0; y < 10; y++) for (let x = 0; x < 40; x++) w.bedrockElevationM[y * 40 + x] = x * 100;
  w.looseSedimentThicknessM.fill(1);
  w.climate = { ...w.climate, enabled: false, seaLevelTempC: 12, seasonalAmpC: 6, lapseRateCPerKm: 6.5 };
  w.vegetation = { ...w.vegetation, enabled: true, annualPrecipMm: 1000 };
  return w;
}

function make(w: WorldState) {
  const s = new Float32Array(w.width * w.height);
  computeSurface(w, s);
  const c = new ClimateField(w.width * w.height);
  c.compute(w, s);
  return new VegetationSim(w, s, c);
}

describe('M06-C04 vegetation: suitability, growth, treeline and erosion shield', () => {
  it('grows to the suitability where warm, wet and soiled; none above the treeline', () => {
    const w = strip();
    const v = make(w);
    v.run(40);
    const at = (x: number) => w.vegCover[5 * 40 + x];
    // Warmest month 18 °C at sea level → full warmth; treeline where 18 − 6.5·z/1000 = 6 → z ≈ 1850 m.
    expect(at(2)).toBeGreaterThan(0.8);
    expect(at(25)).toBe(0);
    expect(at(10)).toBeGreaterThan(at(16)); // thinning towards the treeline
    expect(v.suitability[5 * 40 + 2]).toBeCloseTo(at(2), 1);
  });

  it('nothing grows on bare rock, on cliffs, under ice or in a dry climate', () => {
    const w = strip();
    w.looseSedimentThicknessM[5 * 40 + 3] = 0; // bare rock
    w.iceThicknessM[5 * 40 + 4] = 50; // glacier
    const v = make(w);
    v.run(40);
    expect(w.vegCover[5 * 40 + 3]).toBe(0);
    expect(w.vegCover[5 * 40 + 4]).toBe(0);
    const dry = strip();
    dry.vegetation.annualPrecipMm = 120;
    const vd = make(dry);
    vd.run(40);
    expect(Math.max(...dry.vegCover)).toBe(0);
    // A cliff (slope ≥ 1) carries none.
    const cliff = strip();
    for (let y = 0; y < 10; y++) for (let x = 0; x < 40; x++) cliff.bedrockElevationM[y * 40 + x] = x * 1200;
    const vc = make(cliff);
    vc.run(40);
    expect(cliff.vegCover[5 * 40 + 1]).toBe(0);
  });

  it('dieback when conditions worsen is faster than growth', () => {
    const w = strip();
    const v = make(w);
    v.run(1);
    const grown1 = w.vegCover[5 * 40 + 2];
    v.run(60);
    w.vegetation.annualPrecipMm = 100; // drought
    v.run(1);
    const lost1 = 1 - w.vegCover[5 * 40 + 2] / 1;
    expect(lost1).toBeGreaterThan(grown1);
  });

  it('plant cover reduces hydraulic erosion (CPU sediment model)', () => {
    const run = (cover: number) => {
      const w = createWorld({ width: 48, height: 48, cellSizeM: 10, seed: 1, seaLevelM: -1e6 });
      for (let y = 0; y < 48; y++) for (let x = 0; x < 48; x++) w.bedrockElevationM[y * 48 + x] = x * 0.8;
      w.looseSedimentThicknessM.fill(0.5);
      w.vegCover.fill(cover);
      w.erosion.enabled = true;
      w.water.sources.push({ id: 1, x: 40, y: 24, rateM3PerS: 6 });
      const e = new Engine(w);
      e.advance(1200);
      return e.sediment.ledger.erodedLoose + e.sediment.ledger.erodedBedrock;
    };
    const bare = run(0);
    const forest = run(1);
    expect(bare).toBeGreaterThan(0);
    // Detachment is cut by 80 %, but water below capacity keeps picking up sediment further
    // downstream, so the total falls less (a transport-limited slope).
    expect(forest).toBeLessThan(0.8 * bare);
  }, 60000);

  it('engine runs vegetation in plant time; climate off still allows uniform growth', () => {
    const w = strip();
    w.water.rainMPerS = 0 * MM_PER_H;
    const e = new Engine(w);
    e.setVegetationParams({ yearsPerSimHour: 100 });
    e.advance(3600);
    expect(Math.max(...e.world.vegCover)).toBeGreaterThan(0.5);
    expect(e.vegetationRevision).toBeGreaterThan(0);
  }, 60000);

  it('cover is saved; older files load bare', () => {
    const w = strip();
    w.vegCover[7] = 0.75;
    const back = decodeWorld(encodeWorld(w)).world;
    expect(back.vegCover[7]).toBeCloseTo(0.75, 6);
    expect(back.vegetation).toEqual(w.vegetation);
  });
});
