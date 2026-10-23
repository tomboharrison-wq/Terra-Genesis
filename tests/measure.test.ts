import { describe, expect, it } from 'vitest';
import { createWorld, setUniformStrata, MM_PER_H } from '../src/engine/world';
import { Engine } from '../src/engine/engine';
import { cellAt, compass, parseCsv, pinPair, readCell, transect, transectCsv } from '../src/terrain/measure';
import { sampleBilinear } from '../src/terrain/heightfield';

/** 60 × 40 world of 10 m cells: a plane rising 0.1 m/m to the east from 50 m, with some soil and water. */
function world() {
  const w = createWorld({ width: 60, height: 40, cellSizeM: 10, seed: 1, seaLevelM: -100 });
  for (let y = 0; y < 40; y++) for (let x = 0; x < 60; x++) w.bedrockElevationM[y * 60 + x] = 50 + x;
  w.looseSedimentThicknessM.fill(0.5);
  w.materialId.fill(4);
  setUniformStrata(w);
  w.waterDepthM[20 * 60 + 30] = 0.75;
  w.vegCover[20 * 60 + 30] = 0.4;
  w.tephraM[20 * 60 + 30] = 0.2;
  w.iceThicknessM[10 * 60 + 10] = 12;
  w.lavaDepthM[10 * 60 + 40] = 3;
  w.lavaTempC[10 * 60 + 40] = 1000;
  return new Engine(w);
}

describe('M09-C01 measurements', () => {
  it('a pinned point reads the world arrays at its cell', () => {
    const e = world();
    e.world.water.rainMPerS = 20 * MM_PER_H;
    const r = readCell(e, 301, 199); // nearest cell (30, 20)
    expect([r.cellX, r.cellY]).toEqual([30, 20]);
    expect(r.elevationM).toBe(e.surface[20 * 60 + 30]);
    expect(r.bedrockM).toBe(80);
    expect(r.soilM).toBeCloseTo(0.5, 6);
    expect(r.slopeDeg).toBeCloseTo((Math.atan(0.1) * 180) / Math.PI, 4);
    expect(r.aspectDeg).toBeCloseTo(270, 4); // rises to the east → faces west
    expect(compass(r.aspectDeg!)).toBe('W');
    expect(r.rock).toMatch(/Chalk/);
    expect(r.waterDepthM).toBeCloseTo(0.75, 6);
    expect(r.plantsPct).toBeCloseTo(40, 4);
    expect(r.ashM).toBeCloseTo(0.2, 6);
    expect(r.rainMmH).toBeCloseTo(20, 6);
    expect(r.temperatureC).toBeNull(); // climate off: no invented temperature
    expect(readCell(e, 100, 100).iceM).toBe(12);
    const lava = readCell(e, 400, 100);
    expect(lava.lavaM).toBe(3);
    expect(lava.lavaC).toBe(1000);
    expect(readCell(e, 0, 0).lavaC).toBeNull();
    expect(cellAt(e.world, -50, 9999)).toEqual({ x: 0, y: 39, i: 39 * 60 });
  });

  it('distance, bearing, rise and gradient between two pins', () => {
    const e = world();
    const p = pinPair(e, 100, 100, 400, 500); // 300 m east, 400 m north
    expect(p.distanceM).toBeCloseTo(500, 9);
    expect(p.bearingDeg).toBeCloseTo((Math.atan2(300, 400) * 180) / Math.PI, 9);
    expect(p.riseM).toBeCloseTo(30, 4); // 0.1 m/m × 300 m east
    expect(p.gradient).toBeCloseTo(0.06, 6);
    expect(pinPair(e, 0, 0, 0, 100).bearingDeg).toBeCloseTo(0, 9);
    expect(pinPair(e, 0, 0, -100, 0).bearingDeg).toBeCloseTo(270, 9);
  });

  it('transect samples equal the bilinear surface and layer tops, and the CSV round-trips', () => {
    const e = world();
    const s = transect(e, e.referenceSurface, 15, 95, 455, 105, 41);
    const hf = { width: 60, height: 40, cellSizeM: 10, z: e.surface };
    expect(s.length).toBe(41);
    expect(s[40].distM).toBeCloseTo(Math.hypot(440, 10), 9);
    for (const q of s) {
      expect(q.surfaceM).toBeCloseTo(sampleBilinear(hf, q.xM, q.yM), 5);
      expect(q.surfaceM - q.bedrockM).toBeCloseTo(0.5, 5);
      expect(q.lavaTopM).toBeGreaterThanOrEqual(q.surfaceM);
    }
    const rows = parseCsv(transectCsv(s));
    expect(rows.length).toBe(41);
    expect(Object.keys(rows[0])).toEqual([
      'distance_m',
      'x_east_m',
      'y_north_m',
      'bedrock_top_m',
      'ground_surface_m',
      'reference_surface_m',
      'ice_top_m',
      'lava_top_m',
      'water_surface_m',
    ]);
    rows.forEach((r, k) => {
      expect(r.ground_surface_m).toBeCloseTo(s[k].surfaceM, 3);
      expect(r.distance_m).toBeCloseTo(s[k].distM, 3);
      expect(r.water_surface_m).toBe(s[k].waterM === null ? null : Number(s[k].waterM.toFixed(3)));
    });
  });
});
