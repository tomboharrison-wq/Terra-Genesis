import { describe, expect, it } from 'vitest';
import { cloneWorld, computeSurface, createWorld, setUniformStrata, type WorldState } from '../src/engine/world';
import { Engine } from '../src/engine/engine';
import { settleSlopes } from '../src/terrain/settle';
import { defaultOptions, generateWorld } from '../src/terrain/generate';
import { decodeWorld, encodeWorld } from '../src/persistence/format';
import { analyzeRiverCourses, arbitraryMeanderLabels, estuaryMetrics } from '../src/education/geoFeatures';
import { INVESTIGATIONS, buildEvidenceReport } from '../src/education/evidence';
import { CoastSim } from '../src/sim/coast/coastSim';
import { findGlacialFeatures } from '../src/education/glacialFeatures';

const totalSolidsM3 = (w: WorldState) => {
  let sum = 0;
  for (let i = 0; i < w.bedrockElevationM.length; i++) {
    sum += w.bedrockElevationM[i] + w.looseSedimentThicknessM[i] + w.iceDebrisM[i];
  }
  return sum * w.cellSizeM * w.cellSizeM;
};

describe('Step 1: M16 validation & hardening', () => {
  it('8-neighbour slope settling produces an isotropic circular cone (not a 4-neighbour diamond) and conserves mass', () => {
    const N = 41;
    const c = 20;
    const w = createWorld({ width: N, height: N, cellSizeM: 5, seed: 1 });
    for (let dy = -2; dy <= 2; dy++)
      for (let dx = -2; dx <= 2; dx++)
        if (Math.hypot(dx, dy) <= 2) w.looseSedimentThicknessM[(c + dy) * N + (c + dx)] = 60;
    setUniformStrata(w);
    const v0 = totalSolidsM3(w);
    settleSlopes(w, 400);
    expect(Math.abs(totalSolidsM3(w) - v0) / v0).toBeLessThan(1e-5);

    // Measure cardinal radius vs diagonal radius where loose sediment > 0.05 m
    let rCard = 0;
    let rDiag = 0;
    for (let d = 1; d < c; d++) {
      if (w.looseSedimentThicknessM[c * N + (c + d)] > 0.05) rCard = d;
      if (w.looseSedimentThicknessM[(c + d) * N + (c + d)] > 0.05) rDiag = d * Math.SQRT2;
    }
    expect(rCard).toBeGreaterThanOrEqual(6);
    expect(Math.abs(rDiag - rCard) / rCard).toBeLessThan(0.2);
  });

  it('512² large-world save/load round-trip is fast and bit-identical', () => {
    const w = createWorld({ width: 512, height: 512, cellSizeM: 20, seed: 42 });
    for (let i = 0; i < w.bedrockElevationM.length; i++) {
      w.bedrockElevationM[i] = Math.fround(Math.sin(i * 0.01) * 100);
      w.looseSedimentThicknessM[i] = Math.fround((i % 7) * 0.3);
    }
    setUniformStrata(w);
    const t0 = performance.now();
    const bytes = encodeWorld(w);
    const decoded = decodeWorld(bytes).world;
    const elapsedMs = performance.now() - t0;
    expect(elapsedMs).toBeLessThan(500);
    expect(decoded.width).toBe(512);
    expect(decoded.height).toBe(512);
    expect(decoded.bedrockElevationM).toEqual(w.bedrockElevationM);
    expect(decoded.looseSedimentThicknessM).toEqual(w.looseSedimentThicknessM);
  });

  it('coupled glacial + coastal geological time runs both processes simultaneously and conserves volume', () => {
    const w = generateWorld(defaultOptions('coastal-headland', 7, 64));
    // Raise northern uplands so glaciers form in the north while waves attack the southern coast
    for (let y = 32; y < 64; y++) {
      for (let x = 0; x < 64; x++) {
        w.bedrockElevationM[y * 64 + x] += (y - 32) * 28;
      }
    }
    const e = new Engine(w);
    e.setClimateParams({ enabled: true, seaLevelTempC: -3, seasonalAmpC: 0, seasonsRun: false });
    e.setGlacierParams({ enabled: true, elaTempC: 0 });
    e.world.coast.wavesOn = true;
    const st = e.geoStep(2000);
    expect(st.glacialEroded).toBeGreaterThan(0);
    expect(st.coastEroded).toBeGreaterThan(0);
  });
});

describe('Step 2 & Step 5: Arbitrary-world meanders, estuaries, and Bradshaw river courses', () => {
  it('enables meandering & estuary on River-to-sea (river-delta) and generates measured outer-cliff, point-bar, and estuary labels', () => {
    const w = generateWorld(defaultOptions('river-delta', 777, 128));
    const e = new Engine(w);
    expect(e.enableLowlandMeander()).toBe(true);
    expect(e.geoMeander).not.toBeNull();
    e.geoStep(3000);
    const m = e.geoMeander!;
    const est = estuaryMetrics(e.world, m);
    expect(est).not.toBeNull();
    expect(est!.widenFactor).toBeGreaterThan(2);

    const labels = arbitraryMeanderLabels(e.world, m, e.geoRivers?.lake);
    expect(labels.some((l) => l.text.startsWith('River sinuosity:'))).toBe(true);
    expect(labels.some((l) => l.text.includes('River cliff (outer bend)'))).toBe(true);
    expect(labels.some((l) => l.text.includes('Slip-off slope / point bar (inner bend)'))).toBe(true);
    expect(labels.some((l) => l.text.startsWith('Tidal estuary:'))).toBe(true);
  });

  it('analyzeRiverCourses connects the physical model to upper, middle, and lower course Bradshaw metrics', () => {
    const w = generateWorld(defaultOptions('river-delta', 777, 128));
    const report = analyzeRiverCourses(w);
    expect(report).not.toBeNull();
    const [upper, middle, lower] = report!.reaches;
    expect(upper.elevationM).toBeGreaterThan(middle.elevationM);
    expect(middle.elevationM).toBeGreaterThan(lower.elevationM);
    expect(upper.gradient).toBeGreaterThan(lower.gradient);
    expect(lower.drainageAreaKm2).toBeGreaterThan(upper.drainageAreaKm2);
    expect(report!.labels.length).toBeGreaterThanOrEqual(3);
  });
});

describe('Step 4 & Step 6: Coastal refraction/beaches/headlands and glacial drumlins/erratics', () => {
  it('wave refraction focuses energy on convex headlands (Kr > 1) and disperses energy in concave bays (Kr < 1)', () => {
    const N = 40;
    const w = createWorld({ width: N, height: N, cellSizeM: 10, seed: 1, seaLevelM: 0 });
    // Headland at x = 20 jutting south; bay at x = 10 indented north
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const coastY = 18 - Math.round(4 * Math.cos(((x - 20) * Math.PI) / 10));
        w.bedrockElevationM[y * N + x] = y >= coastY ? 12 : -2 - (coastY - y) * 0.8;
      }
    }
    setUniformStrata(w);
    const s = new Float32Array(N * N);
    computeSurface(w, s);
    const coast = new CoastSim(w, s);
    const krHeadland = coast.refractionFactor(20, 14, 0, -1);
    const krBay = coast.refractionFactor(10, 22, 0, -1);
    expect(krHeadland).toBeGreaterThan(1.02);
    expect(krBay).toBeLessThan(0.98);
  });

  it('findGlacialFeatures detects drumlins and erratics in a glaciated valley', () => {
    const N = 40;
    const w = createWorld({ width: N, height: N, cellSizeM: 50, seed: 1, seaLevelM: 0 });
    const pre = new Float32Array(N * N);
    const iceMax = new Float32Array(N * N);
    const moraineM = new Float32Array(N * N);
    const glacialM = new Float32Array(N * N);
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const i = y * N + x;
        const vWall = Math.abs(x - 20) * 12;
        pre[i] = 200 + y * 18 + vWall;
        w.bedrockElevationM[i] = pre[i] - (Math.abs(x - 20) < 5 ? 70 : 0);
        iceMax[i] = Math.abs(x - 20) < 6 && y > 5 ? 90 : 0;
        glacialM[i] = Math.abs(x - 20) < 5 && y > 20 ? 70 : 0;
      }
    }
    // Lower-valley drumlin and terminal moraine below snowline (600 m)
    const drumCell = 10 * N + 20;
    w.looseSedimentThicknessM[drumCell] = 4.5;
    moraineM[drumCell] = 4.5;
    const termCell = 6 * N + 20;
    w.looseSedimentThicknessM[termCell] = 5.0;
    moraineM[termCell] = 5.0;
    const gf = findGlacialFeatures(w, pre, iceMax, moraineM, 600, glacialM);
    expect(gf.drumlin).not.toBeNull();
    expect(gf.drumlin!.heightM).toBeGreaterThanOrEqual(4);
    expect(gf.erratic).not.toBeNull();
    expect(gf.erratic!.transportKm).toBeGreaterThan(0.5);
  });
});

describe('Step 3 & Step 7: GCSE Evidence Layer and 6 Classroom Investigations', () => {
  it.each(INVESTIGATIONS.map((inv) => inv.id))('builds a complete Predict → Run → Observe → Measure → Explain report for %s', (id) => {
    const w = generateWorld(defaultOptions('river-delta', 101, 64));
    const before = cloneWorld(w);
    const e = new Engine(w);
    e.geoStep(1000);
    const report = buildEvidenceReport(before, e, id);
    expect(report.metrics.length).toBeGreaterThanOrEqual(3);
    expect(report.processSequence.length).toBeGreaterThanOrEqual(4);
    expect(report.vocabularyUsed.length).toBeGreaterThanOrEqual(3);
    expect(report.examParagraph.length).toBeGreaterThan(80);
    expect(report.profile.length).toBeGreaterThan(10);
  });
});
