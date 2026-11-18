import { createWorld, setUniformStrata, type WorldState } from '../../engine/world';
import { carve, createMeander, defaultMeanderParams } from '../../sim/geology/meander';
import { leveeHeight } from '../geoFeatures';
import type { Lesson } from '../types';

/** Four-metre floodplain cells resolve bank deposits. A fixed reach isolates overbank deposition. */
export function buildLiveLeveeWorld(): WorldState {
  const W = 129, H = 97, cs = 4, cy = 48 * cs;
  const w = createWorld({ width: W, height: H, cellSizeM: cs, seed: 23, seaLevelM: -10,
    meta: { name: 'Live river: floodplain and levees', presetId: 'live-levees', reliefM: 4 } });
  const xs: number[] = [], ys: number[] = [];
  for (let x = W - 1; x >= 0; x--) { xs.push(x * cs); ys.push(cy); }
  const p = { ...defaultMeanderParams(), widthM: 24, depthM: 2, erosionMYr: 0, supplyM3Yr: 1000,
    overbankFraction: 0.4, overbankDecayM: 24, floodHeightM: 2.5 };
  const m = createMeander(xs, ys, 8.512, 8, p);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, fp = 8 + x * cs * 0.001;
    w.bedrockElevationM[i] = fp - 8;
    w.looseSedimentThicknessM[i] = Math.abs(y * cs - cy) <= p.widthM / 2 ? 6 : 8;
  }
  w.materialId.fill(1);
  setUniformStrata(w);
  carve(w, m, 0);
  w.meta.meander = m;
  return w;
}

const text = [
  ['A river between low banks', 'This straight river runs through a flat floodplain. The banks start at the same level as the surrounding land. The model will add sediment carried from upstream.', 'A fixed river reach isolates overbank deposition. Sediment supply is 1,000 m³ per process year. The channel remains fixed so bank migration cannot be mistaken for levee growth.'],
  ['Floodwater loses carrying power', 'When floods spread water out beside the channel, sediment is dropped. The model adds more sediment near the river than further away.', 'Overbank deposition draws from the actual sediment budget. Deposit thickness decreases with distance from the channel and is limited by flood level. This reduced model has one sediment class, rather than sorting individual grain sizes.'],
  ['Raised banks form levees', 'Repeated floods build raised banks on both sides of the river. These levees are made of new sediment. Compare their height with the floodplain further away.', 'The raised bank crests are actual loose sediment in the landscape. The measured cross-section below shows the same ground heights as the 3D model. Finer sediment settling further away in a real river builds the wider floodplain.'],
];

export const liveLevees: Lesson = {
  id: 'live-levees', module: 'rivers', title: 'Live river: flood deposits build levees', kind: 'emergent', geological: true,
  build: buildLiveLeveeWorld,
  objective: 'Observe sediment building real levees beside a river, measure them across the floodplain, and explain how repeated overbank flooding causes deposition.',
  stages: text.map(([title, ks3, gcse], k) => ({ title, ks3, gcse, camera: 'oblique',
    enter: k ? (ctx) => ctx.geo(k === 1 ? 40 : 160) : undefined,
    focus: () => ({ xM: 256, yM: 192, distanceM: 190 }),
    profile: () => ({ ax: 256, ay: 72, bx: 256, by: 312 }),
    labels: ({ engine }) => {
      const m = engine.geoMeander!;
      const l = leveeHeight(engine.world, m, 100);
      return [{ text: `Bank above floodplain: ${l.heightM.toFixed(2)} m`, xM: 256, yM: 208 }];
    },
  })),
  exam: { question: 'Explain how natural levees form. (4 marks)', marks: 4,
    model: 'During a flood the river overtops its banks and water spreads onto the floodplain (1). The water slows down and loses carrying capacity (1). Coarser sediment is deposited close to the channel, while finer material is carried further away (1). Repeated floods build raised banks called levees (1).' },
  misconception: { wrong: 'A levee is always built by people.', right: 'Natural levees are raised banks of river sediment, built by repeated overbank flooding. Artificial embankments are constructed by people.' },
};
