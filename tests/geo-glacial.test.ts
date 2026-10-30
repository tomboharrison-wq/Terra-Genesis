import { describe, expect, it } from 'vitest';
import { Engine } from '../src/engine/engine';
import { buildMountainWorld } from '../src/education/scenarioWorlds';
import { glaciatedUpland } from '../src/education/lessons/glacialGeologic';
import type { LessonLabel } from '../src/education/types';

const rockSoilDebris = (e: Engine) => {
  const w = e.world;
  let v = 0;
  for (let i = 0; i < w.bedrockElevationM.length; i++) v += w.bedrockElevationM[i] + w.looseSedimentThicknessM[i] + w.iceDebrisM[i];
  return v * w.cellSizeM * w.cellSizeM;
};

describe('glaciers in geological time', () => {
  it('ice builds up, erodes the valleys and melts; rock + sediment + carried debris is conserved', () => {
    const e = new Engine(buildMountainWorld());
    e.geoStep(100000); // river valleys first
    e.setClimateParams({ enabled: true, seaLevelTempC: -1, seasonalAmpC: 0, seasonsRun: false });
    e.setGlacierParams({ enabled: true, aspectBalance: 0.4, slidingCoupling: 4, maxErosionMmYr: 10 });
    const v0 = rockSoilDebris(e);
    const debOut0 = e.glacier.ledger.debrisExported;
    const st = e.geoStep(20000);
    let iceCells = 0;
    let thick = 0;
    for (const h of e.world.iceThicknessM) {
      if (h > 1) iceCells++;
      thick = Math.max(thick, h);
    }
    expect(iceCells).toBeGreaterThan(500);
    expect(thick).toBeGreaterThan(100);
    expect(st.glacialEroded).toBeGreaterThan(1e6);
    expect(st.outwash).toBeGreaterThan(0);
    const out = st.exported + (e.glacier.ledger.debrisExported - debOut0) - st.uplifted;
    expect(Math.abs(rockSoilDebris(e) - v0 + out) / st.glacialEroded).toBeLessThan(5e-3);
    // The ice erodes where it is, not elsewhere; moraine is laid down at its edges.
    const g = e.glacialErosionField();
    let maxG = 0;
    for (const v of g) maxG = Math.max(maxG, v);
    expect(maxG).toBeGreaterThan(10);
    e.setClimateParams({ seaLevelTempC: 10 });
    e.geoStep(4000);
    let left = 0;
    for (const h of e.world.iceThicknessM) if (h > 1) left++;
    expect(left).toBe(0);
  }, 120000);

  it('glaciated-upland lesson: glaciers, a deepened trough, a hanging valley and moraine are found and measured', async () => {
    const engine = new Engine(glaciatedUpland.build!());
    const labels: LessonLabel[][] = [];
    for (const st of glaciatedUpland.stages) {
      const ctx = { engine, setLabels: () => {}, geo: (y: number) => void engine.geoStep(y) };
      await st.enter?.(ctx);
      labels.push(st.labels ? st.labels(ctx) : []);
    }
    const num = (re: RegExp, ls: LessonLabel[]) => {
      for (const l of ls) {
        const m = l.text.match(re);
        if (m) return +m[1];
      }
      return NaN;
    };
    expect(num(/V-shaped river valley: (\d+) m deep/, labels[0])).toBeGreaterThan(50);
    expect(num(/Valley glacier: ice (\d+) m thick/, labels[1])).toBeGreaterThan(100);
    expect(num(/(?:Glacial trough|U-shaped valley): (\d+) m deeper/, labels[3])).toBeGreaterThan(50);
    expect(num(/Hanging valley: (\d+) m above/, labels[3])).toBeGreaterThan(60);
    expect(num(/Moraine: (\d+) m/, labels[3])).toBeGreaterThan(3);
    expect(labels[3].some((l) => /^Corrie/.test(l.text))).toBe(true);
    expect(num(/Worn away most: (\d+) m/, labels[4])).toBeGreaterThan(50);
  }, 180000);
});
