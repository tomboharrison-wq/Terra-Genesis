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

describe('M07-C02 faults: rift blocks and transform offsets', () => {
  it('rifts drop in fault-bounded steps (scarps), with raised shoulders', () => {
    const { w, t } = twoPlates({ vxMmYr: -15 }, { vxMmYr: 15 });
    w.tectonics.beltWidthM = 4000; // blocks 1 km = 2 cells wide
    t.run(20000);
    const prof = Array.from({ length: 12 }, (_, k) => row(w, 31 - k));
    // Graben deepest, then steps; a shoulder above the starting level; flat beyond.
    expect(prof[0]).toBeLessThan(prof[2] - 1);
    expect(prof[2]).toBeLessThan(prof[4] - 1);
    expect(Math.max(...prof)).toBeGreaterThan(100);
    // Discrete scarps: most neighbouring cells equal, a few big jumps.
    const jumps = prof.slice(1).map((v, k) => Math.abs(v - prof[k])).filter((d) => d > 5);
    expect(jumps.length).toBeGreaterThanOrEqual(3);
    expect(jumps.length).toBeLessThanOrEqual(4);
  });

  it('a transform fault offsets a ridge that crosses it', () => {
    // East plate slides north past the west plate at 20 mm/yr: 500 m cells ⇒ one cell per 25 kyr.
    const { w, t } = twoPlates({ vyMmYr: 0 }, { vyMmYr: 20 });
    for (let x = 0; x < 64; x++) w.bedrockElevationM[10 * 64 + x] = 300; // E–W ridge at row 10
    t.run(100000);
    expect(t.ledger.shifts).toBe(4);
    const ridgeRow = (x: number) => {
      let best = 0;
      for (let y = 0; y < 32; y++) if (w.bedrockElevationM[y * 64 + x] > w.bedrockElevationM[best * 64 + x]) best = y;
      return best;
    };
    expect(ridgeRow(10)).toBe(10); // west side stays
    expect(ridgeRow(50)).toBe(14); // east side carried 4 cells north
    expect(t.ledger.slipM).toBeCloseTo(2000, 0);
  });

  it('shifting conserves ground except the ledgered strip ends', () => {
    const { w, t } = twoPlates({ vyMmYr: 0 }, { vyMmYr: -20 });
    for (let i = 0; i < 64 * 32; i++) w.bedrockElevationM[i] = 100 + (i % 7) * 3;
    const vol = () => w.bedrockElevationM.reduce((a, v, i) => a + v + w.looseSedimentThicknessM[i], 0) * w.cellSizeM * w.cellSizeM;
    const v0 = vol();
    t.run(50000);
    expect(t.ledger.shifts).toBe(2);
    expect(Math.abs(vol() - v0 - t.ledger.edgeExchange)).toBeLessThan(1e-3 * v0 * 1e-6 + 1);
  });
});

describe('M07-C03 subduction: trench, volcanic arc, guided cross-section', () => {
  it('ocean under continent: trench on the ocean side, arc volcanoes inland at the arc distance', () => {
    const { w, t } = twoPlates({ vxMmYr: 40, kind: 'oceanic' }, { vxMmYr: 0 });
    t.run(10000);
    expect(t.vents.length).toBeGreaterThan(0);
    for (const v of t.vents) {
      expect(w.plateId[v]).toBe(1); // overriding (continental) side only
      const x = v % 64;
      // 2.5 × 1.5 km = 3.75 km = 7.5 cells inland of the boundary (x = 32).
      expect(Math.abs(x - 32 - 7.5)).toBeLessThanOrEqual(1.5);
    }
    const v0 = t.vents[0];
    expect(w.bedrockElevationM[v0] - 100).toBeGreaterThan(80); // 0.25 × 40 mm/yr × 10 kyr = 100 m peak (+ belt)
    expect(w.materialId[v0]).toBe(5); // volcanic rock on top
    expect(row(w, 31)).toBeLessThan(100); // trench
    expect(t.ledger.volcanic).toBeGreaterThan(0);
  });

  it('two oceanic plates: an island arc rises out of the sea', () => {
    const { w, t } = twoPlates({ vxMmYr: 40, kind: 'oceanic' }, { vxMmYr: 0, kind: 'oceanic' });
    w.seaLevelM = 0;
    w.bedrockElevationM.fill(-60);
    t.run(20000);
    expect(t.vents.length).toBeGreaterThan(0);
    for (const v of t.vents) expect(w.plateId[v]).toBe(1); // the lower-id plate sinks
    expect(Math.max(...t.vents.map((v) => w.bedrockElevationM[v]))).toBeGreaterThan(0);
  });

  it('continent–continent collision has no arc', () => {
    const { t } = twoPlates({ vxMmYr: 20 }, { vxMmYr: -20 });
    t.run(10000);
    expect(t.vents.length).toBe(0);
  });

  it('cross-section geometry: steeper slabs put the arc closer to the trench; quakes follow the slab', async () => {
    const { subductionGeometry, MAX_QUAKE_DEPTH_KM } = await import('../src/local/subduction/model');
    const shallow = subductionGeometry({ convergenceMmYr: 50, dipDeg: 25, overriding: 'continental' });
    const steep = subductionGeometry({ convergenceMmYr: 50, dipDeg: 65, overriding: 'continental' });
    expect(steep.arcDistanceKm).toBeLessThan(shallow.arcDistanceKm);
    expect(steep.arcDistanceKm).toBeGreaterThan(40);
    expect(shallow.arcDistanceKm).toBeLessThan(400);
    for (const q of steep.quakes) {
      expect(q.z).toBeGreaterThan(0);
      expect(q.z).toBeLessThanOrEqual(MAX_QUAKE_DEPTH_KM + 20);
    }
    const shallowQuakes = steep.quakes.filter((q) => q.z < 100).length;
    expect(shallowQuakes).toBeGreaterThan(steep.quakes.length / 3); // most quakes are shallow
  });
});
