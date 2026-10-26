import { waterfallGeometry, WATERFALL_DEFAULTS, type Pt as WPt } from '../../local/waterfall/model';
import { bendSection, CHANNEL_WIDTH_M, meanderAt, type Pt as MPt } from '../../local/meander/model';
import { Arrow, C, clamp, curve, ease, Frame, hash, Label, Legend, lerp, poly, ramp, smooth, Tag, VH, VW, type P } from './svg';
import type { SceneProps } from './coastScenes';

/** Pebbles bouncing along a river bed between a and b (abrasion and traction / saltation). */
function BedLoad({ a, b, time, n = 4, show = 1 }: { a: P; b: P; time: number; n?: number; show?: number }) {
  if (show <= 0) return null;
  return (
    <g opacity={clamp(show * 3)}>
      {Array.from({ length: n }, (_, k) => {
        const u = (time * 0.35 + k / n) % 1;
        const x = lerp(a[0], b[0], u);
        const y = lerp(a[1], b[1], u) - 8 * Math.abs(Math.sin(u * 18 + k));
        return <circle key={k} cx={x} cy={y} r={3.5 + 1.5 * hash(k)} fill={C.shingle} stroke={C.ink} strokeWidth={1} />;
      })}
    </g>
  );
}

// ------------------------------------------------------------------ interlocking spurs (map + section + view up the valley)

export function InterlockingSpurs({ t, time }: SceneProps) {
  const cut = ease(ramp(t, 0.18, 0.55));
  const wind = ease(ramp(t, 0.45, 0.75));
  const spurs = ramp(t, 0.45, 0.75);
  const A = 18 + 52 * wind;
  const riverY = (x: number) => 270 + A * Math.sin((2 * Math.PI * (x - 20)) / 220);
  const tongues: { x: number; north: boolean }[] = [];
  for (let k = -1; k < 4; k++) {
    tongues.push({ x: 20 + 55 + 220 * k, north: true });
    tongues.push({ x: 20 + 165 + 220 * k, north: false });
  }
  const tongue = (x: number, north: boolean) => {
    const reach = north ? riverY(x) - 24 : riverY(x) + 24;
    const base = north ? 40 : 500;
    const w = 100;
    return smooth([
      [x - w, base],
      [x - w * 0.5, lerp(base, reach, 0.6)],
      [x, reach],
      [x + w * 0.5, lerp(base, reach, 0.6)],
      [x + w, base],
    ]);
  };
  const flow = (time * 40) % 30;
  // Cross-section of the V-shaped valley (top right).
  const sx0 = 640;
  const sx1 = 940;
  const sTop = 110;
  const depth = 30 + 140 * cut;
  const vx = (sx0 + sx1) / 2;
  const vPts: P[] = [
    [sx0, sTop],
    [vx - 16, sTop + depth],
    [vx + 16, sTop + depth],
    [sx1, sTop],
  ];
  const view = ramp(t, 0.7, 0.78);
  return (
    <Frame map title="Interlocking spurs in the upper course of a river">
      <rect x={0} y={0} width={600} height={VH} fill="#a9c58c" />
      <path d={smooth([...curve(0, 600, (x) => riverY(x) - 30, 60), ...curve(600, 0, (x) => riverY(x) + 30, 60)], true)} fill="#cfdcae" />
      <clipPath id="lf-plan">
        <rect x={0} y={0} width={600} height={VH} />
      </clipPath>
      <g clipPath="url(#lf-plan)" opacity={0.3 + 0.7 * spurs}>
        {tongues.map((s, k) => (
          <g key={k}>
            <path d={tongue(s.x, s.north) + 'Z'} fill={C.grassDark} stroke="#3f6b2c" strokeWidth={2} />
            {/* Contour lines on the spur */}
            {[0.35, 0.65].map((f) => (
              <path
                key={f}
                d={tongue(s.x, s.north)}
                fill="none"
                stroke="#ffffff55"
                strokeWidth={1.5}
                transform={`translate(${s.x * (1 - f)} ${(s.north ? 40 : 500) * (1 - f)}) scale(${f})`}
              />
            ))}
          </g>
        ))}
      </g>
      <path d={smooth(curve(0, 600, riverY, 90))} stroke={C.river} strokeWidth={9} fill="none" strokeLinecap="round" />
      <path d={smooth(curve(0, 600, riverY, 90))} stroke="#ffffff" strokeWidth={2} fill="none" strokeDasharray="6 24" strokeDashoffset={-flow} opacity={0.8} />
      <Tag x={12} y={12} text="Map view of the upper course · river flows to the right" />
      <Label x={110} y={riverY(110) + 56} show={1 - ramp(t, 0.45, 0.5)} size={18}>
        river (steep gradient, fast flow)
      </Label>
      <Label x={75} y={70} to={[75, 160]} show={ramp(t, 0.72, 0.76)}>
        Spur
      </Label>
      <Label x={405} y={490} to={[405, 380]} show={ramp(t, 0.72, 0.76)}>
        Spur
      </Label>
      <Label x={300} y={104} size={26} show={ramp(t, 0.76, 0.8)} colour={C.yellow}>
        Interlocking spurs
      </Label>
      <Label x={300} y={440} size={16} show={ramp(t, 0.5, 0.55)}>
        the river winds round ridges of resistant rock
      </Label>
      {/* Section panel */}
      <rect x={612} y={56} width={344} height={250} fill="#ffffffd9" rx={10} />
      <path d={poly([...vPts, [sx1, 296], [sx0, 296]], true)} fill={C.hard} stroke={C.ink} strokeWidth={2} />
      <path
        d={poly(
          [
            [sx0, sTop - 8],
            [sx0, sTop],
            [sx1, sTop],
            [sx1, sTop - 8],
          ],
          true,
        )}
        fill={C.grass}
      />
      <path
        d={poly([
          [vx - 13, sTop + depth - 6],
          [vx + 13, sTop + depth - 6],
        ])}
        stroke={C.river}
        strokeWidth={8}
      />
      <BedLoad a={[vx - 12, sTop + depth - 8]} b={[vx + 12, sTop + depth - 8]} time={time} n={2} show={ramp(t, 0.2, 0.25)} />
      <Arrow a={[vx, sTop + depth - 70]} b={[vx, sTop + depth - 14]} show={ramp(t, 0.2, 0.25) * (1 - ramp(t, 0.6, 0.65))} />
      <Label x={vx + 24} y={sTop + depth - 42} anchor="start" size={15} colour={C.orange} show={ramp(t, 0.2, 0.25) * (1 - ramp(t, 0.6, 0.65))}>
        vertical erosion
      </Label>
      {/* Weathered rock falling down the valley sides */}
      {ramp(t, 0.3, 0.35) > 0 &&
        [0, 1].map((k) => {
          const u = (time * 0.4 + k * 0.5) % 1;
          const side = k ? 1 : -1;
          const x = lerp(vx + side * 130, vx + side * 20, u);
          const y = lerp(sTop + 6, sTop + depth - 10, u) - 6;
          return <rect key={k} x={x - 4} y={y - 4} width={8} height={7} fill={C.hardDark} transform={`rotate(${u * 360} ${x} ${y})`} />;
        })}
      <Label x={sx0 - 20} y={Math.min(sTop + depth + 32, 300)} anchor="start" size={14} show={ramp(t, 0.3, 0.35)}>
        weathering + mass movement lower the sides
      </Label>
      <Label x={784} y={84} size={17}>
        Cross-section: V-shaped valley
      </Label>
      {/* Looking up the valley */}
      <rect x={612} y={318} width={344} height={210} fill="#ffffffd9" rx={10} opacity={view} />
      {view > 0 && (
        <g opacity={view}>
          <rect x={622} y={350} width={324} height={168} fill={C.sky} rx={6} />
          <path
            d={poly(
              [
                [770, 518],
                [782, 380],
                [788, 380],
                [800, 518],
              ],
              true,
            )}
            fill={C.river}
          />
          {[3, 2, 1, 0].map((k) => {
            const s = 1 - k * 0.2;
            const yTop = 518 - 130 * s;
            const left = k % 2 === 0;
            const edge = left ? 622 : 946;
            const tip = 784 + (left ? 1 : -1) * 46 * s;
            const shade = ['#4f7d36', '#5d8a41', '#6f9c4f', '#82ad60'][k];
            return (
              <path
                key={k}
                d={
                  smooth([
                    [edge, 518],
                    [edge, yTop],
                    [lerp(edge, tip, 0.55), yTop + 18 * s],
                    [tip, 518],
                  ]) + 'Z'
                }
                fill={shade}
                stroke="#3f6b2c"
                strokeWidth={1.5}
              />
            );
          })}
          <Label x={784} y={344} size={15}>
            Looking up the valley: spurs overlap like a zip
          </Label>
        </g>
      )}
      <Tag x={12} y={VH - 38} text="e.g. upper River Tees" />
    </Frame>
  );
}

// ------------------------------------------------------------------ waterfalls and gorges (guided model)

export function WaterfallsGorges({ t, time }: SceneProps) {
  const years = t < 0.32 ? lerp(0, 33, ramp(t, 0.05, 0.32)) : t < 0.5 ? lerp(34, 60, ramp(t, 0.32, 0.5)) : lerp(60, 300, ease(ramp(t, 0.5, 0.95)));
  const g = waterfallGeometry(years, WATERFALL_DEFAULTS, -120, 60);
  const s = g.state;
  const p = WATERFALL_DEFAULTS;
  const X = (x: number) => 30 + ((x + 120) / 180) * (VW - 60);
  const sx = (VW - 60) / 180;
  const Z = (z: number) => VH - 60 - (z + 18) * ((VH - 150) / 44);
  const pts = (q: WPt[]) => q.map((r) => [X(r.x), Z(r.z)] as P);
  const flow = (time * 60) % 40;
  // Plunge pool water: the hollow in the soft-rock profile below the river level, between the fall and the outflow.
  const poolPts = g.soft.filter((q) => q.z < 0.4 && q.x >= g.pool.x - 0.4 * p.heightM && q.x <= g.pool.x + 0.4 * p.heightM);
  const pool: P[] = poolPts.length > 1 ? [...pts(poolPts), [X(poolPts[poolPts.length - 1].x), Z(0.5)], [X(poolPts[0].x), Z(0.5)]] : [];
  const swirl = ramp(t, 0.4, 0.45);
  const gorgeOn = g.gorge ? ramp(t, 0.8, 0.86) : 0;
  return (
    <Frame title="Waterfall retreat leaving a gorge">
      <path d={poly(pts(g.soft), true)} fill={C.soft} stroke={C.softDark} strokeWidth={1.5} />
      <path d={poly(pts(g.soft), true)} fill="url(#lf-strata)" />
      <path d={poly(pts(g.hard), true)} fill={C.hard} stroke={C.hardDark} strokeWidth={2} />
      {pool.length > 2 && <path d={poly(pool, true)} fill={C.river} opacity={0.75} />}
      {s.blocks.map((b, k) => (
        <rect
          key={k}
          x={X(b.x) - (b.size * sx) / 2}
          y={Z(0) - b.size * sx * 0.9}
          width={b.size * sx}
          height={b.size * sx * 0.9}
          fill={C.hardDark}
          stroke={C.ink}
          transform={`rotate(${((k * 23) % 40) - 20} ${X(b.x)} ${Z(0)})`}
        />
      ))}
      <path d={poly(pts(g.waterUp))} stroke={C.river} strokeWidth={9} fill="none" />
      <path d={smooth(pts(g.curtain))} stroke="#7fb3ec" strokeWidth={14} fill="none" opacity={0.9} />
      <path d={smooth(pts(g.curtain))} stroke="#ffffff" strokeWidth={3} fill="none" strokeDasharray="8 12" strokeDashoffset={-flow} />
      <path d={poly(pts(g.waterDown))} stroke={C.river} strokeWidth={9} fill="none" />
      {/* Swirling rocks in the plunge pool (abrasion) */}
      {swirl > 0 &&
        [0, 1, 2].map((k) => {
          const a = time * 3 + (k * 2 * Math.PI) / 3;
          const cx = X(g.pool.x) + Math.cos(a) * 0.12 * p.heightM * sx;
          const cy = Z(-s.poolDepthM / 2) + Math.sin(a) * Math.max(3, (Z(-s.poolDepthM) - Z(0)) * 0.3);
          return <circle key={k} cx={cx} cy={cy} r={5} fill={C.shingle} stroke={C.ink} opacity={swirl} />;
        })}
      {/* Spray */}
      {[0, 1, 2, 3].map((k) => {
        const u = (time * 0.8 + k / 4) % 1;
        return <circle key={`s${k}`} cx={X(g.pool.x) + (k - 1.5) * 12 * u} cy={Z(1) - 30 * u} r={3} fill="#ffffff" opacity={0.7 * (1 - u)} />;
      })}
      <Label x={X(-100)} y={Z(p.heightM) - 40} anchor="start">
        Hard rock (e.g. dolerite)
      </Label>
      <Label x={X(-100)} y={Z(5)} anchor="start" colour={C.yellow}>
        Soft (less resistant) rock, e.g. limestone and shale
      </Label>
      <Arrow
        a={[X(s.lipX) + 150, Z(p.heightM * 0.45)]}
        b={[X(s.lipX - s.overhangM) + 8, Z(p.heightM * 0.45)]}
        show={ramp(t, 0.1, 0.14) * (1 - ramp(t, 0.3, 0.33))}
      />
      <Label x={X(s.lipX) + 160} y={Z(p.heightM * 0.45) - 14} anchor="start" colour={C.orange} show={ramp(t, 0.1, 0.14) * (1 - ramp(t, 0.3, 0.33))} size={18}>
        undercutting: hydraulic action + abrasion
      </Label>
      <Label
        x={X(s.lipX - s.overhangM / 2) - 60}
        y={Z(p.heightM) - 90}
        to={[X(s.lipX - s.overhangM / 2), Z(p.heightM - p.capThicknessM / 2)]}
        show={s.overhangM > 2 ? 1 : 0}
      >
        Overhang
      </Label>
      <Label x={X(s.lipX) + 20} y={Z(p.heightM) - 130} colour={C.red} show={s.justCollapsed ? 1 : 0} anchor="start" size={22}>
        Overhang collapses!
      </Label>
      <Label x={X(g.pool.x) + 90} y={Z(-s.poolDepthM) + 46} to={[X(g.pool.x) + 6, Z(-s.poolDepthM / 2)]} anchor="start" show={ramp(t, 0.45, 0.5)}>
        Plunge pool (deepened by swirling rocks)
      </Label>
      <Arrow
        a={[X(s.lipX) - 10, Z(p.heightM) + 50]}
        b={[X(s.lipX) - 130, Z(p.heightM) + 50]}
        colour={C.pink}
        width={4}
        show={ramp(t, 0.66, 0.7) * (1 - ramp(t, 0.85, 0.88))}
      />
      <Label x={X(s.lipX) - 140} y={Z(p.heightM) + 56} anchor="end" colour={C.pink} show={ramp(t, 0.66, 0.7) * (1 - ramp(t, 0.85, 0.88))}>
        retreats upstream
      </Label>
      {g.gorge && (
        <g opacity={gorgeOn}>
          <path
            d={poly([
              [X(g.gorge.x0), Z(p.heightM) - 24],
              [X(g.gorge.x0), Z(p.heightM) - 34],
              [X(g.gorge.x1), Z(p.heightM) - 34],
              [X(g.gorge.x1), Z(p.heightM) - 24],
            ])}
            stroke={C.yellow}
            strokeWidth={4}
            fill="none"
          />
          <Label x={(X(g.gorge.x0) + X(g.gorge.x1)) / 2 + 40} y={Z(p.heightM) - 46} size={22} anchor="start">
            {`Gorge, ${Math.round(s.retreatM)} m long`}
          </Label>
        </g>
      )}
      {/* Gorge cross-section inset */}
      <g opacity={gorgeOn}>
        <rect x={700} y={330} width={240} height={160} rx={10} fill="#ffffffe0" />
        <path
          d={poly(
            [
              [712, 360],
              [800, 360],
              [806, 466],
              [834, 466],
              [840, 360],
              [928, 360],
              [928, 480],
              [712, 480],
            ],
            true,
          )}
          fill={C.hard}
          stroke={C.ink}
        />
        <path
          d={poly([
            [808, 460],
            [832, 460],
          ])}
          stroke={C.river}
          strokeWidth={8}
        />
        <Label x={820} y={352} size={14}>
          across the gorge: steep, narrow sides
        </Label>
      </g>
      <Tag x={12} y={12} text="Long profile · river flows to the right · e.g. High Force, River Tees" />
    </Frame>
  );
}

// ------------------------------------------------------------------ meanders (guided model): shared plan drawing

const MS = 0.62; // px per metre
const PLAN_Y = 205;
const midOf = (p: number) => {
  const c = meanderAt(Math.min(p, 0.999)).channel;
  return c[Math.floor(c.length / 2)];
};

function planXY(p: number) {
  const m = midOf(p);
  return (q: MPt): P => [VW / 2 + (q.x - m.x) * MS, PLAN_Y + (q.y - m.y) * MS];
}

/** Signed turning at each point of a polyline. */
function curvatures(pts: P[]): number[] {
  return pts.map((_, k) => {
    const a = pts[Math.max(0, k - 6)];
    const b = pts[k];
    const c = pts[Math.min(pts.length - 1, k + 6)];
    const h1 = Math.atan2(b[1] - a[1], b[0] - a[0]);
    const h2 = Math.atan2(c[1] - b[1], c[0] - b[0]);
    let d = h2 - h1;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    return d;
  });
}

const offsetLine = (pts: P[], off: number[]): P[] =>
  pts.map((q, k) => {
    const a = pts[Math.max(0, k - 1)];
    const b = pts[Math.min(pts.length - 1, k + 1)];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const l = Math.hypot(dx, dy) || 1;
    return [q[0] - (dy / l) * off[k], q[1] + (dx / l) * off[k]];
  });

export function Meanders({ t, time }: SceneProps) {
  const p = 0.3 + 0.62 * ease(ramp(t, 0.02, 0.95));
  const s = meanderAt(p);
  const toXY = planXY(p);
  const pts = s.channel.map(toXY);
  const kv = curvatures(pts);
  const kmax = Math.max(...kv.map(Math.abs)) || 1;
  const w = CHANNEL_WIDTH_M * MS;
  const thal = ramp(t, 0.2, 0.25);
  const cliff = ramp(t, 0.4, 0.45);
  const bar = ramp(t, 0.6, 0.66);
  const thalweg = offsetLine(
    pts,
    kv.map((k) => -Math.sign(k) * 0.32 * w * Math.min(1, Math.abs(k) / (0.5 * kmax))),
  );
  const bends: { bar: P[]; cliff: P[]; mid: P; outer: P; inner: P }[] = [];
  let run: number[] = [];
  const flush = () => {
    if (run.length > 8) {
      const seg = run.map((k) => pts[k]);
      const sgn = Math.sign(kv[run[Math.floor(run.length / 2)]]);
      const inner = offsetLine(
        seg,
        run.map(() => sgn * (w / 2)),
      );
      const innerFar = offsetLine(
        seg,
        run.map((k, j) => sgn * (w / 2 + 34 * bar * Math.sin((Math.PI * j) / (run.length - 1)) * Math.min(1, Math.abs(kv[k]) / (0.6 * kmax)))),
      );
      const cl = offsetLine(
        seg,
        run.map(() => -sgn * (w / 2 + 2)),
      );
      const m = Math.floor(seg.length / 2);
      bends.push({ bar: [...inner, ...innerFar.slice().reverse()], cliff: cl, mid: seg[m], outer: cl[m], inner: innerFar[m] });
    }
    run = [];
  };
  kv.forEach((k, i) => {
    if (Math.abs(k) > 0.45 * kmax && (run.length === 0 || Math.sign(kv[run[0]]) === Math.sign(k))) run.push(i);
    else {
      flush();
      if (Math.abs(k) > 0.45 * kmax) run.push(i);
    }
  });
  flush();
  const visible = bends.filter((b) => b.mid[0] > 60 && b.mid[0] < VW - 60);
  const showCliff = visible.reduce((a, b) => (b.outer[1] < a.outer[1] ? b : a), visible[0] ?? bends[0]);
  const showBar = visible.reduce((a, b) => (b.inner[1] > a.inner[1] ? b : a), visible[0] ?? bends[0]);
  const flow = (time * 50) % 40;
  const sec = bendSection();
  const bx0 = 590;
  const by0 = 392;
  const bX = (x: number) => bx0 + 30 + ((x + 8) / (CHANNEL_WIDTH_M + 16)) * 300;
  const bZ = (z: number) => by0 + 50 - z * 12;
  const heli = ramp(t, 0.42, 0.48);
  return (
    <Frame map title="Meanders with river cliffs and point bars">
      <rect x={0} y={0} width={VW} height={VH} fill="#c9d8a6" />
      {bends.map((b, k) => (
        <path key={k} d={poly(b.bar, true)} fill={C.sand} stroke={C.softDark} strokeWidth={1} opacity={bar} />
      ))}
      <path d={smooth(pts)} stroke={C.river} strokeWidth={w} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d={smooth(pts)} stroke="#ffffff" strokeWidth={2} fill="none" strokeDasharray="6 34" strokeDashoffset={-flow} opacity={0.7} />
      {thal > 0 && <path d={smooth(thalweg)} stroke={C.orange} strokeWidth={3.5} fill="none" strokeDasharray="10 7" opacity={thal} />}
      {bends.map((b, k) => (
        <path key={`c${k}`} d={smooth(b.cliff)} stroke="#6b4a2b" strokeWidth={6} fill="none" opacity={cliff} strokeLinecap="round" />
      ))}
      {bends.map((b, k) => (
        <Arrow
          key={`e${k}`}
          a={b.mid}
          b={[b.outer[0] + (b.outer[0] - b.mid[0]) * 0.9, b.outer[1] + (b.outer[1] - b.mid[1]) * 0.9]}
          colour={C.red}
          width={3}
          show={cliff * (1 - ramp(t, 0.6, 0.64))}
        />
      ))}
      <Label x={20} y={36} colour={C.orange} show={thal} anchor="start" size={18}>
        - - - fastest flow (thalweg) swings to the outside of bends
      </Label>
      {showCliff && (
        <Label x={showCliff.outer[0]} y={Math.max(30, showCliff.outer[1] - 36)} to={showCliff.outer} show={cliff}>
          River cliff (erosion on the outside)
        </Label>
      )}
      {showBar && (
        <Label x={Math.min(showBar.inner[0], 420)} y={430} to={showBar.inner} show={bar} colour={C.sand}>
          Point bar (deposition on the inside)
        </Label>
      )}
      <Label x={290} y={VH - 60} size={20} show={ramp(t, 0.8, 0.85)}>
        Meanders grow and migrate across the flood plain
      </Label>
      {/* Cross-section of a bend with helicoidal (corkscrew) flow */}
      <g opacity={heli}>
        <rect x={bx0} y={by0 - 22} width={360} height={160} rx={10} fill="#ffffffe8" />
        <path
          d={poly([...sec.bed.map((q) => [bX(q.x), bZ(q.z)] as P), [bX(CHANNEL_WIDTH_M + 8), bZ(-6)], [bX(-8), bZ(-6)]], true)}
          fill={C.mud}
          stroke={C.ink}
          strokeWidth={1.5}
        />
        <path
          d={
            poly(sec.bed.filter((q) => q.z < sec.water).map((q) => [bX(q.x), bZ(q.z)] as P)) +
            `L${bX(CHANNEL_WIDTH_M)},${bZ(sec.water)}L${bX(0)},${bZ(sec.water)}Z`
          }
          fill={C.river}
          opacity={0.85}
        />
        {/* Helicoidal flow: surface water towards the outer bank, bed flow back to the inner bank */}
        <Arrow a={[bX(10), bZ(0.2)]} b={[bX(34), bZ(0.2)]} colour="#ffffff" width={3} />
        <Arrow a={[bX(36), bZ(-1.8)]} b={[bX(14), bZ(-1.2)]} colour={C.yellow} width={3} />
        <circle cx={bX(sec.thalwegX)} cy={bZ(-1.6)} r={6} fill={C.orange} stroke={C.ink} />
        <Label x={bx0 + 10} y={by0 + 108} size={13} anchor="start">
          inside: slow, shallow → point bar
        </Label>
        <Label x={bx0 + 350} y={by0 - 2} size={13} anchor="end">
          outside: fast, deep → river cliff
        </Label>
        <Label x={bx0 + 180} y={by0 + 128} size={12}>
          corkscrew (helicoidal) flow carries sediment to the inside
        </Label>
      </g>
      <Tag x={12} y={VH - 38} text="Map view · drawn from the guided meander model" />
    </Frame>
  );
}

export function OxbowLakes({ t, time }: SceneProps) {
  const p = t < 0.5 ? lerp(0.62, 1, ease(ramp(t, 0, 0.5))) : lerp(1, 1.6, ramp(t, 0.82, 1));
  const s = meanderAt(p);
  const toXY = planXY(Math.min(p, 0.999));
  const pts = s.channel.map(toXY);
  const w = CHANNEL_WIDTH_M * MS;
  const flood = clamp(ramp(t, 0.4, 0.46) - ramp(t, 0.56, 0.62));
  const seal = ramp(t, 0.6, 0.7);
  const flow = (time * 50) % 40;
  const ox = s.oxbow ? s.oxbow.map(toXY) : null;
  const oxColour = s.oxbowInfill > 0 ? `rgb(${lerp(61, 143, s.oxbowInfill)},${lerp(134, 174, s.oxbowInfill)},${lerp(214, 106, s.oxbowInfill)})` : C.river;
  const nA = s.neckA ? toXY(s.neckA) : null;
  const nB = s.neckB ? toXY(s.neckB) : null;
  return (
    <Frame map title="An oxbow lake forming from a meander">
      <rect x={0} y={0} width={VW} height={VH} fill="#c9d8a6" />
      {flood > 0 && <rect x={0} y={0} width={VW} height={VH} fill="#7fb3ec" opacity={0.55 * flood} />}
      {ox && <path d={smooth(ox)} stroke={oxColour} strokeWidth={w * (1 - 0.35 * s.oxbowInfill)} fill="none" strokeLinecap="round" />}
      {ox && seal > 0 && [ox[0], ox[ox.length - 1]].map((q, k) => <circle key={k} cx={q[0]} cy={q[1]} r={w * 0.75 * seal} fill={C.silt} stroke={C.softDark} />)}
      <path d={smooth(pts)} stroke={C.river} strokeWidth={w} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d={smooth(pts)} stroke="#ffffff" strokeWidth={2} fill="none" strokeDasharray="6 34" strokeDashoffset={-flow} opacity={0.7} />
      {nA && nB && (
        <g opacity={ramp(t, 0.25, 0.3)}>
          <path d={poly([nA, nB])} stroke={C.red} strokeWidth={3} strokeDasharray="6 5" />
          <Arrow a={[nA[0] - 60, nA[1]]} b={[nA[0] - 8, nA[1]]} colour={C.red} width={4} />
          <Arrow a={[nB[0] + 60, nB[1]]} b={[nB[0] + 8, nB[1]]} colour={C.red} width={4} />
        </g>
      )}
      {nA && nB && (
        <Label x={(nA[0] + nB[0]) / 2} y={Math.max(nA[1], nB[1]) + 70} show={ramp(t, 0.25, 0.3)}>
          {`Neck narrowing: ${Math.round(s.neckM)} m (erosion on both outer banks)`}
        </Label>
      )}
      <Label x={VW / 2} y={440} size={24} show={flood} colour={C.blue}>
        Flood: the river cuts through the neck
      </Label>
      {ox && (
        <>
          <Label x={ox[Math.floor(ox.length / 2)][0]} y={Math.max(36, ox[Math.floor(ox.length / 2)][1] - 30)} size={26} show={ramp(t, 0.8, 0.85)}>
            {s.oxbowInfill > 0.5 ? 'Oxbow lake → meander scar' : 'Oxbow lake'}
          </Label>
          <Label x={ox[0][0] - 140} y={430} to={ox[0]} show={seal * (1 - ramp(t, 0.82, 0.86))} colour={C.silt}>
            deposition seals the ends
          </Label>
          <Label x={VW / 2} y={470} show={ramp(t, 0.55, 0.6)} size={17}>
            the river now takes the shorter, straighter course
          </Label>
        </>
      )}
      <Tag x={12} y={VH - 38} text="Map view · drawn from the guided meander model · e.g. River Severn" />
    </Frame>
  );
}

// ------------------------------------------------------------------ flood plains and levees (cross-section)

const FLOODS = [
  [0.18, 0.32],
  [0.38, 0.5],
  [0.56, 0.66],
  [0.72, 0.8],
  [0.84, 0.92],
] as const;

export function FloodplainsLevees({ t, time }: SceneProps) {
  const cx = 480;
  const half = 60;
  const base = 380;
  const layer = (x: number) => {
    const d = Math.max(0, Math.abs(x - cx) - half);
    return 12 * Math.exp(-d / 55) + 3;
  };
  const progress = FLOODS.map(([a, b]) => ramp(t, a + 0.04, b));
  const thick = (x: number, upto: number = FLOODS.length) => progress.slice(0, upto).reduce((acc, u) => acc + u * layer(x), 0);
  const ground = (x: number) => {
    if (x < 70) return base - 140 + x * 0.6;
    if (x > 890) return base - 140 + (VW - x) * 0.6;
    if (Math.abs(x - cx) < half) return base + 40 * Math.sqrt(1 - ((x - cx) / half) ** 2) - thick(cx - half - 1) * 0.3;
    return base - thick(x);
  };
  const inFlood = FLOODS.findIndex(([a, b]) => t >= a && t < b);
  const fl = inFlood >= 0 ? Math.sin(Math.PI * ramp(t, FLOODS[inFlood][0], FLOODS[inFlood][1])) : 0;
  const bankTop = base - thick(cx - half - 2);
  const water = inFlood >= 0 ? lerp(bankTop + 14, bankTop - 34, fl) : bankTop + 16;
  const spread = inFlood >= 0 ? 400 * fl : 0;
  const xa = Math.max(0, cx - half - spread);
  const xb = Math.min(VW, cx + half + spread);
  const layers = FLOODS.map((_, k) => {
    const top = curve(70, 890, (x) => (Math.abs(x - cx) < half ? NaN : base - thick(x, k + 1)), 160).filter((q) => !Number.isNaN(q[1]));
    const bot = curve(70, 890, (x) => (Math.abs(x - cx) < half ? NaN : base - thick(x, k)), 160).filter((q) => !Number.isNaN(q[1]));
    return { top, bot, k };
  });
  const sideSplit = (pts: P[], left: boolean) => pts.filter((q) => (left ? q[0] < cx : q[0] > cx));
  const waterBottom = curve(xa, xb, (x) => Math.max(water, ground(x)), 160);
  return (
    <Frame title="Flood plain and levees built by repeated floods">
      <path d={poly([...curve(0, VW, ground, 240), [VW, VH], [0, VH]], true)} fill={C.mud} stroke={C.ink} strokeWidth={2} />
      <path d={poly([...curve(0, VW, ground, 240), [VW, VH], [0, VH]], true)} fill="url(#lf-dots)" />
      {layers.map(({ top, bot, k }) =>
        [true, false].map((left) => {
          const tp = sideSplit(top, left);
          const bt = sideSplit(bot, left).reverse();
          if (tp.length < 2 || progress[k] <= 0) return null;
          return <path key={`${k}${left}`} d={poly([...tp, ...bt], true)} fill={k % 2 ? C.silt : '#d6c08f'} stroke={C.softDark} strokeWidth={0.8} />;
        }),
      )}
      {/* River and flood water (between the water level and the ground, wherever the ground is lower) */}
      <path d={poly([...waterBottom, [xb, water], [xa, water]], true)} fill={C.river} opacity={0.8} />
      <path
        d={poly([
          [xa, water],
          [xb, water],
        ])}
        stroke={C.foam}
        strokeWidth={2.5}
      />
      {inFlood >= 0 &&
        Array.from({ length: 28 }, (_, k) => {
          const side = k % 2 ? 1 : -1;
          const coarse = k < 12;
          const d = coarse ? 6 + 50 * hash(k) : 70 + 320 * hash(k + 7);
          if (d > spread) return null;
          const x = cx + side * (half + d);
          const ph = (time * (coarse ? 0.9 : 0.35) + hash(k + 3)) % 1;
          const y = lerp(water + 4, ground(x) - 3, ph);
          return <circle key={k} cx={x} cy={y} r={coarse ? 5 : 2.4} fill={coarse ? C.shingle : '#efe3c4'} stroke={C.ink} strokeWidth={coarse ? 1 : 0.5} />;
        })}
      <Label x={cx} y={110} size={26} show={inFlood >= 0 ? 1 : 0} colour={C.blue}>
        {`Flood ${inFlood + 1} of 5 shown`}
      </Label>
      <Label x={cx} y={136} size={15} show={inFlood >= 0 ? 1 : 0}>
        discharge above bankfull: water spills over the banks
      </Label>
      <Arrow
        a={[cx + half + 10, water - 12]}
        b={[cx + half + 220, water - 12]}
        colour={C.blue}
        width={4}
        show={ramp(t, 0.2, 0.24) * (1 - ramp(t, 0.34, 0.36))}
      />
      <Label x={cx + half + 120} y={water - 30} size={16} show={ramp(t, 0.2, 0.24) * (1 - ramp(t, 0.34, 0.36))}>
        shallower water, more friction: it slows down
      </Label>
      <Label x={cx - half - 120} y={bankTop - 80} to={[cx - half - 26, bankTop - 4]} show={ramp(t, 0.36, 0.4)}>
        coarse sand and gravel dropped first
      </Label>
      <Label x={210} y={base - 170} to={[190, base - thick(190) - 2]} show={ramp(t, 0.55, 0.6)} colour={C.silt}>
        fine silt and clay (alluvium) carried further
      </Label>
      <Label x={cx + half + 60} y={bankTop - 70} to={[cx + half + 26, bankTop - 4]} size={24} show={ramp(t, 0.74, 0.78)} anchor="start">
        Levee
      </Label>
      <Label x={750} y={base - 70} size={24} show={ramp(t, 0.74, 0.78)}>
        Flood plain
      </Label>
      <Arrow a={[cx - 40, base + 80]} b={[cx - 160, base + 80]} colour={C.pink} width={4} show={1 - ramp(t, 0.15, 0.2)} />
      <Arrow a={[cx + 40, base + 80]} b={[cx + 160, base + 80]} colour={C.pink} width={4} show={1 - ramp(t, 0.15, 0.2)} />
      <Label x={cx} y={base + 120} size={15} show={1 - ramp(t, 0.15, 0.2)}>
        meanders swing across the valley (lateral erosion), widening its floor
      </Label>
      <Tag x={12} y={12} text="Cross-section across the valley · one layer per flood" />
      <Legend
        items={[
          { colour: C.river, label: 'River / flood water' },
          { colour: '#d6c08f', label: 'Flood deposits (alluvium)' },
          { colour: C.mud, label: 'Older valley floor', pattern: 'lf-dots' },
        ]}
      />
    </Frame>
  );
}
