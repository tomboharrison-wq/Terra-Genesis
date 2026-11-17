import { describe, expect, it } from 'vitest';
import { Engine } from '../src/engine/engine';
import { cloneWorld } from '../src/engine/world';
import { decodeWorld, encodeWorld } from '../src/persistence/format';
import { defaultOptions, generateWorld } from '../src/terrain/generate';
import { INVESTIGATIONS, buildEvidenceReport } from '../src/education/evidence';
import { TEACHER_SETUPS } from '../src/education/teacherSetups';
import { MEASURED_VS_TEXTBOOK, MODEL_RELIABILITY, WHY_TIME_ACCELERATION } from '../src/education/modelReliability';

describe('M17: GCSE Classroom Usability, Answer Support, Teacher Mode, Scientific Trust & Performance', () => {
  it('M17-C01 & C02: all 6 investigations have complete GCSE enquiry, scaffolding, 4-mark & 6-mark support, and produce measured Evidence Reports', () => {
    expect(INVESTIGATIONS.length).toBe(6);

    for (const inv of INVESTIGATIONS) {
      expect(inv.question.length).toBeGreaterThan(20);
      expect(inv.whatToChange.length).toBeGreaterThan(15);
      expect(inv.whatToObserve.length).toBeGreaterThan(15);
      expect(inv.estimatedMinutes).toMatch(/20–25 min/);
      expect(inv.predictionPrompt.length).toBeGreaterThan(15);
      expect(inv.sentenceStarters.length).toBeGreaterThanOrEqual(4);
      expect(inv.question4Mark).toMatch(/\(4 marks\)/);
      expect(inv.commandWord4Mark).toMatch(/Edexcel/);
      expect(inv.question6Mark).toMatch(/\(6 marks\)/);
      expect(inv.commandWord6Mark).toMatch(/Edexcel/);
      expect(inv.processSequence.length).toBeGreaterThanOrEqual(5);
      expect(inv.vocabulary.length).toBeGreaterThanOrEqual(4);

      const preset =
        inv.topic === 'rivers'
          ? 'river-delta'
          : inv.topic === 'coasts'
            ? 'coastal-headland'
            : inv.topic === 'glaciers'
              ? 'alpine-glaciers'
              : inv.topic === 'slopes'
                ? 'plateau'
                : inv.topic === 'tectonics'
                  ? 'mountain-range'
                  : 'rain-shadow';

      const w = generateWorld(defaultOptions(preset, 1700, 64));
      const before = cloneWorld(w);
      const engine = new Engine(w);

      if (inv.topic === 'rivers') {
        engine.enableLowlandMeander();
        engine.geoStep(2000);
      } else if (inv.topic === 'coasts') {
        engine.world.coast.wavesOn = true;
        engine.geoStep(2000);
      } else if (inv.topic === 'glaciers') {
        engine.setClimateParams({ enabled: true, seaLevelTempC: -1 });
        engine.setGlacierParams({ enabled: true, slidingCoupling: 3, aspectBalance: 0.3, maxErosionMmYr: 10 });
        engine.geoStep(4000);
      } else if (inv.topic === 'slopes') {
        engine.landslide((w.width * w.cellSizeM) / 2, (w.height * w.cellSizeM) / 2, w.width * w.cellSizeM * 0.25);
      } else if (inv.topic === 'tectonics') {
        engine.earthquake({
          xM: (w.width * w.cellSizeM) / 2,
          yM: (w.height * w.cellSizeM) / 2,
          mw: 7.4,
          type: 'reverse',
          strikeDeg: 45,
          landslides: true,
        });
      } else {
        engine.advance(600);
      }

      const report = buildEvidenceReport(before, engine, inv.id, inv.hypotheses[0]);
      expect(report.metrics.length).toBeGreaterThanOrEqual(3);
      expect(report.annotatedLandforms.length).toBeGreaterThanOrEqual(3);
      expect(report.modelAnswer4Mark.length).toBeGreaterThan(50);
      expect(report.examParagraph.length).toBeGreaterThan(80);
      expect(report.profile.length).toBeGreaterThan(10);
      for (const m of report.metrics) {
        expect(m.before).not.toMatch(/NaN/);
        expect(m.after).not.toMatch(/NaN/);
      }
    }
  });

  it('M17-C03: all 7 Teacher Lesson Setups use unique fixed seeds, 25-minute lesson plans, and produce deterministic worlds', () => {
    expect(TEACHER_SETUPS.length).toBe(7);
    const seeds = new Set<number>();
    const invIds = new Set(INVESTIGATIONS.map((i) => i.id));

    for (const ts of TEACHER_SETUPS) {
      expect(seeds.has(ts.seed)).toBe(false);
      seeds.add(ts.seed);
      expect(invIds.has(ts.investigationId)).toBe(true);
      expect(ts.learningObjectives.length).toBeGreaterThanOrEqual(2);
      expect(ts.instructions.length).toBeGreaterThanOrEqual(3);
      expect(ts.expectedOutcomes.length).toBeGreaterThanOrEqual(2);
      const totalMins = ts.timings.reduce((acc, t) => acc + t.minutes, 0);
      expect(totalMins).toBe(25);
    }

    // Verify deterministic bit-identical world generation for a fixed-seed teacher setup
    const ts0 = TEACHER_SETUPS[0];
    const wA = generateWorld(defaultOptions(ts0.presetId, ts0.seed, 64));
    const wB = generateWorld(defaultOptions(ts0.presetId, ts0.seed, 64));
    expect(wA.bedrockElevationM).toEqual(wB.bedrockElevationM);
    expect(wA.looseSedimentThicknessM).toEqual(wB.looseSedimentThicknessM);
  });

  it('M17-C05: Scientific Trust model reliability tables cover all core topics, equations, units, and real-world ranges', () => {
    expect(MODEL_RELIABILITY.length).toBe(6);
    for (const row of MODEL_RELIABILITY) {
      expect(row.simulated.length).toBeGreaterThan(40);
      expect(row.simplified.length).toBeGreaterThan(30);
      expect(row.unitsAndTimescale.length).toBeGreaterThan(15);
      expect(row.realWorldRange.length).toBeGreaterThan(20);
      expect(row.equationSource.length).toBeGreaterThan(20);
    }
    expect(WHY_TIME_ACCELERATION.length).toBe(3);
    expect(MEASURED_VS_TEXTBOOK.measuredBadge).toMatch(/Measured/);
    expect(MEASURED_VS_TEXTBOOK.textbookBadge).toMatch(/Curriculum/);
  });

  it('M17-C06: Classroom mode 128² sustains 60 simulation steps cleanly without NaNs and round-trips through save/load', () => {
    const w = generateWorld(defaultOptions('river-basin', 1717, 128));
    const engine = new Engine(w);
    const t0 = performance.now();
    for (let k = 0; k < 60; k++) {
      engine.advance(10);
    }
    const elapsedMs = performance.now() - t0;
    expect(elapsedMs).toBeLessThan(3500);

    for (let i = 0; i < w.bedrockElevationM.length; i++) {
      expect(Number.isFinite(w.bedrockElevationM[i])).toBe(true);
      expect(Number.isFinite(w.waterDepthM[i])).toBe(true);
    }

    const encoded = encodeWorld(w);
    const decoded = decodeWorld(encoded);
    expect(decoded.world.width).toBe(128);
    expect(decoded.world.bedrockElevationM).toEqual(w.bedrockElevationM);
    expect(decoded.world.waterDepthM).toEqual(w.waterDepthM);
  });
});
