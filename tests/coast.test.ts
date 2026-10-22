import { describe, expect, it } from 'vitest';
import { createWorld, computeSurface, setUniformStrata, type WorldState } from '../src/engine/world';
import { CoastSim, wavePower } from '../src/sim/coast/coastSim';
import { Engine } from '../src/engine/engine';
import { closureError } from '../src/sim/water/ledger';

/** Sea to the south (y < coastY), cliff of `cliffH` m above sea level 0, sea floor at −depth. */
function coastWorld(opts: { N?: number; coastY?: number; cliffH?: number; depth?: number; mat?: number; zf?: (x: number, y: number) => number } = {}) {
  const N = opts.N ?? 40;
  const coastY = opts.coastY ?? 12;
  const w = createWorld({ width: N, height: N, cellSizeM: 10, seed: 1, seaLevelM: 0 });
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) w.bedrockElevationM[y * N + x] = opts.zf ? opts.zf(x, y) : y >= coastY ? (opts.cliffH ?? 15) : -(opts.depth ?? 6);
  w.materialId.fill(opts.mat ?? 2);
  setUniformStrata(w);
  w.coast.wavesOn = true;
  w.coast.waveFromDeg = 180; // waves from the south, straight onshore
  const s = new Float32Array(N * N);
  computeSurface(w, s);
  const coast = new CoastSim(w, s);
  return { w, s, coast, N };
}

const solids = (w: WorldState) => {
  let v = 0;
  for (let i = 0; i < w.bedrockElevationM.length; i++) v += w.bedrockElevationM[i] + w.looseSedimentThicknessM[i];
  return v * w.cellSizeM * w.cellSizeM;
};

function runCoast(c: CoastSim, hours: number, speedup = 300) {
  for (let t = 0; t < hours * 3600; t += 600) c.run(600, speedup);
}

describe('M05 coast: waves and cliffs (C02)', () => {
  it('wave power follows the deep-water energy-flux formula', () => {
    expect(wavePower(2, 8)).toBeCloseTo((1025 * 9.81 * 9.81 * 4 * 8) / (64 * Math.PI), 6);
  });

  it('zero wave energy causes no marine erosion', () => {
    const { w, coast } = coastWorld();
    w.coast.waveHeightM = 0;
    const b0 = w.bedrockElevationM.slice();
    runCoast(coast, 6);
    expect(w.bedrockElevationM).toEqual(b0);
    expect(coast.ledger.cliffEroded).toBe(0);
  });

  it('waves erode the cliff foot and lay the debris offshore; solids are conserved', () => {
    const { w, coast } = coastWorld();
    const v0 = solids(w);
    runCoast(coast, 6);
    expect(coast.ledger.cliffEroded).toBeGreaterThan(10);
    expect(Math.abs(solids(w) - v0)).toBeLessThan(1e-3 * coast.ledger.cliffEroded + 0.01);
  });

  it('weak rock retreats more than resistant rock under identical waves', () => {
    const weak = coastWorld({ mat: 3 });
    const hard = coastWorld({ mat: 0 });
    runCoast(weak.coast, 6);
    runCoast(hard.coast, 6);
    expect(weak.coast.ledger.cliffBedrock).toBeGreaterThan(5 * hard.coast.ledger.cliffBedrock);
  });

  it('a coast sheltered behind an offshore island erodes less than an exposed one', () => {
    const island = (x: number, y: number) => (y >= 12 ? 15 : y >= 3 && y <= 5 && x >= 10 && x <= 29 ? 10 : -6);
    const { w, coast } = coastWorld({ zf: island });
    runCoast(coast, 3);
    // Mean exposure along the mainland shore behind the island vs beyond its ends.
    let behind = 0;
    let open = 0;
    for (let x = 14; x <= 25; x++) behind += coast.exposure[12 * w.width + x];
    for (const x of [1, 2, 3, 36, 37, 38]) open += coast.exposure[12 * w.width + x];
    expect(behind / 12).toBeLessThan(0.3 * (open / 6));
  });

  it('a widening shallow platform slows retreat (attenuation)', () => {
    const { coast } = coastWorld({ depth: 1.5, mat: 3 });
    runCoast(coast, 3);
    const first = coast.ledger.cliffEroded;
    runCoast(coast, 3);
    const second = coast.ledger.cliffEroded - first;
    expect(second).toBeLessThan(first);
  });
});

describe('M05 coast: longshore drift and spits (C03)', () => {
  it('oblique waves move beach sand alongshore in the expected direction, conserving it', () => {
    // Beach of loose sand on the foreshore along y = 11; waves from the south-west (225°) push sand east.
    const { w, coast, N } = coastWorld({ cliffH: 3, depth: 2 });
    w.coast.waveFromDeg = 225;
    w.coast.cliffK = 0;
    for (let x = 5; x < 15; x++) w.looseSedimentThicknessM[11 * N + x] = 1;
    const sum = () => w.looseSedimentThicknessM.reduce((a, v) => a + v, 0);
    const cx = () => {
      let m = 0;
      let mx = 0;
      for (let i = 0; i < N * N; i++) {
        m += w.looseSedimentThicknessM[i];
        mx += w.looseSedimentThicknessM[i] * (i % N);
      }
      return mx / m;
    };
    const s0 = sum();
    const c0 = cx();
    runCoast(coast, 2);
    expect(coast.ledger.drifted).toBeGreaterThan(0);
    expect(cx()).toBeGreaterThan(c0 + 1);
    expect(Math.abs(sum() - s0)).toBeLessThan(1e-4);
  });

  it('spit: drift past the end of a coast builds new land out into open water', () => {
    // Mainland only for x < 20; beyond it the sea opens up. Waves from the SW drive sand east.
    const zf = (x: number, y: number) => (y >= 12 && x < 20 ? 6 : -1.5);
    const { w, s, coast, N } = coastWorld({ zf });
    w.coast.waveFromDeg = 225;
    w.coast.cliffK = 0;
    for (let y = 9; y < 12; y++) for (let x = 2; x < 19; x++) w.looseSedimentThicknessM[y * N + x] = 1.2; // submerged sand supply
    computeSurface(w, s);
    let land0 = 0;
    for (let y = 0; y < N; y++) for (let x = 20; x < N; x++) if (s[y * N + x] >= 0) land0++;
    runCoast(coast, 24);
    let land1 = 0;
    for (let y = 0; y < N; y++) for (let x = 20; x < N; x++) if (s[y * N + x] >= 0) land1++;
    expect(land0).toBe(0);
    expect(land1).toBeGreaterThan(0);
  });
});

describe('M05-C01 sea level', () => {
  it('raising sea level floods low land, lowering exposes the shelf; water budget closes', () => {
    const { w } = coastWorld({ zf: (_x, y) => y - 15 }); // ramp from −15 to +24 m
    w.water.rainMPerS = 1e-5;
    const e = new Engine(w);
    e.advance(600);
    const seaCells = () => e.water.sea.reduce((a, v) => a + v, 0);
    const n0 = seaCells();
    e.setSeaLevel(5);
    expect(seaCells()).toBeGreaterThan(n0);
    e.advance(600);
    e.setSeaLevel(-5);
    expect(seaCells()).toBeLessThan(n0);
    e.advance(600);
    expect(closureError(e.water.ledger, e.water.storedVolume())).toBeLessThan(1e-4);
  });

  it('coastal processes run on their cadence inside the engine and change the shore', () => {
    const { w } = coastWorld();
    w.erosion.speedup = 300;
    const e = new Engine(w);
    const z0 = e.surface.slice();
    e.advance(3 * 3600);
    let changed = 0;
    for (let i = 0; i < z0.length; i++) if (Math.abs(e.surface[i] - z0[i]) > 1e-3) changed++;
    expect(changed).toBeGreaterThan(10);
    expect(e.coast.ledger.cliffEroded).toBeGreaterThan(0);
  });
});
