import { describe, expect, it } from 'vitest';
import { createWorld, setUniformStrata, validateWorld, MM_PER_H, type WorldState } from '../src/engine/world';
import { Engine } from '../src/engine/engine';
import { defaultOptions, generateWorld } from '../src/terrain/generate';
import { VOLCANIC_ID } from '../src/sim/lava/lavaSim';

const ground = (w: WorldState, i: number) => w.bedrockElevationM[i] + w.looseSedimentThicknessM[i];

/** n × n plain at 100 m with a cone of the given height and flank slope at the centre. */
function cone(n: number, cs: number, heightM: number, slope: number): WorldState {
  const w = createWorld({ width: n, height: n, cellSizeM: cs, seed: 1, seaLevelM: -1000 });
  const c = n / 2;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) w.bedrockElevationM[y * n + x] = 100 + Math.max(0, heightM - Math.hypot(x - c, y - c) * cs * slope);
  w.materialId.fill(VOLCANIC_ID);
  setUniformStrata(w);
  for (let i = 0; i < n * n; i++) w.strataBoundsM[i * 3] = w.bedrockElevationM[i] - 20; // one buried layer boundary
  w.strataMaterial.fill(2);
  for (let i = 0; i < n * n; i++) w.strataMaterial[i * 4] = VOLCANIC_ID;
  return w;
}

describe('M08-C04 volcanic island, caldera and recovery', () => {
  it('the Volcanic island preset grows a new island from a sea-floor vent', { timeout: 60000 }, () => {
    const w = generateWorld({ ...defaultOptions('volcanic-island', 3), size: 128 });
    const n = w.width;
    const c = (n >> 1) * n + (n >> 1);
    let top = -Infinity;
    let land = 0;
    for (let i = 0; i < n * n; i++) {
      top = Math.max(top, ground(w, i));
      if (ground(w, i) > w.seaLevelM) land++;
    }
    expect(top).toBeGreaterThan(w.seaLevelM + 50);
    expect(land).toBeGreaterThan(50);
    // Sea all round: the map edges stay under water.
    for (let k = 0; k < n; k++) expect(ground(w, k)).toBeLessThan(w.seaLevelM);
    // Fresh volcanic rock or tephra at the summit; the old sea floor far away is untouched basalt.
    expect(w.materialId[c] === VOLCANIC_ID || w.tephraM[c] > 0).toBe(true);
    expect(validateWorld(w)).toEqual([]);
  });

  it('a caldera collapse removes exactly the chamber volume, moves the layers and is undoable', () => {
    const e = new Engine(cone(120, 10, 300, 0.6));
    const w = e.world;
    const s0 = Array.from(e.surface);
    const b0 = Array.from(w.strataBoundsM);
    const r = e.caldera({ xM: 600, yM: 600, radiusM: 150, depthM: 80 });
    expect(r.cells).toBeGreaterThan(200);
    expect(r.volumeM3).toBeCloseTo(r.cells * 100 * 80, -1);
    const c = 60 * 120 + 60;
    expect(s0[c] - e.surface[c]).toBeCloseTo(80, 3);
    expect(b0[c * 3] - w.strataBoundsM[c * 3]).toBeCloseTo(80, 3);
    // Ring-fault wall: just outside the radius the ground did not drop.
    expect(e.surface[60 * 120 + 60 + 17]).toBeCloseTo(s0[60 * 120 + 60 + 17], 3);
    expect(e.history.undoLabel).toBe('Caldera collapse');
    e.undo();
    expect(Array.from(e.surface)).toEqual(s0);
  });

  it('rain collects in the caldera as a crater lake', { timeout: 60000 }, () => {
    const e = new Engine(cone(80, 10, 200, 0.5));
    const r = e.caldera({ xM: 400, yM: 400, radiusM: 120, depthM: 60 });
    e.setWaterParams({ rainMPerS: 150 * MM_PER_H }); // a cloudburst: 0.15 m in an hour
    e.advance(3600);
    const w = e.world;
    // The dropped block keeps its old cone shape, so water gathers in a moat against the ring-fault wall.
    let held = 0;
    let deepest = 0;
    for (let y = 0; y < 80; y++)
      for (let x = 0; x < 80; x++)
        if (Math.hypot(x - 40, y - 40) <= 12) {
          held += w.waterDepthM[y * 80 + x] * 100;
          deepest = Math.max(deepest, w.waterDepthM[y * 80 + x]);
        }
    const fell = r.cells * 100 * 0.15; // 1 h × 150 mm/h on the caldera floor
    expect(held).toBeGreaterThan(0.9 * fell); // a closed basin keeps (almost) all its rain
    expect(deepest).toBeGreaterThan(0.3); // pooled deeper than the 0.15 m that fell
    // Rain on the outer flanks runs off: little stays there.
    expect(w.waterDepthM[40 * 80 + 40 + 25]).toBeLessThan(0.05);
  });

  it('plants come back on ash soon, but not on bare new lava rock', { timeout: 120000 }, () => {
    const w = createWorld({ width: 120, height: 120, cellSizeM: 30, seed: 1, seaLevelM: -1000 });
    w.bedrockElevationM.fill(100);
    setUniformStrata(w);
    const e = new Engine(w);
    e.setVegetationParams({ enabled: true });
    // Ash first (it covers the map thinly), then a shield whose lava buries the ash it flows over.
    e.addVent(2700, 1800, 200, 'basalt', 3 * 3600, 'explosive');
    e.advance(3 * 3600 + 700);
    const b = e.buildVolcano(1200, 1800, 'shield', 2);
    while (b.step());
    e.vegetation.run(40); // forty plant years
    const lavaCell = 60 * 120 + 40;
    let ashCell = -1;
    for (let x = 95; x < 120 && ashCell < 0; x++) {
      const i = 60 * 120 + x;
      if (w.tephraM[i] > 0.3 && w.materialId[i] !== VOLCANIC_ID) ashCell = i;
    }
    expect(w.materialId[lavaCell]).toBe(VOLCANIC_ID);
    expect(w.looseSedimentThicknessM[lavaCell]).toBe(0);
    expect(w.vegCover[lavaCell]).toBe(0); // no soil on fresh lava yet (weathering must make it first)
    expect(ashCell).toBeGreaterThan(0);
    expect(w.vegCover[ashCell]).toBeGreaterThan(0.3);
  });
});
