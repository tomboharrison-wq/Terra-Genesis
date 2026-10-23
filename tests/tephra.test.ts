import { describe, expect, it } from 'vitest';
import { createWorld, setUniformStrata, type WorldState } from '../src/engine/world';
import { Engine } from '../src/engine/engine';
import { tephraClosure } from '../src/sim/lava/lavaSim';
import { coarseFraction, depositTephra, footprint, plumeHeightKm } from '../src/sim/lava/tephra';
import { decodeWorld, encodeWorld } from '../src/persistence/format';

function flat(n: number, cs: number): WorldState {
  const w = createWorld({ width: n, height: n, cellSizeM: cs, seed: 1, seaLevelM: -1000 });
  w.bedrockElevationM.fill(100);
  setUniformStrata(w);
  return w;
}

describe('M08-C02 tephra', () => {
  it('plume height follows Mastin et al. (2009); weaker columns drop more cinder near the vent', () => {
    expect(plumeHeightKm(1)).toBeCloseTo(2, 5);
    expect(plumeHeightKm(1000)).toBeCloseTo(10.5, 0);
    expect(coarseFraction(plumeHeightKm(10))).toBeGreaterThan(coarseFraction(plumeHeightKm(1e4)));
  });

  it('a footprint conserves volume: on the map + off the map = erupted', () => {
    const w = flat(100, 50);
    const s = new Float32Array(100 * 100).fill(100);
    const f = footprint(w, 20, 50, 3000, 300, 1000, 90);
    const r = depositTephra(w, s, f, 1e6, new Float64Array(100 * 100));
    expect(f.offMap).toBeGreaterThan(0.05); // the long downwind tail leaves this 5 km map
    expect(Math.abs(r.depositedM3 + r.offMapM3 - 1e6) / 1e6).toBeLessThan(1e-5);
  });

  it('thin ash on a very thick sediment column is not lost to float32 rounding', () => {
    const w = flat(100, 120);
    w.looseSedimentThicknessM.fill(3000); // float32 resolves only ≈ 0.25 mm here
    const s = new Float32Array(100 * 100).fill(3100);
    const res = new Float64Array(100 * 100);
    const f = footprint(w, 50, 50, 6000, 700, 2000, 45);
    let dep = 0;
    let off = 0;
    for (let k = 0; k < 20; k++) {
      const r = depositTephra(w, s, f, 2e5, res);
      dep += r.depositedM3;
      off += r.offMapM3;
    }
    const pending = res.reduce((a, b) => a + b, 0) * 120 * 120;
    expect(Math.abs(pending)).toBeGreaterThan(1); // rounding happened (either way) and is carried, not lost
    expect(Math.abs(dep + off + pending - 4e6) / 4e6).toBeLessThan(1e-9);
  });

  it('ash thins away from the vent and is stretched downwind', () => {
    const e = new Engine(flat(160, 50));
    e.setClimateParams({ windFromDeg: 270 }); // westerly: ash blows east
    e.world.lava.windSpeedMS = 15;
    e.addVent(4000, 4000, 100, 'andesite', 3600, 'explosive');
    e.advance(3700);
    const w = e.world;
    const at = (dx: number, dy: number) => w.looseSedimentThicknessM[(80 + dy) * 160 + 80 + dx];
    expect(at(1, 0)).toBeGreaterThan(at(10, 0)); // cinder rim (≈ 60 m out) > beyond
    expect(at(10, 0)).toBeGreaterThan(at(30, 0));
    expect(at(30, 0)).toBeGreaterThan(5 * at(-30, 0)); // downwind ≫ upwind
    expect(at(30, 0)).toBeGreaterThan(at(0, 30)); // downwind > crosswind
    expect(at(30, 0)).toBeGreaterThan(0);
    expect(w.tephraM[80 * 160 + 110]).toBeCloseTo(at(30, 0), 5);
    expect(tephraClosure(e.lava)).toBeLessThan(1e-4);
    expect(e.world.lava.vents.length).toBe(0); // finished vent leaves once its tephra is down
  });

  it('cinder builds a steep cone with a summit crater that stands at the angle of repose', { timeout: 30000 }, () => {
    const e = new Engine(flat(120, 10));
    e.addVent(600, 600, 200, 'basalt', 86400, 'explosive');
    e.advance(86400 + 120);
    const w = e.world;
    const z = (x: number, y: number) => w.bedrockElevationM[y * 120 + x] + w.looseSedimentThicknessM[y * 120 + x];
    let maxSlope = 0;
    for (let x = 40; x < 80; x++) maxSlope = Math.max(maxSlope, Math.abs(z(x + 1, 60) - z(x, 60)) / 10);
    const tan33 = Math.tan((33 * Math.PI) / 180);
    let rim = 0;
    for (let x = 40; x < 80; x++) rim = Math.max(rim, z(x, 60));
    expect(rim - 100).toBeGreaterThan(50); // a cone tens of metres high
    expect(rim - z(60, 60)).toBeGreaterThan(5); // with a crater round the vent
    expect(maxSlope).toBeGreaterThan(Math.tan((28 * Math.PI) / 180));
    expect(maxSlope).toBeLessThan(tan33 * 1.05);
    expect(tephraClosure(e.lava)).toBeLessThan(1e-4);
  });

  it('mixed eruptions give lava and tephra; ash buries plants; save / load keeps ash and styles', () => {
    const e = new Engine(flat(60, 20));
    e.world.vegCover.fill(1);
    e.addVent(600, 600, 20, 'basalt', 600, 'mixed');
    e.advance(300);
    expect(e.lava.ledger.erupted).toBeCloseTo(20 * 300 * 0.5, -1);
    expect(e.lava.ledger.tephraErupted).toBeCloseTo(20 * 300 * 0.5 * 2.6, -1);
    expect(e.world.vegCover[30 * 60 + 32]).toBeLessThan(1);
    const { world: w2 } = decodeWorld(encodeWorld(e.world));
    expect(Array.from(w2.tephraM)).toEqual(Array.from(e.world.tephraM));
    expect(w2.lava.vents[0].style).toBe('mixed');
  });
});
