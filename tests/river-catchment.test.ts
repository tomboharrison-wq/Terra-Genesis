import { describe, expect, it } from 'vitest';
import { computeSurface, validateWorld } from '../src/engine/world';
import { WaterSim } from '../src/sim/water/waterSim';
import { closureError } from '../src/sim/water/ledger';
import { generateWorld, defaultOptions } from '../src/terrain/generate';

describe('river-catchment fixture (spec J1)', () => {
  it('rain on a seeded river basin organises into channels and drains off the map', () => {
    const w = generateWorld(defaultOptions('river-basin', 20261022, 96)); // preset rain 60 mm/h
    const s = new Float32Array(96 * 96);
    computeSurface(w, s);
    const sim = new WaterSim(w, s);
    let t = 0;
    while (t < 3 * 3600) {
      const dt = sim.stableDt();
      sim.step(dt);
      t += dt;
    }
    expect(validateWorld(w)).toEqual([]);
    expect(closureError(sim.ledger, sim.storedVolume())).toBeLessThan(1e-4);
    // Drains: a substantial share of the rain has left through the outlet edges/sea.
    const out = sim.ledger.edgeOut + sim.ledger.seaOut;
    expect(out / sim.ledger.rainIn).toBeGreaterThan(0.2);
    // Channelised: discharge per unit width q = d·|v| is concentrated in few cells.
    const q: number[] = [];
    for (let i = 0; i < 96 * 96; i++) q.push(w.waterDepthM[i] * Math.hypot(sim.vx[i], sim.vy[i]));
    q.sort((a, b) => b - a);
    const total = q.reduce((a, b) => a + b, 0);
    const top5 = q.slice(0, Math.round(q.length * 0.05)).reduce((a, b) => a + b, 0);
    expect(top5 / total).toBeGreaterThan(0.4);
  }, 60000);
});
