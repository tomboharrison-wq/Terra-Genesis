import { describe, expect, it } from 'vitest';
import { Engine } from '../src/engine/engine';
import { buildDiscordantCoastWorld } from '../src/education/scenarioWorlds';
import { headlandsBaysModel } from '../src/education/lessons/coastalGeologic';
import type { LessonLabel } from '../src/education/types';

describe('coasts in geological time', () => {
  it('clay retreats faster than chalk; volume removed = fines carried off + laid nearshore', () => {
    const e = new Engine(buildDiscordantCoastWorld());
    const w = e.world;
    const W = w.width;
    const shore = (y: number) => {
      for (let x = 0; x < W; x++) if (e.surface[y * W + x] < 0) return x;
      return W;
    };
    const x0 = [13, 39].map(shore);
    const vol = () => {
      let v = 0;
      for (let i = 0; i < w.bedrockElevationM.length; i++) v += w.bedrockElevationM[i] + w.looseSedimentThicknessM[i];
      return v * w.cellSizeM ** 2;
    };
    const v0 = vol();
    const st = e.geoStep(2000);
    const [chalk, clay] = [13, 39].map((y, k) => (x0[k] - shore(y)) * w.cellSizeM);
    expect(chalk).toBeGreaterThan(100); // ~0.1–0.15 m/yr
    expect(clay).toBeGreaterThan(1.5 * chalk); // ~0.25–0.3 m/yr
    expect(st.coastEroded).toBeGreaterThan(0);
    expect(Math.abs(vol() - v0 + st.exported - st.uplifted) / st.coastEroded).toBeLessThan(2e-3);
  }, 120000);

  it('headlands-and-bays lesson: headlands, bays, cliffs, a wave-cut platform and sheltered bays are measured', async () => {
    const engine = new Engine(headlandsBaysModel.build!());
    const labels: LessonLabel[][] = [];
    for (const st of headlandsBaysModel.stages) {
      const ctx = { engine, setLabels: () => {}, geo: (y: number) => void engine.geoStep(y) };
      await st.enter?.(ctx);
      labels.push(st.labels ? st.labels(ctx) : []);
    }
    const num = (re: RegExp, ls: LessonLabel[]) => {
      for (const l of ls) {
        const m = l.text.match(re);
        if (m) return m.slice(1).map(Number);
      }
      return [NaN];
    };
    const [, jut] = num(/Headland: hard rock, worn back (\d+) m — it now juts (\d+) m/, labels[2]);
    expect(jut).toBeGreaterThan(150);
    expect(num(/Bay: soft clay worn back (\d+) m/, labels[2])[0]).toBeGreaterThan(500);
    const [eh, eb] = num(/headland ([\d.]+) kW\/m, bay ([\d.]+) kW\/m/, labels[2]);
    expect(eh).toBeGreaterThan(eb);
    const [width, inner, outer] = num(/Wave-cut platform: a rock shelf (\d+) m wide, sloping gently out from ([\d.]+) m to ([\d.]+) m/, labels[3]);
    expect(width).toBeGreaterThan(100);
    expect(width).toBeLessThan(800); // real platforms: typically a few hundred metres
    expect(outer).toBeGreaterThan(inner);
  }, 180000);
});
