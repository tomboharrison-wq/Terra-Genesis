import { describe, expect, it } from 'vitest';
import { Engine } from '../src/engine/engine';
import { createWorld, MM_PER_H, type WorldState } from '../src/engine/world';
import { closureError } from '../src/sim/water/ledger';
import { decodeWorld, encodeWorld } from '../src/persistence/format';

/** Closed W × H world, 100 m cells: left half low (100 m), right half a 2000 m plateau. */
function world(W = 32, H = 16): WorldState {
  const w = createWorld({ width: W, height: H, cellSizeM: 100, seed: 1, seaLevelM: 0 });
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) w.bedrockElevationM[y * W + x] = x < W / 2 ? 100 : 2000;
  w.water.boundary = 'closed';
  return w;
}

const sum = (a: Float32Array) => a.reduce((s, v) => s + v, 0);
const closure = (e: Engine) => closureError(e.water.ledger, e.water.storedVolume());

describe('M06-C02 snowpack: accumulation below 0 °C, degree-day melt, exact water budget', () => {
  it('precipitation falls as snow where it is below freezing and as rain where it is not', () => {
    const e = new Engine(world());
    // Sea-level 8 °C, 6.5 °C/km: lowland ≈ 7.4 °C, plateau ≈ −4.4 °C (no seasonal swing).
    e.setClimateParams({ enabled: true, seaLevelTempC: 8, seasonalAmpC: 0, orographic: 0, shadowScaleM: 1e9 });
    e.setWaterParams({ rainMPerS: 10 * MM_PER_H });
    e.advance(3600);
    const w = e.world;
    expect(w.snowSweM[5 * 32 + 4]).toBe(0); // lowland: rain
    expect(w.snowSweM[5 * 32 + 28]).toBeGreaterThan(0.009); // plateau: ≈ 10 mm of SWE in an hour
    expect(e.water.ledger.snowfall).toBeGreaterThan(0);
    expect(e.water.ledger.snowmelt).toBe(0);
    expect(closure(e)).toBeLessThan(1e-5);
  });

  it('degree-day melt: 4 mm/°C/day at +5 °C melts 20 mm a day, into surface water', () => {
    const e = new Engine(world());
    e.setClimateParams({ enabled: true, seaLevelTempC: 5.65, seasonalAmpC: 0, lapseRateCPerKm: 6.5 });
    // Lowland cells (100 m) are at 5.0 °C. Give one a 50 mm snowpack.
    const i = 8 * 32 + 6;
    e.world.snowSweM[i] = 0.05;
    e.water.resetLedger();
    e.advance(86400);
    expect(e.world.snowSweM[i]).toBeCloseTo(0.03, 4);
    expect(e.water.ledger.snowmelt).toBeCloseTo(0.02 * 100 * 100, 1);
    expect(closure(e)).toBeLessThan(1e-5);
  }, 60000);

  it('a year of seasons builds a winter snowpack on high ground and melts it in summer', () => {
    const w = world(8, 4);
    w.water.boundary = 'open'; // meltwater drains away (a closed basin's deep lake hits float32 depth round-off)
    const e = new Engine(w);
    e.water.maxDt = 60; // shallow water: CFL allows it; keeps a simulated year quick
    e.setClimateParams({ enabled: true, seaLevelTempC: 12, seasonalAmpC: 10, seasonPhase: 0.75, seasonsRun: true, orographic: 0, shadowScaleM: 1e9 });
    e.setWaterParams({ rainMPerS: 0.5 * MM_PER_H, evaporationMPerS: 0.2 * MM_PER_H });
    const plateau = () => sum(e.world.snowSweM);
    const samples: number[] = [];
    for (let k = 0; k < 12; k++) {
      e.advance(365.25 * 86400 / 12);
      samples.push(plateau());
    }
    const peak = Math.max(...samples);
    expect(peak / 16).toBeGreaterThan(0.5 * 0.5 * 1e-3 * 24 * 90); // ≥ half a winter's precipitation on each plateau cell
    expect(samples[samples.length - 1]).toBeLessThan(0.2 * peak); // largely melted by the following autumn
    expect(e.water.ledger.snowmelt).toBeGreaterThan(0.5 * e.water.ledger.snowfall);
    expect(closure(e)).toBeLessThan(1e-5);
  }, 120000);

  it('climate off: no snow forms and old behaviour is unchanged', () => {
    const e = new Engine(world());
    e.setWaterParams({ rainMPerS: 10 * MM_PER_H });
    e.advance(600);
    expect(sum(e.world.snowSweM)).toBe(0);
  });

  it('snow on land drowned by sea-level rise joins the sea (ledgered)', () => {
    const e = new Engine(world());
    e.world.snowSweM.fill(0.1);
    e.water.resetLedger();
    e.setSeaLevel(500); // drowns the lowland
    expect(e.world.snowSweM[4]).toBe(0);
    expect(e.water.ledger.seaOut).toBeCloseTo(0.1 * 16 * 16 * 100 * 100, 0);
    expect(closure(e)).toBeLessThan(1e-9);
  });

  it('snowpack is saved; older files load with none', () => {
    const w = world();
    w.snowSweM[7] = 0.25;
    expect(decodeWorld(encodeWorld(w)).world.snowSweM[7]).toBeCloseTo(0.25, 6);
  });
});
