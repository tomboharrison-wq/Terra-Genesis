import { describe, expect, it } from 'vitest';
import { createWorld, MM_PER_H, setUniformStrata } from '../src/engine/world';
import { Engine } from '../src/engine/engine';
import { FLOOD_THRESHOLD_M, floodSummary, surgeHeight } from '../src/sim/events/hazards';
import { closureError } from '../src/sim/water/ledger';

/** A valley sloping east to the sea: a channel down the middle, banks rising north and south. */
function valley() {
  const W = 48;
  const H = 32;
  const w = createWorld({ width: W, height: H, cellSizeM: 20, seed: 1, seaLevelM: 0 });
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const across = Math.abs(y - H / 2);
      w.bedrockElevationM[y * W + x] = x >= W - 4 ? -5 : 0.25 * (W - 4 - x) + 0.8 * across;
    }
  setUniformStrata(w);
  w.water.boundary = 'closed';
  w.water.infiltrationMPerS = 0;
  w.water.evaporationMPerS = 0;
  return new Engine(w);
}

/** A coast: sea in the east, a low plain (0.5–2.5 m) sloping to the sea, then a hill (> 8 m) in the west. */
function coast() {
  const W = 60;
  const H = 20;
  const w = createWorld({ width: W, height: H, cellSizeM: 20, seed: 2, seaLevelM: 0 });
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const z = x >= 40 ? -10 : x >= 20 ? 0.5 + (2 * (40 - x)) / 20 : 8 + 0.5 * (20 - x);
      w.bedrockElevationM[y * W + x] = z;
    }
  setUniformStrata(w);
  w.water.boundary = 'closed';
  w.water.infiltrationMPerS = 0;
  w.water.evaporationMPerS = 0;
  return new Engine(w);
}

describe('M11-C01 flood hazards', () => {
  it('surge profile rises smoothly, holds the set height and falls back to zero', () => {
    const e = { kind: 'surge' as const, surgeM: 4, activeS: 3600, rampS: 600 };
    expect(surgeHeight(e, 0)).toBe(0);
    expect(surgeHeight(e, 300)).toBeCloseTo(2, 6);
    expect(surgeHeight(e, 1800)).toBe(4);
    expect(surgeHeight(e, 3300)).toBeCloseTo(2, 6);
    expect(surgeHeight(e, 3600)).toBe(0);
    expect(surgeHeight({ ...e, kind: 'storm' }, 1800)).toBe(0);
  });

  it('flood summary counts only cells where the water rose by the threshold', () => {
    const start = Float32Array.from([0, 2, 0, 0]);
    const peak = Float32Array.from([0.1, 2.2, 0.3, 1.5]);
    const f = floodSummary(peak, start, 10);
    expect(f.cells).toBe(2); // the river cell (2 → 2.2 m) and the 0.1 m puddle do not count
    expect(f.areaM2).toBe(200);
    expect(f.peakDepthM).toBeCloseTo(1.5, 6);
  });

  it('storm: peak depth ≥ every depth seen, rain returns to normal on time, ledger closes, event logged', () => {
    const e = valley();
    const w = e.world;
    w.water.rainMPerS = 2 * MM_PER_H;
    e.startStorm(80, 1, 1);
    expect(w.water.rainMPerS).toBeCloseTo(80 * MM_PER_H, 15);
    const peak = e.flood!.peak;
    let deepest = 0;
    for (let k = 0; k < 24; k++) {
      e.advance(300);
      const d = w.waterDepthM;
      for (let i = 0; i < d.length; i++) {
        expect(peak[i]).toBeGreaterThanOrEqual(d[i]);
        deepest = Math.max(deepest, d[i]);
      }
      if (k === 10) expect(w.water.rainMPerS).toBeCloseTo(80 * MM_PER_H, 15); // 3300 s: still raining
      if (k === 12) expect(w.water.rainMPerS).toBeCloseTo(2 * MM_PER_H, 15); // 3900 s: storm over
    }
    e.advance(20); // the clock carries time shorter than one step over to the next call
    expect(e.hazard!.done).toBe(true);
    expect(e.water.peakDepth).toBeNull(); // recording stopped; the record itself is kept
    const f = e.floodSummary()!;
    let n = 0;
    for (let i = 0; i < peak.length; i++) if (peak[i] - e.flood!.start[i] >= FLOOD_THRESHOLD_M) n++;
    expect(f.cells).toBe(n);
    expect(f.areaM2).toBe(n * 400);
    expect(f.cells).toBeGreaterThan(5); // the channel floods
    expect(f.peakDepthM).toBeGreaterThanOrEqual(deepest - 1e-6);
    expect(closureError(e.water.ledger, e.water.storedVolume())).toBeLessThan(1e-4);
    expect(e.hazardLog.map((l) => l.text)).toEqual([expect.stringMatching(/began/), expect.stringMatching(/ended: .* km² flooded/)]);
  });

  it('sea surge floods the low coast only, returns to the old sea level and drains; ledger closes', () => {
    const e = coast();
    const w = e.world;
    const W = w.width;
    e.startSurge(3, 30, 90);
    let maxOnHill = 0;
    let wetPlain = 0;
    for (let k = 0; k < 24; k++) {
      e.advance(300);
      if (k === 4) {
        // 25 min in: the raised sea is over the plain.
        for (let y = 0; y < w.height; y++) for (let x = 20; x < 40; x++) if (w.waterDepthM[y * W + x] > 0.3) wetPlain++;
      }
      for (let y = 0; y < w.height; y++) for (let x = 0; x < 18; x++) maxOnHill = Math.max(maxOnHill, w.waterDepthM[y * W + x]);
    }
    expect(wetPlain).toBeGreaterThan(0.6 * 20 * w.height); // most of the plain under water
    expect(maxOnHill).toBe(0); // above the run-up nothing gets wet
    expect(w.seaLevelM).toBe(0);
    expect(e.water.surgeM).toBe(0);
    const f = e.floodSummary()!;
    expect(f.peakDepthM).toBeGreaterThan(1);
    expect(f.peakDepthM).toBeLessThan(3); // run-up minus ground height (plain ≥ 0.5 m)
    // Afterwards the sea takes the water back (the plain slopes to the sea).
    let left = 0;
    for (let i = 0; i < w.waterDepthM.length; i++) left += w.waterDepthM[i];
    expect(left * 400).toBeLessThan(0.1 * f.areaM2 * 1); // < 0.1 m average over the flooded area
    expect(closureError(e.water.ledger, e.water.storedVolume())).toBeLessThan(1e-4);
    const L = e.water.ledger;
    expect(L.surgeIn).toBeGreaterThan(0.5 * f.areaM2); // the sea pushed water onto the land …
    expect(L.seaOut).toBeGreaterThan(0.9 * L.surgeIn); // … and took (nearly) all of it back
  });
});
