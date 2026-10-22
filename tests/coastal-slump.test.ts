import { describe, expect, it } from 'vitest';
import { analyse, ground, SOIL_PRESETS } from '../src/local/slump/model';
import { CoastalSlumpModel, defaultCoastalSlumpParams } from '../src/local/slump/coastal';

describe('M05-C06 coastal slumping with protective toe debris', () => {
  it('debris at the toe buttresses the cliff (FoS rises with apron size)', () => {
    const base = { ...SOIL_PRESETS.clay, heightM: 20, faceDeg: 45, saturation: 0.6 };
    const f = [0, 50, 100, 200].map((A) => analyse({ ...base, toeDebrisM2: A }).fos);
    for (let k = 1; k < f.length; k++) expect(f[k]).toBeGreaterThan(f[k - 1]);
    // The apron is real ground: it raises the profile in front of the toe and nowhere behind the crest.
    const p = { ...base, toeDebrisM2: 100 };
    expect(ground(p, 22)).toBeGreaterThan(ground(base, 22));
    expect(ground(p, -5)).toBe(ground(base, -5));
  });

  it('waves unload the toe and slumps recur; retreat and debris are accounted for', () => {
    const m = new CoastalSlumpModel(defaultCoastalSlumpParams());
    const debrisBefore: number[] = [];
    for (let y = 0; y < 160; y++) {
      const d = m.debrisM2;
      if (m.stepYear()) debrisBefore.push(d);
      expect(Math.abs(m.slumpedM2 - m.removedM2 - m.debrisM2)).toBeLessThan(1e-6);
    }
    expect(m.events.length).toBeGreaterThanOrEqual(2);
    // Every repeat failure came after the waves had carried the previous apron away.
    for (const d of debrisBefore.slice(1)) expect(d).toBeLessThan(1e-6);
    expect(m.crestM).toBeCloseTo(-m.events.reduce((a, e) => a + e.retreatM, 0), 9);
    for (const e of m.events) expect(e.areaM2).toBeGreaterThan(0);
  }, 60000);

  it('without waves the cliff fails at most once and the apron stays', () => {
    const m = new CoastalSlumpModel({ ...defaultCoastalSlumpParams(), waveEnergy: 0, saturation: 0.6 });
    for (let y = 0; y < 60; y++) m.stepYear();
    expect(m.events.length).toBeLessThanOrEqual(1);
    expect(m.removedM2).toBe(0);
    if (m.events.length) expect(m.debrisM2).toBeGreaterThan(0);
  }, 60000);

  it('stronger waves mean more frequent slumps and faster retreat', () => {
    const run = (E: number) => {
      const m = new CoastalSlumpModel({ ...defaultCoastalSlumpParams(), waveEnergy: E });
      for (let y = 0; y < 120; y++) m.stepYear();
      return m;
    };
    const lo = run(0.5);
    const hi = run(2);
    expect(hi.events.length).toBeGreaterThan(lo.events.length);
    expect(hi.crestM).toBeLessThan(lo.crestM);
  }, 60000);
});
