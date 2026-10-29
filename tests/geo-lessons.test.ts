import { describe, expect, it } from 'vitest';
import { Engine } from '../src/engine/engine';
import { meandersFloodplain, vValleySpurs, waterfallGorgeModel } from '../src/education/lessons/riverGeologic';
import type { Lesson, LessonLabel } from '../src/education/types';
import { mainRiver, findWaterfall } from '../src/education/geoFeatures';

/** Run a lesson's stages in order on one engine (as the lesson player does) and collect each stage's labels. */
function run(lesson: Lesson): { engine: Engine; labels: LessonLabel[][] } {
  const engine = new Engine(lesson.build!());
  const labels: LessonLabel[][] = [];
  for (const st of lesson.stages) {
    const ctx = { engine, setLabels: () => {}, geo: (y: number) => void engine.geoStep(y) };
    st.enter?.(ctx);
    labels.push(st.labels ? st.labels(ctx) : []);
  }
  return { engine, labels };
}
const num = (re: RegExp, ls: LessonLabel[]) => {
  for (const l of ls) {
    const m = l.text.match(re);
    if (m) return +m[1].replace(/,/g, '');
  }
  return NaN;
};

describe('geological-time lessons: landforms that really form in the model', () => {
  it('waterfall and gorge: a step forms on the hard dolerite, retreats upstream and leaves a gorge', () => {
    const { engine, labels } = run(waterfallGorgeModel);
    expect(engine.geologicYears).toBe(200000);
    const w = engine.world;
    const f = findWaterfall(w, mainRiver(w), 300, 15, true)!;
    expect(f).not.toBeNull();
    expect(f.dropM).toBeGreaterThan(20);
    // Retreat: the final stage says how far upstream of its start the waterfall is.
    const last = labels[3];
    const wf = last.find((l) => l.text.startsWith('Waterfall'))!;
    expect(wf.text).toMatch(/upstream of where it began/);
    const km = wf.text.match(/([\d.]+) km upstream/);
    expect(km && +km[1]).toBeGreaterThan(1);
    const gorgeDepth = num(/Gorge: (\d+) m deep/, last);
    expect(gorgeDepth).toBeGreaterThan(40);
    expect(last.some((l) => l.text.startsWith('The waterfall was here'))).toBe(true);
  });

  it('V-shaped valley and interlocking spurs: the river cuts down, the valley deepens, spurs alternate', () => {
    const { engine, labels } = run(vValleySpurs);
    expect(engine.geologicYears).toBe(200001);
    const cut1 = num(/river bed (\d+) m lower/, labels[1]);
    const cut2 = num(/river bed (\d+) m lower/, labels[2]);
    expect(cut1).toBeGreaterThan(10);
    expect(cut2).toBeGreaterThan(cut1);
    const depth2 = num(/V-shaped valley: (\d+) m deep/, labels[2]);
    const depth3 = num(/V-shaped valley: (\d+) m deep/, labels[3]);
    expect(depth2).toBeGreaterThan(30);
    expect(depth3).toBeGreaterThanOrEqual(depth2 * 0.9);
    const spurs = labels[3].filter((l) => l.text.startsWith('Interlocking spur'));
    expect(spurs.length).toBeGreaterThanOrEqual(2);
  });

  it('every label sits on the map', () => {
    for (const lesson of [waterfallGorgeModel, vValleySpurs]) {
      const { engine, labels } = run(lesson);
      const w = engine.world;
      for (const l of labels.flat()) {
        expect(l.xM).toBeGreaterThanOrEqual(0);
        expect(l.yM).toBeGreaterThanOrEqual(0);
        expect(l.xM).toBeLessThanOrEqual((w.width - 1) * w.cellSizeM);
        expect(l.yM).toBeLessThanOrEqual((w.height - 1) * w.cellSizeM);
      }
    }
  });
});

describe('geological-time lesson: lowland river', () => {
  it('meanders form, a neck is cut off into an oxbow lake, floods build levees and the floodplain', async () => {
    const lesson = meandersFloodplain;
    const engine = new Engine(lesson.build!());
    const labels: LessonLabel[][] = [];
    for (const st of lesson.stages) {
      const ctx = { engine, setLabels: () => {}, geo: (y: number) => void engine.geoStep(y) };
      await st.enter?.(ctx);
      labels.push(st.labels ? st.labels(ctx) : []);
    }
    const sin = (ls: LessonLabel[]) => num(/River: ([\d.]+)× longer/, ls);
    expect(sin(labels[0])).toBeLessThan(1.1);
    expect(sin(labels[1])).toBeGreaterThan(1.2);
    expect(labels[1].some((l) => /^River cliff: outer bank [\d.]+ m high/.test(l.text))).toBe(true);
    expect(labels[1].some((l) => l.text.startsWith('Slip-off slope'))).toBe(true);
    expect(labels[2].some((l) => /^Oxbow lake: cut off [\d,]+ years ago, [\d.]+ m deep/.test(l.text))).toBe(true);
    expect(num(/Levees: river banks ([\d.]+) m higher/, labels[3])).toBeGreaterThan(0.3);
    expect(num(/built the floodplain up ([\d.]+) m/, labels[3])).toBeGreaterThan(0.2);
  }, 120000);
});
