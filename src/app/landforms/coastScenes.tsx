import { Arrow, C, clamp, curve, ease, Frame, hash, Label, Legend, lerp, PlanWaves, poly, ramp, SeaSurface, smooth, Tag, VH, VW, type P } from './svg';

export interface SceneProps {
  /** Formation timeline 0 … 1. */
  t: number;
  /** Seconds since the scene opened (waves, flowing water). */
  time: number;
}

/** Pebbles hurled at a target point by breaking waves (abrasion), cycling every ~1.6 s. */
function Hurled({ from, to, time, n = 4, show = 1 }: { from: P; to: P; time: number; n?: number; show?: number }) {
  if (show <= 0) return null;
  return (
    <g opacity={clamp(show * 3)}>
      {Array.from({ length: n }, (_, k) => {
        const u = (time * 0.7 + k / n) % 1;
        const x = lerp(from[0], to[0], u) + 10 * hash(k);
        const y = lerp(from[1], to[1], u) - 30 * Math.sin(Math.PI * u) + 6 * hash(k + 4);
        return <circle key={k} cx={x} cy={y} r={4 + 2 * hash(k + 1)} fill={C.shingle} stroke={C.ink} strokeWidth={1} />;
      })}
    </g>
  );
}

/** Air bubbles squeezed into a crack (hydraulic action). */
function Squeeze({ at, time, show = 1 }: { at: P; time: number; show?: number }) {
  if (show <= 0) return null;
  const ph = (time * 1.2) % 1;
  return (
    <g opacity={clamp(show * 3)}>
      {[0, 1, 2].map((k) => (
        <circle
          key={k}
          cx={at[0] - 6 + k * 6}
          cy={at[1] - k * 9 - ph * 10}
          r={3 + 2 * Math.sin(Math.PI * ph)}
          fill="#ffffff"
          stroke={C.blue}
          strokeWidth={1.5}
          opacity={0.9}
        />
      ))}
    </g>
  );
}

// ------------------------------------------------------------------ headlands and bays (map view)

const BANDS: { x0: number; x1: number; hard: boolean }[] = [
  { x0: 0, x1: 150, hard: true },
  { x0: 150, x1: 410, hard: false },
  { x0: 410, x1: 560, hard: true },
  { x0: 560, x1: 810, hard: false },
  { x0: 810, x1: VW, hard: true },
];

export function HeadlandsBays({ t, time }: SceneProps) {
  const y0 = 300;
  const soft = 150 * ease(ramp(t, 0.12, 0.7));
  const hard = 8 * ease(ramp(t, 0.12, 0.7)) + 26 * ease(ramp(t, 0.82, 1));
  // Bays: asymmetric curves (deepest a little east of centre, as the prevailing waves come from the south-west).
  const retreat = (x: number) => {
    const b = BANDS.find((q) => x >= q.x0 && x <= q.x1)!;
    if (b.hard) {
      // Headland tips round off where they meet the bays.
      const e = Math.min(x - b.x0, b.x1 - x);
      const round = b.x0 > 0 && b.x1 < VW ? soft * 0.18 * Math.exp(-e / 16) : 0;
      return hard + round;
    }
    const u = (x - b.x0) / (b.x1 - b.x0);
    const shape = Math.pow(Math.sin(Math.PI * Math.pow(u, 0.85)), 0.6);
    return hard + (soft - hard) * shape;
  };
  const coast = (x: number) => y0 - retreat(x);
  const coastPts = curve(0, VW, coast, 240);
  const land = smooth([[0, 0], ...coastPts, [VW, 0]] as P[], false) + 'Z';
  const refr = ramp(t, 0.8, 0.88);
  const beach = ramp(t, 0.84, 0.96);
  const attackHead = ramp(t, 0.9, 0.97);
  // Wave crests: straight offshore; nearer the shore they wrap round the headlands once refraction is shown.
  const crests = [];
  const gap = 42;
  const off = (time * 20) % gap;
  for (let d = 24 + gap - off; d < 250; d += gap) {
    const w = refr * Math.exp(-d / 140);
    const pts = curve(0, VW, (x) => (1 - w) * (y0 + d) + w * (coast(x) + d * 0.55), 120);
    crests.push(<path key={d} d={smooth(pts)} stroke={C.foam} strokeWidth={2.4} fill="none" opacity={0.75 * clamp((250 - d) / 70)} />);
  }
  const bays = BANDS.filter((b) => !b.hard);
  return (
    <Frame map title="Headlands and bays forming on a discordant coast">
      <rect x={0} y={0} width={VW} height={VH} fill={C.sea} />
      {crests}
      <clipPath id="lf-land">
        <path d={land} />
      </clipPath>
      <g clipPath="url(#lf-land)">
        {BANDS.map((b) => (
          <rect key={b.x0} x={b.x0} y={0} width={b.x1 - b.x0} height={VH} fill={b.hard ? C.hard : C.soft} />
        ))}
        <rect x={0} y={0} width={VW} height={VH} fill="url(#lf-strata)" />
      </g>
      {/* Beaches deposited in the sheltered bays */}
      {bays.map((b) => {
        const top = curve(b.x0 + 10, b.x1 - 10, coast, 40);
        const bot = top
          .slice()
          .reverse()
          .map(([x, y]) => [x, y + 18 * beach * Math.sin((Math.PI * (x - b.x0)) / (b.x1 - b.x0))] as P);
        return <path key={b.x0} d={poly([...top, ...bot], true)} fill={C.sand} stroke={C.softDark} strokeWidth={1} opacity={beach} />;
      })}
      <path d={smooth(coastPts)} stroke={C.ink} strokeWidth={2.5} fill="none" />
      <path
        d={poly([
          [0, y0],
          [VW, y0],
        ])}
        stroke="#ffffff"
        strokeWidth={2}
        strokeDasharray="8 8"
        opacity={0.75 * ramp(t, 0.2, 0.3)}
      />
      <Label x={VW - 12} y={y0 + 22} anchor="end" size={15} show={ramp(t, 0.2, 0.3)}>
        original coastline
      </Label>
      {/* Erosion of the soft rock: waves and pebbles attacking the bay shores */}
      {bays.map((b) => {
        const cx = (b.x0 + b.x1) / 2;
        const on = ramp(t, 0.16, 0.2) * (1 - ramp(t, 0.62, 0.66));
        return (
          <g key={b.x0}>
            <Arrow a={[cx, y0 + 140]} b={[cx, coast(cx) + 16]} show={on} />
            <Hurled from={[cx - 40, coast(cx) + 70]} to={[cx - 6, coast(cx) + 6]} time={time} show={on} />
          </g>
        );
      })}
      <Label x={(bays[0].x0 + bays[0].x1) / 2} y={y0 + 175} show={ramp(t, 0.18, 0.22) * (1 - ramp(t, 0.62, 0.66))} colour={C.orange}>
        hydraulic action + abrasion
      </Label>
      <Label x={(bays[1].x0 + bays[1].x1) / 2} y={y0 + 175} show={ramp(t, 0.18, 0.22) * (1 - ramp(t, 0.62, 0.66))} colour={C.orange} size={16}>
        soft rock wears back fastest
      </Label>
      {/* Refraction: energy focused on the headlands, spread out in the bays */}
      {[70, 485, 885].map((x) => (
        <Arrow key={x} a={[x, y0 + 150]} b={[x, coast(x) + 14]} colour={C.red} width={7} show={refr} />
      ))}
      {bays.map((b) => {
        const cx = (b.x0 + b.x1) / 2;
        return (
          <g key={`r${b.x0}`}>
            <Arrow a={[cx - 30, y0 + 140]} b={[cx - 80, coast(cx - 80) + 30]} colour={C.blue} width={3} show={refr} />
            <Arrow a={[cx + 30, y0 + 140]} b={[cx + 80, coast(cx + 80) + 30]} colour={C.blue} width={3} show={refr} />
          </g>
        );
      })}
      {/* Headlands now under attack: caves, arches and stacks begin */}
      {[485, 885].map((x) => (
        <g key={`h${x}`} opacity={attackHead}>
          <ellipse cx={x - 30} cy={coast(x - 30) - 5} rx={7} ry={4} fill="#2f3433" />
          <circle cx={x + 18} cy={coast(x) + 18} r={8} fill={C.hard} stroke={C.ink} />
        </g>
      ))}
      {/* Labels */}
      {BANDS.map((b) => (
        <Label key={`l${b.x0}`} x={(b.x0 + b.x1) / 2} y={44} show={1 - ramp(t, 0.55, 0.6)} size={18} colour={b.hard ? '#ffffff' : C.yellow}>
          {b.hard ? 'Hard rock' : 'Soft rock'}
        </Label>
      ))}
      <Label x={VW / 2} y={y0 + 120} show={1 - ramp(t, 0.14, 0.18)} size={18}>
        Discordant coast: rock bands meet the sea at right angles
      </Label>
      {bays.map((b) => (
        <Label key={`b${b.x0}`} x={(b.x0 + b.x1) / 2} y={coast((b.x0 + b.x1) / 2) - 28} show={ramp(t, 0.44, 0.48)} size={26}>
          Bay
        </Label>
      ))}
      {[75, 485, 885].map((x) => (
        <Label key={`hd${x}`} x={x} y={coast(x) - 44} show={ramp(t, 0.62, 0.66)} size={22}>
          Headland
        </Label>
      ))}
      <Label x={485} y={y0 + 200} show={refr} colour={C.red} size={18}>
        wave energy focused on the headlands
      </Label>
      <Label x={485} y={y0 + 224} show={refr} colour={C.blue} size={16}>
        energy spread out in the bays → deposition
      </Label>
      {bays.map((b) => (
        <Label key={`s${b.x0}`} x={(b.x0 + b.x1) / 2} y={coast((b.x0 + b.x1) / 2) + 42} show={beach} colour={C.sand} size={17}>
          beach
        </Label>
      ))}
      <Label x={685} y={coast(885) - 90} show={attackHead} size={15}>
        headlands now eroded: caves, arches, stacks
      </Label>
      <Label x={VW / 2} y={VH - 52} show={ramp(t, 0.94, 0.98)} size={15}>
        e.g. Swanage Bay and Studland, Dorset
      </Label>
      <Legend
        y={VH - 12}
        items={[
          { colour: C.hard, label: 'Hard rock (e.g. chalk, limestone)' },
          { colour: C.soft, label: 'Soft rock (e.g. clay, sand)' },
          { colour: C.sand, label: 'Beach' },
        ]}
      />
    </Frame>
  );
}

// ------------------------------------------------------------------ cliffs and wave-cut platforms (cross-section)

export function CliffsPlatforms({ t, time }: SceneProps) {
  const top = 150;
  const HT = 318;
  const LT = 376;
  const X0 = 720;
  const cycles = 3;
  const step = 58;
  const u = ramp(t, 0.06, 0.76) * cycles;
  const done = Math.min(cycles, Math.floor(u));
  const inCycle = u - done;
  const notch = done < cycles ? 48 * ease(clamp(inCycle / 0.8)) : 0;
  const falling = done < cycles && inCycle > 0.8 ? (inCycle - 0.8) / 0.2 : 0;
  const Xc = X0 - done * step;
  const tide = (HT + LT) / 2 + ((LT - HT) / 2) * Math.sin(time * 0.9);
  const lowTide = ramp(t, 0.8, 0.86);
  const water = tide * (1 - lowTide) + (LT + 6) * lowTide;
  const platformY = (x: number) => LT - 6 + (x - Xc) * 0.05;
  const rock: P[] = [
    [0, top],
    [Xc, top],
    [Xc, HT - 6],
    [Xc - notch, HT + 16],
    [Xc - notch * 0.6, LT - 10],
    [Xc, LT - 6],
    ...curve(Xc, X0, platformY, 20).slice(1),
    [X0 + 10, platformY(X0) + 6],
    [VW, 470],
    [VW, VH],
    [0, VH],
  ];
  const block: P[] = [
    [Xc - notch, top],
    [Xc, top],
    [Xc, HT - 6],
    [Xc - notch, HT + 16],
  ];
  const attack = ramp(t, 0.02, 0.06) * (1 - ramp(t, 0.76, 0.8));
  const breakX = lerp(Xc + 20, X0 + 120, lowTide);
  return (
    <Frame title="Cliff retreat and a wave-cut platform">
      <rect x={0} y={water} width={VW} height={VH - water} fill="url(#lf-sea)" />
      <SeaSurface x0={0} x1={VW} y={water} time={time} />
      <path d={poly(rock, true)} fill={C.chalk} stroke={C.ink} strokeWidth={2} />
      <path d={poly(rock, true)} fill="url(#lf-strata)" />
      <rect x={0} y={top - 10} width={Xc - notch} height={12} fill={C.grass} />
      {falling > 0 && (
        <g transform={`translate(${falling * 20} ${falling * 170}) rotate(${falling * 28} ${Xc} ${HT})`} opacity={1 - falling}>
          <path d={poly(block, true)} fill={C.chalkDark} opacity={0.45} />
        </g>
      )}
      {/* Fallen blocks: broken up by attrition and carried away */}
      {Array.from({ length: done }, (_, k) => {
        const age = u - (k + 1);
        const s = 20 * clamp(1 - age / 0.9);
        if (s < 2) return null;
        return [0, 1, 2].map((j) => (
          <rect
            key={`${k}${j}`}
            x={X0 - k * step - 40 + j * (s + 4) + 10 * hash(k + j)}
            y={platformY(X0 - k * step) - s * (0.7 + 0.3 * hash(j))}
            width={s}
            height={s * (0.7 + 0.3 * hash(j))}
            fill={C.chalkDark}
            stroke={C.ink}
            rx={3}
          />
        ));
      })}
      {/* Rock pools on the exposed platform */}
      {lowTide > 0 &&
        [0.25, 0.55, 0.8].map((f, k) => {
          const x = lerp(Xc, X0, f);
          return <ellipse key={k} cx={x} cy={platformY(x) - 2} rx={14} ry={3} fill={C.river} opacity={lowTide} />;
        })}
      <path
        d={poly([
          [X0, top],
          [X0, LT],
        ])}
        stroke="#16211b"
        strokeWidth={2}
        strokeDasharray="8 7"
        opacity={ramp(t, 0.45, 0.5)}
      />
      <Label x={X0 + 10} y={top + 14} anchor="start" size={16} show={ramp(t, 0.45, 0.5)}>
        original cliff
      </Label>
      <Arrow a={[X0 - 6, top - 50]} b={[Xc + 10, top - 50]} colour={C.pink} width={4} show={ramp(t, 0.55, 0.6) * (Xc < X0 - 20 ? 1 : 0)} />
      <Label x={(X0 + Xc) / 2} y={top - 64} size={16} colour={C.pink} show={ramp(t, 0.55, 0.6) * (Xc < X0 - 20 ? 1 : 0)}>
        cliff retreats
      </Label>
      {[
        [HT, 'high tide'],
        [LT, 'low tide'],
      ].map(([y, s]) => (
        <g key={s as string}>
          <path
            d={poly([
              [X0 + 30, y as number],
              [VW, y as number],
            ])}
            stroke="#16211b"
            strokeDasharray="6 6"
            strokeWidth={2}
          />
          <Label x={VW - 10} y={(y as number) - 6} anchor="end" size={14}>
            {s}
          </Label>
        </g>
      ))}
      {/* Waves attacking the cliff foot */}
      <Arrow a={[Xc + 170, (HT + LT) / 2]} b={[Xc - notch + 14, (HT + LT) / 2]} show={attack} />
      <Hurled from={[Xc + 120, (HT + LT) / 2 + 10]} to={[Xc - notch + 8, HT + 18]} time={time} show={attack} />
      <Squeeze at={[Xc - notch + 6, HT + 10]} time={time} show={attack} />
      <Label x={Xc + 120} y={HT - 96} anchor="start" colour={C.orange} show={attack} size={18}>
        hydraulic action + abrasion
      </Label>
      <Label x={Xc + 120} y={HT - 74} anchor="start" show={attack} size={14}>
        between high and low tide
      </Label>
      <Label x={Xc - 230} y={HT + 80} to={[Xc - notch + 6, HT + 16]} show={notch > 12 ? ramp(t, 0.18, 0.22) : 0}>
        Wave-cut notch
      </Label>
      <Label x={Xc - 240} y={top + 70} to={[Xc - notch / 2, HT - 14]} show={notch > 25 ? ramp(t, 0.3, 0.34) : 0} colour={C.yellow}>
        Overhang
      </Label>
      <Label x={Xc + 20} y={top - 34} show={falling > 0 ? 1 : 0} colour={C.red} anchor="start" size={22}>
        Collapse (mass movement)
      </Label>
      <Label x={X0 - 60} y={LT + 120} show={done > 0 ? ramp(t, 0.42, 0.48) * (1 - ramp(t, 0.78, 0.82)) : 0} size={15}>
        fallen rock broken up by attrition and carried away
      </Label>
      <Label x={180} y={top + 110} size={26}>
        Cliff
      </Label>
      <Label x={(Xc + X0) / 2} y={LT + 62} to={[(Xc + X0) / 2, platformY((Xc + X0) / 2)]} size={24} show={ramp(t, 0.78, 0.84)}>
        Wave-cut platform
      </Label>
      <Label x={(Xc + X0) / 2} y={LT + 88} size={15} show={ramp(t, 0.82, 0.86)}>
        exposed at low tide · rock pools
      </Label>
      <Arrow a={[breakX + 90, LT - 112]} b={[breakX + 10, LT - 18]} colour={C.blue} width={3} show={ramp(t, 0.88, 0.92)} />
      <Label x={breakX + 60} y={LT - 120} anchor="start" size={15} show={ramp(t, 0.88, 0.92)}>
        waves break further out: retreat slows
      </Label>
      <Arrow a={[200, top - 80]} b={[230, top - 14]} colour={C.pink} width={3} show={ramp(t, 0.8, 0.84)} />
      <Label x={190} y={top - 90} anchor="end" size={15} show={ramp(t, 0.8, 0.84)}>
        weathering of the cliff top
      </Label>
      <Tag x={12} y={12} text="Cross-section · sea on the right · e.g. Seven Sisters, Sussex" />
    </Frame>
  );
}

// ------------------------------------------------------------------ caves, arches, stacks, stumps (side view + map inset)

export function CavesArchesStacks({ t, time }: SceneProps) {
  const top = 160;
  const tide = 396 + 10 * Math.sin(time * 0.9);
  const base = 410;
  const cx = 560;
  const crackW = 2 + 8 * ease(ramp(t, 0.15, 0.3));
  const cave = ease(ramp(t, 0.28, 0.47));
  const through = ease(ramp(t, 0.47, 0.62));
  const fall = ramp(t, 0.65, 0.75);
  const stumpU = ease(ramp(t, 0.88, 0.98));
  const notchStack = 24 * ease(ramp(t, 0.78, 0.88)) * (1 - stumpU);
  const hw = 26 + 30 * cave + 34 * through; // half-width of the opening
  const hh = 50 + 70 * cave + 80 * through; // height of the opening
  // Opening: straight sides from the sea floor, round top (an arch shape).
  const opening = (w: number, h: number) =>
    `M${cx - w},${base + 30} L${cx - w},${base - h + w} A${w},${w} 0 0 1 ${cx + w},${base - h + w} L${cx + w},${base + 30} Z`;
  const holeTop = base - hh;
  const stackTop = top + (372 - top) * stumpU;
  const left = fall > 0.02 ? cx - hw : 860;
  const mainland: P[] = [[0, top], [left, top], ...(fall > 0.02 ? [[cx - hw, base + 30] as P] : [[860, top + 18] as P, [880, base + 30] as P]), [0, base + 30]];
  const stack: P[] = [
    [cx + hw, stackTop],
    [860, stackTop + 18 * (1 - stumpU)],
    [880, base + 30],
    [cx + hw, base + 30],
  ];
  const attack = ramp(t, 0.12, 0.16) * (1 - ramp(t, 0.97, 1));
  // Map inset (top right): the headland from above, caves from both sides meeting.
  const ix = 640;
  const iy = 40;
  const iw = 300;
  const ih = 150;
  const capH = 40;
  const notchI = 22 * cave + 22 * through;
  return (
    <Frame title="Cave, arch, stack and stump forming in a headland">
      <rect x={0} y={tide} width={VW} height={VH - tide} fill="url(#lf-sea)" />
      <path d={poly(mainland, true)} fill={C.chalk} stroke={C.ink} strokeWidth={2} />
      <path d={poly(mainland, true)} fill="url(#lf-strata)" />
      <rect x={0} y={top - 10} width={left} height={11} fill={C.grass} />
      {fall <= 0.02 && cave > 0 && <path d={opening(hw, hh)} fill={through > 0.05 ? C.sky : '#2b302f'} stroke={C.ink} strokeWidth={2} />}
      {fall <= 0.02 && through > 0.05 && through < 1 && <path d={opening(hw, hh)} fill="#2b302f" opacity={1 - through} />}
      {fall <= 0.02 && cave > 0 && <rect x={cx - hw} y={tide} width={2 * hw} height={base + 30 - tide} fill={C.sea} opacity={0.85} />}
      <path
        d={poly([
          [cx, top + 4],
          [cx, base],
        ])}
        stroke="#3b3a36"
        strokeWidth={crackW * (1 - cave)}
        opacity={1 - fall}
      />
      {/* Arch roof thinning and collapsing */}
      {fall > 0.02 && fall < 1 && (
        <g transform={`translate(0 ${fall * 260}) rotate(${fall * 18} ${cx} ${top})`} opacity={1 - fall}>
          <rect x={cx - hw} y={top} width={2 * hw} height={holeTop - top + hw} fill={C.chalk} stroke={C.ink} strokeWidth={2} />
        </g>
      )}
      {fall > 0.02 && (
        <g>
          <path d={poly(stack, true)} fill={C.chalk} stroke={C.ink} strokeWidth={2} />
          <path d={poly(stack, true)} fill="url(#lf-strata)" />
          {stumpU < 0.5 && <rect x={cx + hw} y={stackTop - 10} width={860 - cx - hw} height={10} fill={C.grass} opacity={1 - stumpU * 2} />}
          {notchStack > 1 && (
            <path
              d={poly(
                [
                  [cx + hw, base - 30],
                  [cx + hw + notchStack, base - 14],
                  [cx + hw, base],
                ],
                true,
              )}
              fill="#2b302f"
            />
          )}
        </g>
      )}
      {fall >= 1 &&
        [0, 1, 2].map((k) => (
          <rect
            key={k}
            x={cx - hw + 10 + k * 34}
            y={base - 22 + k * 3}
            width={30}
            height={22}
            rx={4}
            fill={C.chalkDark}
            stroke={C.ink}
            opacity={1 - ramp(t, 0.8, 0.95)}
          />
        ))}
      <SeaSurface x0={0} x1={VW} y={tide} time={time} />
      {/* Processes */}
      <Arrow a={[cx + 230, tide - 24]} b={[cx + (cave > 0.1 ? 10 : 30), tide - 30]} show={attack * (1 - fall) + attack * ramp(t, 0.78, 0.82)} />
      <Hurled from={[cx + 180, tide - 10]} to={[cx + 4, tide - 30]} time={time} show={attack * (1 - ramp(t, 0.6, 0.64))} />
      <Squeeze at={[cx, tide - 40]} time={time} show={ramp(t, 0.15, 0.2) * (1 - ramp(t, 0.47, 0.5))} />
      <Label x={cx + 240} y={tide - 64} anchor="start" colour={C.orange} show={attack * (1 - ramp(t, 0.62, 0.65))} size={18}>
        hydraulic action + abrasion
      </Label>
      <Arrow a={[cx - 40, top - 70]} b={[cx - 10, top - 10]} colour={C.pink} width={3} show={ramp(t, 0.6, 0.64) * (1 - ramp(t, 0.7, 0.72))} />
      <Label x={cx - 50} y={top - 80} anchor="end" size={15} show={ramp(t, 0.6, 0.64) * (1 - ramp(t, 0.7, 0.72))}>
        weathering (freeze-thaw, rain) weakens the roof
      </Label>
      <Label x={cx - 180} y={top + 70} to={[cx - 2, top + 110]} show={1 - ramp(t, 0.3, 0.34)}>
        Joint (line of weakness)
      </Label>
      <Label x={cx} y={base - hh - 24} show={ramp(t, 0.32, 0.36) * (1 - ramp(t, 0.47, 0.5))} size={26}>
        Cave
      </Label>
      <Label x={cx} y={holeTop - 24} show={ramp(t, 0.5, 0.54) * (1 - ramp(t, 0.65, 0.68))} size={26}>
        Arch
      </Label>
      <Label x={720} y={stackTop - 30} show={ramp(t, 0.76, 0.8) * (1 - ramp(t, 0.88, 0.9))} size={26}>
        Stack
      </Label>
      <Label x={720} y={stackTop - 30} show={ramp(t, 0.92, 0.96)} size={26}>
        Stump
      </Label>
      <Label x={720} y={stackTop + 60} show={ramp(t, 0.94, 0.98)} size={15}>
        covered at high tide
      </Label>
      <Label x={180} y={top + 110} size={24}>
        Headland
      </Label>
      {/* Map inset */}
      <g>
        <rect x={ix} y={iy} width={iw} height={ih} rx={10} fill={C.sea} stroke="#16211b" />
        <path
          d={poly(
            [
              [ix, iy + 40],
              [ix + iw * 0.5 - notchI, iy + 40],
              ...(fall > 0.02
                ? []
                : ([
                    [ix + iw * 0.5 - 10, iy + 40 + notchI],
                    [ix + iw * 0.5 + 10, iy + 40 + notchI],
                  ] as P[])),
              [ix + iw * 0.5 + notchI, iy + 40],
              [ix + iw - 30, iy + 40],
              [ix + iw - 30, iy + 40 + capH * 2],
              [ix + iw * 0.5 + notchI, iy + 40 + capH * 2],
              ...(fall > 0.02
                ? []
                : ([
                    [ix + iw * 0.5 + 10, iy + 40 + capH * 2 - notchI],
                    [ix + iw * 0.5 - 10, iy + 40 + capH * 2 - notchI],
                  ] as P[])),
              [ix + iw * 0.5 - notchI, iy + 40 + capH * 2],
              [ix, iy + 40 + capH * 2],
            ],
            true,
          )}
          fill={C.chalk}
          stroke={C.ink}
        />
        {fall > 0.02 && <rect x={ix + iw * 0.5 - notchI} y={iy + 38} width={2 * notchI} height={capH * 2 + 4} fill={C.sea} />}
        {through > 0.3 && fall <= 0.02 && (
          <rect x={ix + iw * 0.5 - 10} y={iy + 40 + notchI} width={20} height={Math.max(0, capH * 2 - 2 * notchI)} fill={C.chalkDark} opacity={0.6} />
        )}
        <Label x={ix + iw / 2} y={iy + ih - 8} size={13}>
          from above: caves on both sides meet
        </Label>
      </g>
      <Tag x={12} y={12} text="Side view of a chalk headland · e.g. Old Harry Rocks, Dorset" />
    </Frame>
  );
}

// ------------------------------------------------------------------ beaches (cross-section)

export function Beaches({ t, time }: SceneProps) {
  const bed = (x: number) => 230 + (x - 60) * 0.3;
  const build = ease(ramp(t, 0.22, 0.8));
  const sorted = ramp(t, 0.66, 0.78);
  const thick = (x: number) => {
    if (x < 120 || x > 820) return 0;
    const u = (x - 120) / 700;
    const ridge = 26 * Math.exp(-(((x - 210) / 45) ** 2)) + 14 * Math.exp(-(((x - 360) / 40) ** 2)) * sorted;
    return build * (34 * Math.sin(Math.PI * Math.min(1, u * 1.05)) + ridge * sorted);
  };
  const surf = (x: number) => bed(x) - thick(x);
  const HT = 330;
  const LT = 395;
  const sea = (HT + LT) / 2 + ((LT - HT) / 2) * Math.sin(time * 0.6);
  const ph = (time % 3) / 3;
  const run = ph < 0.55 ? ease(ph / 0.55) : 1 - ease((ph - 0.55) / 0.45);
  const xs = 640 - 230 * run;
  const swashOn = ramp(t, 0.18, 0.22) * (1 - ramp(t, 0.86, 0.9));
  const shingleEnd = 300;
  const beachTop: P[] = curve(60, VW, surf, 120);
  // A pebble carried up by the swash and left behind (net movement up the beach).
  const pebbleX = 600 - ((time * 0.06) % 1) * 300;
  return (
    <Frame title="A beach building up from constructive waves">
      <rect x={0} y={sea} width={VW} height={VH - sea} fill="url(#lf-sea)" />
      <SeaSurface x0={0} x1={VW} y={sea} time={time} amp={3} />
      <path d={poly([[0, 200], [60, 230], ...curve(60, VW, bed, 60), [VW, VH], [0, VH]], true)} fill={C.hard} stroke={C.ink} strokeWidth={2} />
      <rect x={0} y={190} width={60} height={12} fill={C.grass} />
      <clipPath id="lf-beach">
        <path d={poly([...beachTop, ...curve(60, VW, bed, 60).reverse()], true)} />
      </clipPath>
      <g clipPath="url(#lf-beach)">
        <rect x={0} y={0} width={VW} height={VH} fill={C.sand} />
        <rect x={0} y={0} width={60 + (shingleEnd - 60) * sorted + 0.01} height={VH} fill={C.shingle} />
        <rect x={0} y={0} width={60 + (shingleEnd - 60) * sorted + 0.01} height={VH} fill="url(#lf-pebbles)" />
        <rect x={0} y={0} width={VW} height={VH} fill="url(#lf-dots)" opacity={0.6} />
      </g>
      <path d={smooth(beachTop)} stroke={C.ink} strokeWidth={1.5} fill="none" opacity={build > 0.02 ? 1 : 0} />
      {swashOn > 0 && (
        <path d={smooth(curve(xs, 700, (x) => surf(x) - 3, 20))} stroke={C.foam} strokeWidth={7} fill="none" opacity={0.85 * swashOn} strokeLinecap="round" />
      )}
      {swashOn > 0 && <circle cx={pebbleX} cy={surf(pebbleX) - 6} r={6} fill={C.shingle} stroke={C.ink} opacity={swashOn} />}
      {/* Constructive wave form offshore: low and long */}
      <path
        d={smooth(curve(700, VW, (x) => sea - 14 * Math.exp(-(((x - (820 - ((time * 40) % 120))) / 40) ** 2)), 60))}
        stroke={C.foam}
        strokeWidth={4}
        fill="none"
        opacity={ramp(t, 0.2, 0.24)}
      />
      <Label x={830} y={455} size={15} show={ramp(t, 0.2, 0.24) * (1 - ramp(t, 0.86, 0.9))}>
        low, long constructive wave
      </Label>
      <Arrow a={[690, 250]} b={[460, 210]} colour={C.blue} width={8} bend={-20} show={swashOn} />
      <Label x={560} y={175} colour={C.blue} show={swashOn}>
        strong swash carries sediment up
      </Label>
      <Arrow a={[470, 262]} b={[620, 288]} colour={C.blue} width={3} show={swashOn} />
      <Label x={630} y={318} anchor="start" size={16} show={swashOn}>
        weak backwash: water soaks into the beach
      </Label>
      {Array.from({ length: 10 }, (_, k) => {
        const u = ((time * 0.25 + k / 10) % 1) * (1 - ramp(t, 0.4, 0.45));
        const x = VW - 40 - u * 380;
        return u > 0 ? (
          <circle key={k} cx={x} cy={surf(x) - 6 - 4 * hash(k)} r={4 + 3 * hash(k + 3)} fill={k % 3 ? C.sand : C.shingle} stroke={C.ink} strokeWidth={1} />
        ) : null;
      })}
      <Label x={VW - 30} y={150} anchor="end" show={1 - ramp(t, 0.2, 0.24)} size={18}>
        sediment from rivers, eroded cliffs and longshore drift
      </Label>
      {[
        [HT, 'high tide'],
        [LT, 'low tide'],
      ].map(([y, s]) => (
        <g key={s as string}>
          <path
            d={poly([
              [720, y as number],
              [VW, y as number],
            ])}
            stroke="#16211b"
            strokeDasharray="6 6"
            strokeWidth={2}
          />
          <Label x={VW - 10} y={(y as number) - 6} anchor="end" size={14}>
            {s}
          </Label>
        </g>
      ))}
      <Label x={210} y={150} to={[210, surf(210) - 2]} show={sorted}>
        Storm ridge / berm
      </Label>
      <Label x={180} y={330} show={sorted} colour={C.shingle}>
        Shingle (pebbles) thrown up by storms
      </Label>
      <Label x={540} y={370} show={sorted} colour={C.sand}>
        Sand lower down (backwash drags it)
      </Label>
      <Label x={480} y={64} size={28} show={ramp(t, 0.86, 0.9)}>
        Beach
      </Label>
      <Label x={480} y={90} size={15} show={ramp(t, 0.88, 0.92)}>
        from the lowest tides to the highest storm waves · e.g. Chesil Beach
      </Label>
      <Tag x={12} y={12} text="Cross-section · sea on the right" />
    </Frame>
  );
}

// ------------------------------------------------------------------ spits (map view)

export function Spits({ t, time }: SceneProps) {
  const coastY = 220;
  const mouthX = 470;
  const grow = ease(ramp(t, 0.22, 0.8));
  const L = 280 * grow;
  const spitY = (x: number) => coastY + 8 + 0.08 * (x - mouthX) + 6 * Math.sin((x - mouthX) / 60);
  const hookOn = ramp(t, 0.6, 0.66);
  const marsh = ramp(t, 0.8, 0.9);
  const land: P[] = [
    [0, 0],
    [0, coastY],
    [mouthX, coastY],
    [mouthX - 20, 120],
    [520, 40],
    [540, 0],
  ];
  const eastLand: P[] = [
    [700, 0],
    [690, 70],
    [760, 160],
    [800, 330],
    [VW, 330],
    [VW, 0],
  ];
  // Longshore drift: pebbles follow a sawtooth along the beach (swash at the wave angle, backwash straight down).
  const stepX = 46;
  const per = 2.4;
  const drift = (k: number) => {
    const tt = time + k * 0.8;
    const n = Math.floor(tt / per) % 9;
    const ph = (tt % per) / per;
    const x0 = 30 + n * stepX;
    const up = ph < 0.5;
    const u = up ? ph / 0.5 : (ph - 0.5) / 0.5;
    return up ? ([x0 + stepX * u, coastY + 46 - 36 * u] as P) : ([x0 + stepX, coastY + 10 + 36 * u] as P);
  };
  const saw: P[] = [];
  for (let k = 0; k <= 9; k++) saw.push([30 + k * stepX, coastY + 46], [30 + (k + 1) * stepX, coastY + 10]);
  const spitPath: P[] = curve(mouthX - 6, mouthX + Math.max(4, L), spitY, 40);
  const hookX = [0.38, 0.62, 0.85].filter((g) => grow > g).map((g) => mouthX + 280 * g);
  const tip: P = [mouthX + L, spitY(mouthX + L)];
  const hook = (hx: number, k: number, scale: number) => {
    const hy = spitY(hx);
    return (
      <path
        key={k}
        d={smooth([
          [hx - 30, hy + 2],
          [hx + 4, hy - 4],
          [hx + 12, hy - 30 * scale],
          [hx - 4, hy - 56 * scale],
        ])}
        stroke={C.shingle}
        strokeWidth={12}
        fill="none"
        strokeLinecap="round"
        opacity={hookOn}
      />
    );
  };
  return (
    <Frame map title="A spit growing across an estuary by longshore drift">
      <rect x={0} y={0} width={VW} height={VH} fill={C.sea} />
      <PlanWaves x={0} y={coastY + 60} w={VW} h={VH - coastY - 60} time={time} gap={40} />
      {/* Estuary and river */}
      <path
        d={poly(
          [
            [mouthX, coastY],
            [mouthX - 20, 120],
            [520, 40],
            [540, 0],
            [700, 0],
            [690, 70],
            [760, 160],
            [800, 330],
            [mouthX, 330],
          ],
          true,
        )}
        fill={C.river}
      />
      <Arrow a={[610, 30]} b={[650, 330]} colour={C.blue} width={4} bend={-20} dash="12 8" />
      {/* Saltmarsh with creeks behind the spit */}
      {L > 60 && (
        <g opacity={marsh}>
          <path
            d={smooth(
              [
                [mouthX - 4, coastY - 4],
                ...curve(mouthX, mouthX + L * 0.85, (x) => spitY(x) - 10, 12),
                [mouthX + L * 0.6, coastY - 60],
                [mouthX + 20, coastY - 80],
              ],
              true,
            )}
            fill={C.saltmarsh}
          />
          <path
            d={smooth([
              [mouthX + 30, coastY - 50],
              [mouthX + 70, coastY - 30],
              [mouthX + 110, coastY - 34],
              [mouthX + 160, coastY - 10],
            ])}
            stroke={C.river}
            strokeWidth={3}
            fill="none"
          />
          <path
            d={smooth([
              [mouthX + 80, coastY - 32],
              [mouthX + 96, coastY - 60],
            ])}
            stroke={C.river}
            strokeWidth={2}
            fill="none"
          />
        </g>
      )}
      <path d={poly(land, true)} fill={C.grass} stroke={C.ink} strokeWidth={2} />
      <path d={poly(eastLand, true)} fill={C.grass} stroke={C.ink} strokeWidth={2} />
      <path
        d={poly([
          [0, coastY - 5],
          [mouthX, coastY - 5],
        ])}
        stroke={C.sand}
        strokeWidth={16}
      />
      {/* Spit body: shingle ridge on a sand base */}
      <path d={smooth(spitPath)} stroke={C.sand} strokeWidth={22} fill="none" strokeLinecap="round" opacity={L > 2 ? 1 : 0} />
      <path d={smooth(spitPath)} stroke={C.shingle} strokeWidth={8} fill="none" strokeLinecap="round" opacity={L > 2 ? 0.8 : 0} />
      {hookX.map((hx, k) => hook(hx, k, 0.8))}
      {grow > 0.5 && hook(tip[0], 9, 1)}
      {/* Longshore drift */}
      <path d={poly(saw)} stroke={C.orange} strokeWidth={2} strokeDasharray="5 5" fill="none" opacity={0.9 * (1 - ramp(t, 0.45, 0.5))} />
      {[0, 1, 2].map((k) => {
        const p = drift(k);
        return <circle key={k} cx={p[0]} cy={p[1]} r={8} fill={C.shingle} stroke={C.ink} strokeWidth={1.5} />;
      })}
      <Label x={120} y={coastY + 82} size={15} show={1 - ramp(t, 0.45, 0.5)}>
        swash ↗ at the wave angle · backwash ↓ straight down
      </Label>
      <Arrow a={[40, 480]} b={[190, 370]} colour={C.blue} width={7} />
      <Label x={40} y={510} anchor="start" colour={C.blue} size={18}>
        prevailing wind and waves from the south-west
      </Label>
      <Arrow a={[80, coastY + 120]} b={[440, coastY + 120]} colour={C.orange} width={6} show={ramp(t, 0.02, 0.06)} />
      <Label x={260} y={coastY + 152} colour={C.orange} show={ramp(t, 0.02, 0.06)}>
        longshore drift
      </Label>
      <Label x={mouthX - 40} y={coastY + 200} to={[mouthX, coastY + 8]} show={ramp(t, 0.2, 0.24) * (1 - ramp(t, 0.55, 0.6))}>
        coastline changes direction
      </Label>
      <Label x={mouthX + 150} y={coastY + 110} to={[mouthX + L * 0.55, spitY(mouthX + L * 0.55) + 10]} size={26} show={ramp(t, 0.4, 0.45)}>
        Spit
      </Label>
      <Arrow a={[tip[0] + 120, 470]} b={[tip[0] + 30, tip[1] + 40]} colour={C.pink} width={5} show={hookOn * (1 - ramp(t, 0.8, 0.84))} />
      <Label x={tip[0] + 130} y={500} anchor="start" size={16} show={hookOn * (1 - ramp(t, 0.8, 0.84))}>
        wind and waves from another direction
      </Label>
      <Label x={tip[0] + 60} y={tip[1] - 80} to={[tip[0] + 2, tip[1] - 46]} show={hookOn} anchor="start">
        Recurved end (hook)
      </Label>
      <Label x={mouthX + 90} y={coastY - 100} show={marsh} colour={C.saltmarsh}>
        Saltmarsh
      </Label>
      <Label x={mouthX + 90} y={coastY - 80} show={marsh} size={14}>
        calm water behind the spit: mud settles, plants grow
      </Label>
      <Label x={640} y={22} show={ramp(t, 0.8, 0.85)} size={15}>
        river current stops the spit crossing the estuary
      </Label>
      <Tag x={VW - 12} y={VH - 38} text="Map view · e.g. Spurn Head, Hurst Castle spit" anchor="end" />
    </Frame>
  );
}

// ------------------------------------------------------------------ bars (map view)

export function Bars({ t, time }: SceneProps) {
  const leftTip: P = [180, 330];
  const rightTip: P = [780, 330];
  const grow = ease(ramp(t, 0.18, 0.58));
  const L = (rightTip[0] - leftTip[0]) * grow;
  const joined = grow >= 0.999;
  const lagoon = ramp(t, 0.72, 0.85);
  const infill = ramp(t, 0.86, 1);
  const bayShore = (x: number) => 330 - 190 * Math.sin((Math.PI * (x - leftTip[0])) / (rightTip[0] - leftTip[0]));
  const bay: P[] = curve(leftTip[0], rightTip[0], bayShore, 60);
  const barY = (x: number) => 338 + 10 * Math.sin((Math.PI * (x - leftTip[0])) / (rightTip[0] - leftTip[0]));
  const barPts: P[] = curve(leftTip[0] - 4, leftTip[0] + Math.max(4, L), barY, 40);
  const n = Math.floor((time / 2.2) % 12);
  const ph = (time % 2.2) / 2.2;
  const dx = 50;
  const px = 60 + n * dx + (ph < 0.5 ? dx * (ph / 0.5) : dx);
  const py = ph < 0.5 ? 400 - 34 * (ph / 0.5) : 366 + 34 * ((ph - 0.5) / 0.5);
  return (
    <Frame map title="A bar forming across a bay and trapping a lagoon">
      <rect x={0} y={0} width={VW} height={VH} fill={C.sea} />
      <PlanWaves x={0} y={370} w={VW} h={VH - 370} time={time} gap={40} />
      <path
        d={poly([...bay, [rightTip[0], 342], [leftTip[0], 342]], true)}
        fill={joined ? `rgb(${63 + 50 * lagoon},${127 + 40 * lagoon},${192 - 40 * lagoon})` : C.sea}
      />
      {infill > 0 && (
        <path
          d={smooth(
            [
              ...curve(leftTip[0] + 10, rightTip[0] - 10, (x) => bayShore(x) + 8, 30),
              ...curve(rightTip[0] - 40, leftTip[0] + 40, (x) => bayShore(x) + 10 + 70 * infill * Math.sin((Math.PI * (x - leftTip[0])) / 600), 30),
            ],
            true,
          )}
          fill={C.saltmarsh}
          opacity={0.95}
        />
      )}
      <path d={poly([[0, 0], [0, 330], leftTip, ...bay, rightTip, [VW, 330], [VW, 0]], true)} fill={C.grass} stroke={C.ink} strokeWidth={2} />
      <path d={smooth(barPts)} stroke={C.sand} strokeWidth={22} fill="none" strokeLinecap="round" />
      <path d={smooth(barPts)} stroke={C.shingle} strokeWidth={7} fill="none" opacity={0.8} strokeLinecap="round" />
      {px < leftTip[0] + L && <circle cx={px} cy={py} r={7} fill={C.shingle} stroke={C.ink} strokeWidth={1.5} opacity={1 - ramp(t, 0.6, 0.65)} />}
      <Arrow a={[60, 440]} b={[320, 440]} colour={C.orange} width={6} show={ramp(t, 0.02, 0.06) * (1 - ramp(t, 0.6, 0.65))} />
      <Label x={190} y={475} colour={C.orange} show={ramp(t, 0.02, 0.06) * (1 - ramp(t, 0.6, 0.65))}>
        longshore drift
      </Label>
      <Label x={480} y={200} size={26} show={1 - ramp(t, 0.7, 0.74)}>
        Bay
      </Label>
      <Label x={480} y={232} size={15} show={1 - ramp(t, 0.18, 0.22)}>
        no large river flows into it
      </Label>
      <Label
        x={leftTip[0] + L * 0.6}
        y={410}
        to={[leftTip[0] + L * 0.6, barY(leftTip[0] + L * 0.6) + 10]}
        show={ramp(t, 0.25, 0.3) * (1 - ramp(t, 0.55, 0.58))}
      >
        Spit grows across the bay
      </Label>
      <Label x={480} y={420} to={[480, barY(480) + 12]} size={26} show={ramp(t, 0.57, 0.6)}>
        Bar
      </Label>
      <Label x={480} y={250} size={26} show={lagoon} colour={C.foam}>
        Lagoon
      </Label>
      <Label x={480} y={282} size={15} show={lagoon * (1 - infill)}>
        water trapped behind the bar
      </Label>
      <Label x={480} y={282} size={15} show={infill}>
        slowly filling with sediment and plants
      </Label>
      <Tag x={VW - 12} y={VH - 38} text="Map view · e.g. Slapton Ley, Devon" anchor="end" />
    </Frame>
  );
}
