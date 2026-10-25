import { describe, expect, it } from 'vitest';
import { createWorld, setUniformStrata } from '../src/engine/world';
import { craterSize, impact } from '../src/sim/events/meteor';

const flat = (N: number, cs: number, z = 100) => {
  const w = createWorld({ width: N, height: N, cellSizeM: cs, seed: 1, seaLevelM: 0 });
  w.bedrockElevationM.fill(z);
  w.looseSedimentThicknessM.fill(2);
  setUniformStrata(w);
  const s = new Float32Array(N * N);
  for (let i = 0; i < N * N; i++) s[i] = w.bedrockElevationM[i] + w.looseSedimentThicknessM[i];
  return { w, s };
};

describe('M11-C02 meteor impact', () => {
  it('pi-scaling: Meteor Crater check, size laws and energy', () => {
    // Barringer (Meteor) Crater, 1.19 km across: impactor estimates 30–50 m iron at ~12.8 km/s, so the
    // law should land within ~±40 % for the upper estimate (it gives ≈ 1.55 km).
    const m = craterSize({ diameterM: 50, speedMS: 12800, densityKgM3: 7800, angleDeg: 45 });
    expect(m.diameterM).toBeGreaterThan(900);
    expect(m.diameterM).toBeLessThan(1700);
    expect(m.depthM).toBeGreaterThan(150);
    expect(m.depthM).toBeLessThan(340);
    expect(m.complex).toBe(false);
    // D_tc ∝ L^0.78 and v^0.44 (simple regime).
    const a = craterSize({ diameterM: 10, speedMS: 17000, densityKgM3: 3000, angleDeg: 90 });
    const b = craterSize({ diameterM: 20, speedMS: 17000, densityKgM3: 3000, angleDeg: 90 });
    const c = craterSize({ diameterM: 10, speedMS: 34000, densityKgM3: 3000, angleDeg: 90 });
    expect(b.transientM / a.transientM).toBeCloseTo(2 ** 0.78, 9);
    expect(c.transientM / a.transientM).toBeCloseTo(2 ** 0.44, 9);
    expect(a.energyJ).toBeCloseTo(0.5 * 3000 * (Math.PI / 6) * 1000 * 17000 ** 2, 0);
    expect(craterSize({ diameterM: 400, speedMS: 20000, densityKgM3: 3000, angleDeg: 45 }).complex).toBe(true);
  });

  it('volume is conserved: excavated = ejecta on the map + ejecta beyond its edge; rim and bowl shape', () => {
    const N = 200;
    const cs = 10;
    const { w, s } = flat(N, cs);
    const before = s.reduce((a, v) => a + v, 0);
    const r = impact(w, s, { xM: 100 * cs, yM: 100 * cs, diameterM: 8, speedMS: 15000, densityKgM3: 3000, angleDeg: 45 });
    const after = s.reduce((a, v) => a + v, 0);
    expect(r.excavatedM3).toBeGreaterThan(0);
    // Ground volume change on the map = − what was thrown beyond the edge.
    expect((after - before) * cs * cs).toBeCloseTo(-r.ejectaOffMapM3, -1);
    expect(r.ejectaOffMapM3).toBeGreaterThan(0);
    // (R/r)³ blanket: on-map share ≈ 1 − R/R_edge (square map: between the inscribed and corner radii).
    const R = r.diameterM / 2;
    const share = r.ejectaOnMapM3 / r.excavatedM3;
    expect(share).toBeGreaterThan(1 - R / (100 * cs) - 0.05);
    expect(share).toBeLessThan(1 - R / (141 * cs) + 0.05);
    // Floor is the deepest point; the rim stands above the old ground.
    const centre = s[100 * N + 100];
    expect(centre).toBeLessThan(102 - 0.6 * r.depthM);
    expect(r.rimM).toBeGreaterThan(0.1 * r.depthM);
    // Soil went first, then rock: the bowl floor is in bedrock with no soil left.
    expect(w.looseSedimentThicknessM[100 * N + 100]).toBe(0);
  });
});
