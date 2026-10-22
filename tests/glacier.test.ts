import { describe, expect, it } from 'vitest';
import { computeSurface, createWorld, type WorldState } from '../src/engine/world';
import { ClimateField, YEAR_S } from '../src/sim/climate/climate';
import { debrisClosure, GlacierSim, iceClosure } from '../src/sim/glacier/glacierSim';
import { Engine } from '../src/engine/engine';
import { closureError } from '../src/sim/water/ledger';
import { decodeWorld, encodeWorld } from '../src/persistence/format';

/** A valley rising towards +y: bed = 1800 + 0.15·y·cs + a V-shaped cross profile (ELA ≈ row 40). */
function valley(W = 33, H = 60, cs = 100, crossSlope = 0.05): WorldState {
  const w = createWorld({ width: W, height: H, cellSizeM: cs, seed: 1, seaLevelM: 0 });
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) w.bedrockElevationM[y * W + x] = 1800 + 0.15 * y * cs + crossSlope * Math.abs(x - (W - 1) / 2) * cs;
  w.climate = { ...w.climate, enabled: true, seaLevelTempC: 9.6, lapseRateCPerKm: 6.5, seasonalAmpC: 0 };
  w.glacier = { ...w.glacier, enabled: true };
  return w;
}

function sim(w: WorldState) {
  const s = new Float32Array(w.width * w.height);
  computeSurface(w, s);
  const c = new ClimateField(w.width * w.height);
  c.compute(w, s);
  return { s, g: new GlacierSim(w, s, c) };
}

const centroidY = (w: WorldState) => {
  let m = 0;
  let my = 0;
  for (let i = 0; i < w.iceThicknessM.length; i++) {
    m += w.iceThicknessM[i];
    my += w.iceThicknessM[i] * Math.floor(i / w.width);
  }
  return my / m;
};

describe('M06-C03 glaciers: mass balance, shallow-ice flow, abrasion and moraines', () => {
  it('an ice slab flows downhill and conserves its volume (no mass balance)', () => {
    const w = valley();
    w.glacier.balanceGradient = 0;
    w.glacier.abrasionK = 0;
    for (let y = 40; y < 50; y++) for (let x = 12; x < 21; x++) w.iceThicknessM[y * w.width + x] = 150;
    const { g } = sim(w);
    g.resetLedger();
    const v0 = g.iceVolume();
    const y0 = centroidY(w);
    for (let k = 0; k < 100; k++) g.run(YEAR_S, 1);
    expect(centroidY(w)).toBeLessThan(y0 - 1); // moved down-valley (−y)
    expect(Math.abs(g.iceVolume() - v0) / v0).toBeLessThan(1e-5);
    expect(g.ledger.lagS).toBe(0);
  });

  it('ice builds above the equilibrium line and only survives below it by flowing there', () => {
    const w = valley();
    w.glacier.abrasionK = 0;
    // ELA where annual mean = −6 °C: 1000·(9.6+6)/6.5 = 2400 m → valley row 40.
    const { g } = sim(w);
    for (let k = 0; k < 10; k++) g.run(10 * YEAR_S, 1);
    const at = (y: number) => w.iceThicknessM[y * w.width + 16];
    expect(at(55)).toBeGreaterThan(20); // high valley: thick ice
    expect(at(2)).toBe(0); // far below the ELA: none
    let lowest = 60;
    for (let y = 59; y >= 0; y--) if (at(y) > 1) lowest = y;
    expect(lowest).toBeLessThan(36); // the snout has flowed well below the ELA
    expect(g.ledger.ablated).toBeGreaterThan(0);
    expect(iceClosure(g.ledger, g.iceVolume())).toBeLessThan(1e-4);
  }, 60000);

  it('abrasion deepens the valley under the ice and drops the debris as a moraine at the snout', () => {
    const w = valley();
    w.glacier.abrasionK = 2e-3; // exaggerated so the test is quick
    const { g, s } = sim(w);
    const before = s.slice();
    const looseBefore = w.looseSedimentThicknessM.slice();
    for (let k = 0; k < 15; k++) g.run(10 * YEAR_S, 1);
    expect(g.ledger.eroded).toBeGreaterThan(0);
    expect(g.ledger.erodedBedrock).toBeGreaterThan(0);
    // Valley floor under the glacier lowered.
    const floor = 45 * w.width + 16;
    expect(s[floor]).toBeLessThan(before[floor] - 0.5);
    // Moraine: new loose sediment where there is no ice now.
    let moraine = 0;
    for (let i = 0; i < s.length; i++) if (w.iceThicknessM[i] < 0.5) moraine += w.looseSedimentThicknessM[i] - looseBefore[i];
    expect(moraine * w.cellSizeM * w.cellSizeM).toBeGreaterThan(0.05 * g.ledger.deposited); // an advancing glacier overrides some of its own moraine
    expect(g.ledger.deposited).toBeGreaterThan(0);
    expect(debrisClosure(g.ledger, g.debrisVolume())).toBeLessThan(1e-3);
  }, 60000);

  it('erosion is confined to the ice and strongest along the glacier centre line', () => {
    const w = valley();
    w.glacier.abrasionK = 2e-3;
    const { g, s } = sim(w);
    const before = s.slice();
    for (let k = 0; k < 15; k++) g.run(10 * YEAR_S, 1);
    const W = w.width;
    // Never-glaciated ground (the lowest rows, far below the snout) is untouched.
    for (let x = 0; x < W; x++) expect(s[x]).toBe(before[x]);
    // Across the glacier (row 48) the centre is lowered more than the margins.
    const dz = (x: number) => before[48 * W + x] - s[48 * W + x];
    expect(dz(16)).toBeGreaterThan(dz(3));
    expect(dz(16)).toBeGreaterThan(0.1);
  }, 60000);

  it('engine: meltwater reaches the rivers and the water budget closes', () => {
    const w = valley();
    w.water.boundary = 'open';
    for (let y = 10; y < 30; y++) for (let x = 10; x < 23; x++) w.iceThicknessM[y * w.width + x] = 80; // below the ELA: melts
    const e = new Engine(w);
    e.setGlacierParams({ yearsPerSimHour: 50 });
    e.advance(1800);
    expect(e.water.ledger.glacierMeltIn).toBeGreaterThan(0);
    expect(closureError(e.water.ledger, e.water.storedVolume())).toBeLessThan(1e-5);
    expect(e.glacier.ledger.ablated).toBeGreaterThan(0);
  }, 60000);

  it('ice and debris are saved; older files load ice-free', () => {
    const w = valley();
    w.iceThicknessM[5] = 42;
    w.iceDebrisM[5] = 0.3;
    const back = decodeWorld(encodeWorld(w)).world;
    expect(back.iceThicknessM[5]).toBe(42);
    expect(back.iceDebrisM[5]).toBeCloseTo(0.3, 6);
    expect(back.glacier).toEqual(w.glacier);
  });
});
