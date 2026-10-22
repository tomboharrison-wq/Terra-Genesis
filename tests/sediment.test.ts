import { describe, expect, it } from 'vitest';
import { createWorld, computeSurface, validateWorld, setUniformStrata, MM_PER_H, type WorldState } from '../src/engine/world';
import { WaterSim } from '../src/sim/water/waterSim';
import { SedimentSim, sedimentClosure } from '../src/sim/sediment/sedimentSim';
import { decodeWorld, encodeWorld } from '../src/persistence/format';

function setup(N: number, cs: number, zf: (x: number, y: number) => number, opts: { sea?: number; loose?: number; mat?: number } = {}) {
  const w = createWorld({ width: N, height: N, cellSizeM: cs, seed: 1, seaLevelM: opts.sea ?? -1e6 });
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) w.bedrockElevationM[y * N + x] = zf(x, y);
  w.looseSedimentThicknessM.fill(opts.loose ?? 0.5);
  w.materialId.fill(opts.mat ?? 2);
  setUniformStrata(w);
  w.erosion.enabled = true;
  const s = new Float32Array(N * N);
  computeSurface(w, s);
  const water = new WaterSim(w, s);
  const sed = new SedimentSim(w, s, water);
  return { w, s, water, sed };
}

function run(water: WaterSim, sed: SedimentSim, seconds: number) {
  let t = 0;
  while (t < seconds) {
    const dt = water.stableDt();
    water.step(dt);
    sed.step(dt);
    t += dt;
  }
}

/** Total solid volume on the map: bedrock + loose + suspended (m³). */
function solids(w: WorldState) {
  let v = 0;
  for (let i = 0; i < w.bedrockElevationM.length; i++) v += w.bedrockElevationM[i] + w.looseSedimentThicknessM[i] + w.sedimentSuspendedM[i];
  return v * w.cellSizeM * w.cellSizeM;
}

describe('M03 sediment: erosion, transport, deposition', () => {
  it('no water → no erosion; erosion disabled → nothing changes', () => {
    const a = setup(24, 10, (x) => x);
    const b0 = a.w.bedrockElevationM.slice();
    run(a.water, a.sed, 600);
    expect(a.w.bedrockElevationM).toEqual(b0);
    const b = setup(24, 10, (x) => x);
    b.w.erosion.enabled = false;
    b.w.water.sources.push({ id: 1, x: 20, y: 12, rateM3PerS: 5 });
    run(b.water, b.sed, 600);
    expect(b.w.looseSedimentThicknessM.every((v) => v === 0.5)).toBe(true);
  });

  it('flow down a slope erodes upstream and the ledger closes; solids are conserved up to export', () => {
    const { w, water, sed } = setup(40, 10, (x) => x * 1.0);
    w.water.sources.push({ id: 1, x: 36, y: 20, rateM3PerS: 8 });
    const v0 = solids(w);
    run(water, sed, 3600);
    const L = sed.ledger;
    expect(L.erodedLoose + L.erodedBedrock).toBeGreaterThan(10);
    expect(sedimentClosure(L, sed.suspendedVolume())).toBeLessThan(1e-4);
    // Independent check: solids lost from the map == exported off the edge.
    expect(Math.abs(v0 - solids(w) - L.edgeExport)).toBeLessThan(1e-3 * (L.erodedLoose + L.erodedBedrock) + 0.5);
    expect(validateWorld(w)).toEqual([]);
  });

  it('resistant rock erodes less than weak rock under identical flow (two-rocks fixture)', () => {
    const mk = (mat: number) => {
      const r = setup(40, 10, (x) => x * 1.0, { loose: 0, mat });
      r.w.water.sources.push({ id: 1, x: 36, y: 20, rateM3PerS: 8 });
      run(r.water, r.sed, 3600);
      return r.sed.ledger.erodedBedrock;
    };
    const hard = mk(0); // crystalline, erodibility 0.1
    const weak = mk(3); // clay, erodibility 1.6
    expect(weak).toBeGreaterThan(hard * 5);
    expect(hard).toBeGreaterThan(0);
  });

  it('sediment-fan fixture: steep channel entering a flat basin deposits where it slows', () => {
    // Steep ramp x≥20, flat basin x<20, closed walls, so sediment cannot leave.
    const { w, water, sed } = setup(40, 10, (x) => (x >= 20 ? (x - 20) * 1.5 : 0));
    w.water.boundary = 'closed';
    w.water.sources.push({ id: 1, x: 37, y: 20, rateM3PerS: 6 });
    const loose0 = w.looseSedimentThicknessM.slice();
    run(water, sed, 2 * 3600);
    let gainedFlat = 0;
    let lostRamp = 0;
    for (let y = 0; y < 40; y++)
      for (let x = 0; x < 40; x++) {
        const i = y * 40 + x;
        const dl = w.looseSedimentThicknessM[i] - loose0[i];
        if (x <= 22) gainedFlat += Math.max(0, dl); // basin + slope break (fan apex)
        if (x >= 24) lostRamp += Math.max(0, -dl);
      }
    expect(lostRamp).toBeGreaterThan(0.5);
    // Most eroded material settles where the gradient breaks, not on the steep ramp.
    expect(gainedFlat).toBeGreaterThan(0.7 * lostRamp);
    expect(sed.ledger.edgeExport).toBe(0);
    expect(sedimentClosure(sed.ledger, sed.suspendedVolume())).toBeLessThan(1e-4);
  });

  it('delta-mouth fixture: sediment reaching the sea builds the sea floor', () => {
    // Land slopes down into sea at x < 10 (sea level 0).
    const { w, water, sed } = setup(40, 10, (x) => (x - 10) * 0.8, { sea: 0, loose: 1 });
    w.water.sources.push({ id: 1, x: 37, y: 20, rateM3PerS: 8 });
    const z0 = new Float32Array(40 * 40);
    computeSurface(w, z0);
    run(water, sed, 3 * 3600);
    expect(sed.ledger.seaDeposited).toBeGreaterThan(1);
    let raised = 0;
    for (let y = 0; y < 40; y++) for (let x = 0; x < 10; x++) raised += Math.max(0, w.bedrockElevationM[y * 40 + x] + w.looseSedimentThicknessM[y * 40 + x] - z0[y * 40 + x]);
    // Sea floor rose by at least the sea-deposited volume share (some cells emerge and then gain land deposits too).
    expect(raised * 100).toBeGreaterThan(0.9 * sed.ledger.seaDeposited);
    expect(sedimentClosure(sed.ledger, sed.suspendedVolume())).toBeLessThan(1e-4);
  });

  it('long rain on bumpy terrain: no NaN, no negative fields, no explosive spikes', () => {
    const { w, s, water, sed } = setup(48, 20, (x, y) => 40 + 15 * Math.sin(x * 0.3) * Math.cos(y * 0.25) + x * 0.6);
    w.water.rainMPerS = 80 * MM_PER_H;
    let zmax0 = -Infinity;
    for (const v of s) zmax0 = Math.max(zmax0, v);
    run(water, sed, 4 * 3600);
    expect(validateWorld(w)).toEqual([]);
    let zmax1 = -Infinity;
    for (const v of s) zmax1 = Math.max(zmax1, v);
    expect(zmax1).toBeLessThanOrEqual(zmax0 + 1e-3);
    expect(sedimentClosure(sed.ledger, sed.suspendedVolume())).toBeLessThan(1e-4);
  }, 60000);

  it('hillslope creep smooths grid-scale roughness, conserves loose sediment exactly, never touches bedrock', () => {
    const { w, s, water, sed } = setup(32, 10, () => 10, { loose: 0 });
    w.erosion.creepK = 0.002;
    // Checkerboard of ±0.5 m loose sediment bumps on a flat bedrock plain.
    for (let i = 0; i < 32 * 32; i++) w.looseSedimentThicknessM[i] = ((i % 32) + Math.floor(i / 32)) % 2 ? 1 : 0;
    computeSurface(w, s);
    const tot = () => w.looseSedimentThicknessM.reduce((a, v) => a + v, 0);
    const rough = () => {
      let r = 0;
      for (let i = 1; i < 32 * 32; i++) r += Math.abs(s[i] - s[i - 1]);
      return r;
    };
    const t0 = tot();
    const r0 = rough();
    const b0 = w.bedrockElevationM.slice();
    run(water, sed, 1800);
    expect(rough()).toBeLessThan(0.2 * r0);
    expect(Math.abs(tot() - t0)).toBeLessThan(1e-3);
    expect(w.bedrockElevationM).toEqual(b0);
    expect(w.looseSedimentThicknessM.every((v) => v >= 0)).toBe(true);
  });

  it('format v3 round-trips suspended sediment and erosion params', () => {
    const { w } = setup(8, 10, () => 1);
    w.sedimentSuspendedM[3] = 0.25;
    w.erosion.speedup = 42;
    const back = decodeWorld(encodeWorld(w)).world;
    expect(back.sedimentSuspendedM).toEqual(w.sedimentSuspendedM);
    expect(back.erosion).toEqual(w.erosion);
  });
});
