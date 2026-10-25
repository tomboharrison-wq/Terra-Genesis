import { describe, expect, it } from 'vitest';
import { createWorld, MM_PER_H, setUniformStrata } from '../src/engine/world';
import { Engine } from '../src/engine/engine';
import { generateWorld } from '../src/terrain/generate';
import { challengeById, CHALLENGES, loweredInZone, makeBaseline, newLand, raisedOnStartSea, seaInflowRate } from '../src/challenges/challenges';

const recompute = (e: Engine) => {
  for (let i = 0; i < e.surface.length; i++) e.surface[i] = e.world.bedrockElevationM[i] + e.world.looseSedimentThicknessM[i];
};

describe('M09-C04 challenge metrics', () => {
  it('sea inflow rate: windowed average, zero until a full window has passed', () => {
    const s = Array.from({ length: 13 }, (_, k) => ({
      t: k * 600,
      v: 10 * k * 600,
    })); // 10 m³/s for 2 h
    expect(seaInflowRate(s.slice(0, 12), 7200)).toBe(0); // 1 h 50 min of data
    expect(seaInflowRate(s, 7200)).toBeCloseTo(10, 9);
    // Only the last window counts: a burst long ago does not pass a dry spell now.
    const burst = [{ t: 0, v: 0 }, { t: 600, v: 1e6 }, ...Array.from({ length: 13 }, (_, k) => ({ t: 1200 + k * 600, v: 1e6 }))];
    expect(seaInflowRate(burst, 7200)).toBe(0);
  });

  it('delta, island and plateau metrics read the change since the start', () => {
    const w = createWorld({
      width: 20,
      height: 10,
      cellSizeM: 10,
      seed: 1,
      seaLevelM: 0,
    });
    for (let i = 0; i < 200; i++) w.bedrockElevationM[i] = i % 20 < 10 ? 20 : -5; // land west, sea east
    setUniformStrata(w);
    const e = new Engine(w);
    const def = challengeById('delta')!;
    const b = makeBaseline(e, def);
    expect(raisedOnStartSea(b, e.surface, 10)).toBe(0);
    // Deposit 2 m on 10 sea cells and 5 m on a land cell (land does not count).
    for (let y = 0; y < 10; y++) w.bedrockElevationM[y * 20 + 10] += 2;
    w.bedrockElevationM[0] += 5;
    recompute(e);
    expect(raisedOnStartSea(b, e.surface, 10)).toBeCloseTo(10 * 2 * 100, 6);
    expect(def.measure(e, b).pass).toBe(false); // 2,000 m³ < 500,000 m³
    // New land: raise 3 sea cells to 12 m above sea.
    for (const i of [15, 16, 17]) w.bedrockElevationM[i] = 12;
    recompute(e);
    const l = newLand(b, e.surface, w);
    expect(l.areaM2).toBe(300);
    expect(l.heightM).toBeCloseTo(12, 6);
    // Plateau zone: lowering inside the zone counts, outside does not.
    b.zone.fill(0);
    b.zone[0] = 1;
    w.bedrockElevationM[0] = 10; // 15 m below its start (20 + 5 … baseline was 20)
    w.bedrockElevationM[1] = 0;
    recompute(e);
    expect(loweredInZone(b, e.surface, 10)).toBeCloseTo(10 * 100, 6);
  });

  it('island challenge: fails on open sea, passes once enough high new land exists', () => {
    const def = challengeById('island')!;
    const e = new Engine(generateWorld(def.setup));
    const b = makeBaseline(e, def);
    expect(b.sea.every((v) => v === 1)).toBe(true); // all open sea at the start
    expect(def.measure(e, b).pass).toBe(false);
    const w = e.world;
    const c = w.width / 2;
    for (let y = 0; y < w.height; y++)
      for (let x = 0; x < w.width; x++)
        if (Math.hypot(x - c, y - c) < 7) w.bedrockElevationM[y * w.width + x] = w.seaLevelM + 40 - 4 * Math.hypot(x - c, y - c);
    recompute(e);
    const p = def.measure(e, b);
    expect(p.pass).toBe(true); // ≈ 0.12 km² of land, 40 m high
  });

  it('river challenge refuses to count heavy rain; plateau zone is the high ground; every setup generates', () => {
    const def = challengeById('river-to-sea')!;
    const e = new Engine(createWorld({ width: 10, height: 10, cellSizeM: 10, seed: 1 }));
    const b = makeBaseline(e, def);
    b.seaOut = Array.from({ length: 13 }, (_, k) => ({
      t: k * 600,
      v: 50 * k * 600,
    }));
    expect(def.measure(e, b).pass).toBe(true);
    e.world.water.rainMPerS = 30 * MM_PER_H;
    expect(def.measure(e, b).pass).toBe(false);
    const p = challengeById('plateau')!;
    const pw = generateWorld({ ...p.setup, size: 96 });
    const pe = new Engine(pw);
    const pb = makeBaseline(pe, p);
    const zoneCells = pb.zone.reduce((a, v) => a + v, 0);
    expect(zoneCells).toBeGreaterThan(50);
    for (let i = 0; i < pe.surface.length; i++) if (pb.zone[i]) expect(pe.surface[i]).toBeGreaterThanOrEqual(0.6 * pw.meta.reliefM);
    for (const c of CHALLENGES) expect(() => generateWorld({ ...c.setup, size: 64 })).not.toThrow();
  });
});
