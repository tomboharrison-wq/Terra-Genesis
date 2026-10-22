import { describe, expect, it } from 'vitest';
import { computeSurface, createWorld, setUniformStrata, type WorldState } from '../src/engine/world';
import { generatePlates, TectonicsSim, type Plate } from '../src/sim/tectonics/plates';
import { Engine } from '../src/engine/engine';
import { decodeWorld, encodeWorld } from '../src/persistence/format';
import { generateWorld, defaultOptions } from '../src/terrain/generate';

/** 64 × 32 world of 500 m cells at 100 m: west half plate 0, east half plate 1. */
function twoPlates(p0: Partial<Plate>, p1: Partial<Plate>): { w: WorldState; s: Float32Array; t: TectonicsSim } {
  const w = createWorld({ width: 64, height: 32, cellSizeM: 500, seed: 1, seaLevelM: -1000 });
  w.bedrockElevationM.fill(100);
  w.materialId.fill(1);
  setUniformStrata(w);
  for (let y = 0; y < 32; y++) for (let x = 0; x < 64; x++) w.plateId[y * 64 + x] = x < 32 ? 0 : 1;
  w.tectonics.enabled = true;
  w.tectonics.plates = [
    { id: 0, name: 'West', kind: 'continental', vxMmYr: 0, vyMmYr: 0, ...p0 },
    { id: 1, name: 'East', kind: 'continental', vxMmYr: 0, vyMmYr: 0, ...p1 },
  ];
  const s = new Float32Array(64 * 32);
  computeSurface(w, s);
  return { w, s, t: new TectonicsSim(w, s) };
}

const row = (w: WorldState, x: number) => w.bedrockElevationM[16 * 64 + x];
const volume = (w: WorldState) => w.bedrockElevationM.reduce((a, v) => a + v, 0) * w.cellSizeM * w.cellSizeM;

describe('M07-C01 kinematic plates: boundaries and vertical deformation', () => {
  it('classifies boundaries from relative motion', () => {
    expect(twoPlates({ vxMmYr: 20 }, { vxMmYr: -20 }).t.boundary[16 * 64 + 31]).toBe(1); // convergent
    expect(twoPlates({ vxMmYr: -20 }, { vxMmYr: 20 }).t.boundary[16 * 64 + 31]).toBe(2); // divergent
    expect(twoPlates({ vyMmYr: 20 }, { vyMmYr: -20 }).t.boundary[16 * 64 + 31]).toBe(3); // transform
    expect(twoPlates({ vxMmYr: 20 }, { vxMmYr: -20 }).t.boundary[16 * 64 + 10]).toBe(0); // interior
  });

  it('converging continents raise a mountain belt at the expected rate', () => {
    const { w, t } = twoPlates({ vxMmYr: 20 }, { vxMmYr: -20 });
    const v0 = volume(w);
    t.run(10000);
    // Boundary: 0.2 × 40 mm/yr × 10 000 yr = 80 m of uplift.
    expect(row(w, 31) - 100).toBeCloseTo(80, 0);
    expect(row(w, 32) - 100).toBeCloseTo(80, 0);
    // Falls off with distance; untouched far away.
    expect(row(w, 28)).toBeLessThan(row(w, 31));
    expect(row(w, 28)).toBeGreaterThan(100);
    expect(row(w, 5)).toBe(100);
    expect(Math.abs(volume(w) - v0 - (t.ledger.uplifted - t.ledger.subsided)) / t.ledger.uplifted).toBeLessThan(1e-6);
  });

  it('diverging plates open a rift; transform boundaries change no heights', () => {
    const d = twoPlates({ vxMmYr: -15 }, { vxMmYr: 15 });
    d.t.run(10000);
    expect(row(d.w, 31)).toBeLessThan(100 - 50);
    expect(d.t.ledger.uplifted).toBe(0);
    const tr = twoPlates({ vyMmYr: 25 }, { vyMmYr: -25 });
    tr.t.run(10000);
    expect(tr.t.ledger.uplifted + tr.t.ledger.subsided).toBe(0);
  });

  it('ocean meets continent: a trench on the oceanic side, uplift on the continental side', () => {
    const { w, t } = twoPlates({ vxMmYr: 30, kind: 'oceanic' }, { vxMmYr: -10 });
    t.run(10000);
    expect(row(w, 31)).toBeLessThan(100);
    expect(row(w, 32)).toBeGreaterThan(100);
  });

  it('strata move with the rock: uplift does not change the exposed layer', () => {
    const { w, t } = twoPlates({ vxMmYr: 20 }, { vxMmYr: -20 });
    for (let i = 0; i < 64 * 32; i++) {
      w.strataBoundsM[i * 3] = 90; // sandstone above 90 m, then layer 2 below
      w.strataMaterial[i * 4] = 1;
      w.strataMaterial[i * 4 + 1] = 3;
    }
    t.run(10000);
    expect(w.materialId[16 * 64 + 31]).toBe(1);
    expect(w.strataBoundsM[(16 * 64 + 31) * 3]).toBeCloseTo(90 + 80, 0);
  });

  it('plate maps have no tiny fragments', () => {
    const w = generateWorld(defaultOptions('continental', 5, 96));
    const s = new Float32Array(96 * 96);
    computeSurface(w, s);
    generatePlates(w, 6, 3, s);
    // Every connected patch of one plate is at least 2 % of the map.
    const seen = new Uint8Array(96 * 96);
    for (let i = 0; i < seen.length; i++) {
      if (seen[i]) continue;
      const q = [i];
      seen[i] = 1;
      for (let k = 0; k < q.length; k++) {
        const c = q[k];
        const x = c % 96;
        const y = (c / 96) | 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= 96 || yy >= 96) continue;
          const j = yy * 96 + xx;
          if (!seen[j] && w.plateId[j] === w.plateId[c]) {
            seen[j] = 1;
            q.push(j);
          }
        }
      }
      expect(q.length).toBeGreaterThanOrEqual(Math.round(0.02 * 96 * 96));
    }
  });

  it('engine: plates run in tectonic time; seeded plate maps are reproducible; saved', () => {
    const w = generateWorld(defaultOptions('continental', 3, 64));
    const e = new Engine(w);
    e.newPlates(4, 9);
    const map1 = Array.from(e.world.plateId);
    e.newPlates(4, 9);
    expect(Array.from(e.world.plateId)).toEqual(map1);
    expect(new Set(map1).size).toBe(4);
    const s0 = e.surface.slice();
    e.setTectonicsParams({ enabled: true, yearsPerSimHour: 100000 });
    e.advance(1200);
    let changed = 0;
    for (let i = 0; i < s0.length; i++) if (e.surface[i] !== s0[i]) changed++;
    expect(changed).toBeGreaterThan(0);
    expect(e.tectonics.ledger.years).toBeCloseTo((1200 * 100000) / 3600, 0);
    const back = decodeWorld(encodeWorld(e.world)).world;
    expect(Array.from(back.plateId)).toEqual(Array.from(e.world.plateId));
    expect(back.tectonics.plates).toEqual(e.world.tectonics.plates);
    const s = new Float32Array(w.width * w.height);
    computeSurface(w, s);
    expect(generatePlates(w, 3, 1, s).length).toBe(3);
  }, 60000);
});
