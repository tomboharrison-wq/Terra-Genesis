import { describe, expect, it } from 'vitest';
import { ArchModel, archParamsFor, STAGE_ORDER } from '../src/local/arch/model';
import { defaultShorelineParams, ShorelineModel } from '../src/local/shoreline/model';
import { lessonById } from '../src/education/lessons';

describe('M10-C03 coastal lessons drive real guided-model states', () => {
  it('cave-arch-stack: each stage is reached by the chalk headland model, in order', () => {
    const l = lessonById('cave-arch-stack')!;
    const m = new ArchModel(archParamsFor('chalk', 2, 8, 5));
    let steps = 0;
    for (const st of l.stages) {
      const want = STAGE_ORDER[st.t!];
      while (STAGE_ORDER.indexOf(m.currentStage) < st.t! && steps < 5000) {
        m.advance();
        steps++;
      }
      expect(m.currentStage).toBe(want);
    }
    expect(steps).toBeLessThan(2000); // quick enough to animate in a lesson
    // Deterministic: re-running from the start reaches the arch at the same step.
    const a = new ArchModel(archParamsFor('chalk', 2, 8, 5));
    const b = new ArchModel(archParamsFor('chalk', 2, 8, 5));
    const stepsTo = (q: ArchModel) => {
      let n = 0;
      while (q.currentStage !== 'arch') {
        q.advance();
        n++;
      }
      return n;
    };
    expect(stepsTo(a)).toBe(stepsTo(b));
  });

  it('spit lesson: the spit lengthens through the stages; bar lesson: the lagoon closes', () => {
    const sp = lessonById('spit')!;
    const m = new ShorelineModel({
      ...defaultShorelineParams(),
      layout: 'spit',
    });
    const tips: number[] = [];
    let day = 0;
    for (const st of sp.stages) {
      m.step(st.t! * 365 - day);
      day = st.t! * 365;
      tips.push(m.spitStats().cells);
    }
    for (let k = 1; k < tips.length; k++) expect(tips[k]).toBeGreaterThan(tips[k - 1]);
    const bar = lessonById('bar-lagoon')!;
    const b = new ShorelineModel({
      ...defaultShorelineParams(),
      layout: 'bay',
    });
    b.step(bar.stages[1].t! * 365);
    const open = b.lagoonCells();
    b.step((bar.stages[2].t! - bar.stages[1].t!) * 365);
    expect(b.lagoonCells()).toBeGreaterThan(5 * open); // the bar has closed off the bay
  });
});
