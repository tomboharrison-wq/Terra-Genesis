import { describe, expect, it } from 'vitest';
import { createWorld, setUniformStrata, type WorldState } from '../src/engine/world';
import { Engine } from '../src/engine/engine';
import { averageSlipM, intensityAt, ruptureLengthKm } from '../src/sim/tectonics/earthquake';

/** 80 × 80 world of 10 m cells at 100 m with one layer boundary at 90 m. */
function world(): WorldState {
  const w = createWorld({ width: 80, height: 80, cellSizeM: 10, seed: 1, seaLevelM: -1000 });
  w.bedrockElevationM.fill(100);
  w.materialId.fill(1);
  setUniformStrata(w);
  for (let i = 0; i < 80 * 80; i++) {
    w.strataBoundsM[i * 3] = 90;
    w.strataMaterial[i * 4] = 1;
    w.strataMaterial[i * 4 + 1] = 3;
  }
  return w;
}

describe('M07-C05 earthquake tool', () => {
  it('magnitude scaling (Wells & Coppersmith 1994): M7 ≈ 41 km rupture, ≈ 1.1 m average slip', () => {
    expect(ruptureLengthKm(7)).toBeCloseTo(40.7, 0);
    expect(averageSlipM(7)).toBeCloseTo(1.07, 1);
    expect(ruptureLengthKm(6)).toBeLessThan(ruptureLengthKm(7));
    expect(intensityAt(7, 1)).toBeGreaterThan(intensityAt(7, 50));
  });

  it('a normal fault drops the hanging wall and lifts the footwall a little; strata move with the rock', () => {
    const e = new Engine(world());
    // Strike north (0°): one side of the fault drops (hanging wall), the other rises a little.
    const r = e.earthquake({ xM: 400, yM: 400, mw: 7, type: 'normal', strikeDeg: 0, landslides: false });
    const w = e.world;
    const east = w.bedrockElevationM[40 * 80 + 45];
    const west = w.bedrockElevationM[40 * 80 + 35];
    expect(Math.min(east, west)).toBeLessThan(100 - 0.5);
    expect(Math.max(east, west)).toBeGreaterThan(100);
    expect(r.maxDownM).toBeGreaterThan(r.maxUpM);
    const i = 40 * 80 + (east < west ? 45 : 35);
    expect(w.bedrockElevationM[i] - w.strataBoundsM[i * 3]).toBeCloseTo(10, 3);
  });

  it('a reverse fault raises the hanging wall', () => {
    const e = new Engine(world());
    const r = e.earthquake({ xM: 400, yM: 400, mw: 7, type: 'reverse', strikeDeg: 90, landslides: false });
    expect(r.maxUpM).toBeGreaterThan(r.maxDownM);
    expect(r.maxUpM).toBeGreaterThan(0.3);
  });

  it('a strike-slip rupture offsets a ridge that crosses it', () => {
    const w = world();
    for (let x = 0; x < 80; x++) w.bedrockElevationM[40 * 80 + x] = 130; // E–W ridge at row 40
    const e = new Engine(w);
    // Fault strikes north through x = 40; M8.4 → ≈ 6.8 m average slip ⇒ about one 10 m cell of offset.
    const r = e.earthquake({ xM: 400, yM: 400, mw: 8.4, type: 'strike-slip', strikeDeg: 0, landslides: false });
    expect(r.lateralCells).toBeGreaterThan(0);
    const ridge = (x: number) => {
      let best = 0;
      for (let y = 0; y < 80; y++) if (e.world.bedrockElevationM[y * 80 + x] > e.world.bedrockElevationM[best * 80 + x]) best = y;
      return best;
    };
    const a = ridge(30);
    const b = ridge(50);
    expect(a !== b).toBe(true); // one side moved along the fault
    expect(Math.abs(a - b)).toBeLessThanOrEqual(r.lateralCells + 1);
  });

  it('undo restores rock, soil and layers exactly', () => {
    const e = new Engine(world());
    const b0 = Array.from(e.world.bedrockElevationM);
    const s0 = Array.from(e.world.strataBoundsM);
    e.earthquake({ xM: 400, yM: 400, mw: 7.5, type: 'reverse', strikeDeg: 30, landslides: false });
    expect(e.history.undoLabel).toBe('M7.5 earthquake');
    e.undo();
    expect(Array.from(e.world.bedrockElevationM)).toEqual(b0);
    expect(Array.from(e.world.strataBoundsM)).toEqual(s0);
  });

  it('strong shaking triggers landslides on steep ground', () => {
    const w = world();
    for (let y = 0; y < 80; y++) for (let x = 0; x < 80; x++) w.bedrockElevationM[y * 80 + x] = 100 + Math.max(0, x - 40) * 12; // steep slope east
    w.looseSedimentThicknessM.fill(1);
    const e = new Engine(w);
    const r = e.earthquake({ xM: 400, yM: 400, mw: 7.2, type: 'normal', strikeDeg: 0, landslides: true });
    expect(r.landslides).toBeGreaterThan(0);
    expect(Math.max(...r.shaking)).toBeGreaterThanOrEqual(7);
  });
});
