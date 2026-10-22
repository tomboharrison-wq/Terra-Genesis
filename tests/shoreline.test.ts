import { describe, expect, it } from 'vitest';
import { BAY, defaultShorelineParams, NX, ShorelineModel, type ShorelineParams } from '../src/local/shoreline/model';

const run = (patch: Partial<ShorelineParams>, years: number) => {
  const m = new ShorelineModel({ ...defaultShorelineParams(), ...patch });
  m.step(365 * years);
  return m;
};
const budgetError = (m: ShorelineModel) => m.sandM3() - m.initialM3 - m.suppliedM3 + m.exportedM3;

describe('M05-C04b one-line shoreline model (guided)', () => {
  it('conserves sand exactly: change = supplied − exported', () => {
    const m = new ShorelineModel(defaultShorelineParams());
    for (let k = 0; k < 10; k++) {
      m.step(365);
      expect(Math.abs(budgetError(m))).toBeLessThan(1e-3);
      for (const v of m.f) expect(v).toBeGreaterThanOrEqual(-1e-12);
    }
    expect(m.suppliedM3).toBeGreaterThan(0);
  }, 60000);

  it('zero wave energy changes nothing', () => {
    const m = run({ qMaxM3: 0 }, 3);
    const fresh = new ShorelineModel(defaultShorelineParams());
    expect(Array.from(m.f)).toEqual(Array.from(fresh.f));
  }, 60000);

  it('a bay-mouth bar grows across the bay and closes off a lagoon', () => {
    const m = new ShorelineModel(defaultShorelineParams());
    expect(m.lagoonCells()).toBe(0);
    m.step(365 * 26);
    // Most of the bay (40 × 26 cells) is cut off from the open sea.
    expect(m.lagoonCells()).toBeGreaterThan(600);
    // The bar is sand all the way across the mouth.
    for (let x = BAY.x0; x < BAY.x1; x++) {
      let sand = 0;
      for (let y = 34; y < 42; y++) sand += m.fill(x, y);
      expect(sand).toBeGreaterThan(0.9);
    }
    expect(Math.abs(budgetError(m))).toBeLessThan(1e-3);
  }, 120000);

  it('a spit grows from the coast end in the drift direction; without supply the updrift beach pays', () => {
    const fedM = run({ layout: 'spit' }, 10);
    const starvedM = run({ layout: 'spit', supply: false }, 10);
    const fed = fedM.spitStats();
    expect(fed.tipX).toBeGreaterThan(BAY.x0 + 20);
    expect(fed.crestY).toBeGreaterThan(BAY.y0 + 15); // out at the coast line, not along the bay floor
    // Without updrift supply the waves feed the spit by eroding the updrift beach instead.
    const updrift = (m: ShorelineModel) => {
      let s = 0;
      for (let y = 0; y < 60; y++) for (let x = 0; x < BAY.x0 - 4; x++) s += m.fill(x, y);
      return s;
    };
    expect(updrift(starvedM)).toBeLessThan(updrift(fedM) - 5);
  }, 120000);

  it('one-way waves build a straight spit; mixed waves curl its tip landward (recurve)', () => {
    const straight = run({ layout: 'spit', asymmetry: 0.8 }, 10).spitStats();
    const mixed = run({ layout: 'spit', asymmetry: 0.65 }, 10).spitStats();
    expect(straight.hookDepth).toBeLessThanOrEqual(3);
    expect(mixed.hookDepth).toBeGreaterThanOrEqual(4);
    expect(mixed.tipX).toBeLessThan(straight.tipX);
  }, 120000);

  it('is deterministic for a seed', () => {
    const a = run({ layout: 'spit' }, 2);
    const b = run({ layout: 'spit' }, 2);
    expect(Array.from(a.f)).toEqual(Array.from(b.f));
    expect(NX).toBe(120);
  }, 60000);
});
