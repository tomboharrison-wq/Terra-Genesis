import { iceSurface, ridgeAt, troughProfile, VALLEY_DEPTH_M, VALLEY_HALF_WIDTH_M } from '../../local/glacial/model';
import { Arrow, C, clamp, curve, ease, Frame, hash, Label, lerp, poly, ramp, smooth, Tag, VH, VW, type P } from './svg';
import type { SceneProps } from './coastScenes';

const iceFill = 'url(#lf-ice)';

/** Interpolate z on a profile of points sorted by x. */
const zAt = (pts: { x: number; z: number }[], x: number) => {
  if (x <= pts[0].x) return pts[0].z;
  for (let k = 1; k < pts.length; k++)
    if (x <= pts[k].x) {
      const u = (x - pts[k - 1].x) / (pts[k].x - pts[k - 1].x);
      return lerp(pts[k - 1].z, pts[k].z, u);
    }
  return pts[pts.length - 1].z;
};

/** Animated dashes along a line to show ice moving. */
const FlowLine = ({ pts, time, colour = C.blue, show = 1 }: { pts: P[]; time: number; colour?: string; show?: number }) =>
  show > 0 ? (
    <path d={smooth(pts)} stroke={colour} strokeWidth={3} fill="none" strokeDasharray="14 12" strokeDashoffset={-(time * 30) % 26} opacity={0.75 * show} />
  ) : null;

// ------------------------------------------------------------------ corries, tarns and arêtes (guided model)

export function CorriesAretes({ t, time }: SceneProps) {
  const c = ease(ramp(t, 0.28, 0.82));
  const r = ridgeAt(c, 160);
  const X = (x: number) => VW / 2 + x * 0.3;
  const Z = (z: number) => 470 - z * 0.5;
  const prof = r.profile;
  const wall = 900 - 870 * c;
  const snow = ramp(t, 0.02, 0.15);
  const ice = ramp(t, 0.15, 0.25) * (1 - ramp(t, 0.82, 0.88));
  const tarn = ramp(t, 0.86, 0.94);
  const crest = Z(zAt(prof, 0));
  const sides = [-1, 1].map((sg) => {
    const dWall = wall + 25;
    const dLip = wall + 0.86 * 700;
    const zWall = zAt(prof, sg * dWall);
    const zLip = zAt(prof, sg * dLip);
    const topAt = (d: number) => lerp(zWall - 70, zLip + 30, clamp((d - dWall) / (dLip - dWall)));
    const ds = curve(dWall, dLip + 60, (d) => d, 60).map((q) => q[0]);
    const iceTop: P[] = [];
    const iceBot: P[] = [];
    const snowTop: P[] = [];
    for (const d of ds) {
      const z = zAt(prof, sg * d);
      const top = d <= dLip ? topAt(d) : zLip + 30 - (d - dLip) * 1.2;
      if (top > z) {
        iceTop.push([X(sg * d), Z(top)]);
        iceBot.push([X(sg * d), Z(z)]);
        snowTop.push([X(sg * d), Z(Math.min(top, z + 30 + 40 * Math.sin((Math.PI * (d - dWall)) / (dLip - dWall))))]);
      }
    }
    // Tarn: water behind the rock lip, up to the lip height.
    const lipZ = Math.max(...curve(dLip - 120, dLip + 40, (d) => zAt(prof, sg * d), 20).map((q) => q[1]));
    const tarnPts: P[] = [];
    for (const d of ds) {
      const z = zAt(prof, sg * d);
      if (d < dLip && z < lipZ - 2) tarnPts.push([X(sg * d), Z(z)]);
    }
    return { sg, iceTop, iceBot, snowTop, tarnPts, lipZ, dWall, dLip, zWall };
  });
  return (
    <Frame title="Corries cutting back into a ridge to leave an arête, then tarns">
      <path d={poly([...prof.map((q) => [X(q.x), Z(q.z)] as P), [X(1500), VH], [X(-1500), VH]], true)} fill={C.hard} stroke={C.ink} strokeWidth={2} />
      <path d={poly([...prof.map((q) => [X(q.x), Z(q.z)] as P), [X(1500), VH], [X(-1500), VH]], true)} fill="url(#lf-strata)" />
      {sides.map(({ sg, iceTop, iceBot, snowTop, tarnPts, lipZ }) => (
        <g key={sg}>
          {snow > 0 && t < 0.3 && iceTop.length > 2 && (
            <path d={poly([...snowTop, ...iceBot.slice().reverse()], true)} fill={C.snow} stroke={C.iceEdge} opacity={snow * (1 - ice)} />
          )}
          {ice > 0 && iceTop.length > 2 && (
            <path d={smooth([...iceTop, ...iceBot.slice().reverse()], true)} fill={iceFill} stroke={C.iceEdge} strokeWidth={2} opacity={ice} />
          )}
          {tarn > 0 && tarnPts.length > 2 && (
            <path d={poly([...tarnPts, [tarnPts[tarnPts.length - 1][0], Z(lipZ)], [tarnPts[0][0], Z(lipZ)]], true)} fill={C.river} opacity={tarn} />
          )}
        </g>
      ))}
      {/* Processes */}
      {sides.map(({ sg, dWall, dLip, zWall }) => {
        const mid = (dWall + dLip) / 2;
        const zf = zAt(prof, sg * mid);
        const on = ramp(t, 0.3, 0.35) * (1 - ramp(t, 0.82, 0.86));
        return (
          <g key={`p${sg}`} opacity={on}>
            <Arrow a={[X(sg * (mid + 80)), Z(zf + 150)]} b={[X(sg * (mid - 60)), Z(zf + 30)]} colour={C.blue} bend={sg * 40} width={4} />
            {[0, 1, 2].map((k) => {
              const u = ((time * 0.3 + k / 3) % 1) * 1;
              return (
                <rect
                  key={k}
                  x={X(sg * (dWall + 30 + u * 220)) - 5}
                  y={Z(zWall - 60 - u * 60) - 5}
                  width={10}
                  height={9}
                  fill={C.hardDark}
                  transform={`rotate(${k * 30} ${X(sg * (dWall + 30 + u * 220))} ${Z(zWall - 60 - u * 60)})`}
                />
              );
            })}
          </g>
        );
      })}
      {/* Snowfall */}
      {snow > 0 &&
        Array.from({ length: 14 }, (_, k) => {
          const u = (time * 0.25 + hash(k)) % 1;
          return <circle key={`f${k}`} cx={40 + hash(k + 5) * (VW - 80)} cy={40 + u * 300} r={3} fill="#ffffff" opacity={(1 - ramp(t, 0.2, 0.26)) * 0.9} />;
        })}
      {/* Freeze-thaw in the back wall: water in a crack freezes, expands and wedges rock off */}
      {sides.map(({ sg, dWall, zWall }) => {
        const on = ramp(t, 0.3, 0.35) * (1 - ramp(t, 0.82, 0.86));
        const x = X(sg * (dWall - 10));
        const y = Z(zWall + 40);
        const frozen = Math.sin(time * 1.5) > 0;
        return on > 0 ? (
          <g key={`ft${sg}`} opacity={on}>
            <path
              d={poly([
                [x, y - 22],
                [x + sg * 6, y - 8],
                [x, y + 6],
              ])}
              stroke={frozen ? '#ffffff' : C.river}
              strokeWidth={frozen ? 6 : 3}
              fill="none"
            />
          </g>
        ) : null;
      })}
      <Label x={X(-1000)} y={Z(640)} show={ramp(t, 0.32, 0.36) * (1 - ramp(t, 0.82, 0.86))} colour={C.yellow}>
        plucking + freeze-thaw steepen the back wall
      </Label>
      <Label x={X(-wall - 300)} y={Z(-20) + 50} show={ramp(t, 0.34, 0.38) * (1 - ramp(t, 0.82, 0.86))} colour={C.blue}>
        rotational movement: abrasion deepens the floor
      </Label>
      <Label x={X(0)} y={VH - 18} show={ramp(t, 0.9, 0.95)} size={15}>
        e.g. Striding Edge and Red Tarn, Helvellyn (Lake District)
      </Label>
      <Label x={X(-1150)} y={Z(160)} show={snow * (1 - ramp(t, 0.15, 0.2))}>
        snow collects
      </Label>
      <Label x={X(-1150)} y={Z(160)} show={ramp(t, 0.2, 0.24) * (1 - ramp(t, 0.3, 0.32))}>
        snow → firn → ice
      </Label>
      <Label x={X(900)} y={Z(500)} show={ramp(t, 0.5, 0.55)} size={24}>
        Corrie
      </Label>
      <Label x={X(0)} y={crest - 40} show={r.arete ? ramp(t, 0.7, 0.74) : 0} size={26}>
        Arête
      </Label>
      <Label x={X(0)} y={crest - 40} show={!r.arete ? ramp(t, 0.5, 0.54) : 0} size={18}>
        ridge narrowing
      </Label>
      {sides.map(({ sg, dLip, lipZ }) => (
        <g key={`l${sg}`}>
          <Label x={X(sg * (dLip + 160))} y={Z(lipZ) + 70} to={[X(sg * (dLip + 10)), Z(lipZ) + 4]} show={ramp(t, 0.6, 0.64)} size={16}>
            rock lip
          </Label>
          <Label x={X(sg * (dLip - 260))} y={Z(lipZ) - 26} show={tarn} size={22} colour={C.foam}>
            Tarn
          </Label>
        </g>
      ))}
      <Tag x={12} y={12} text="Cross-section through a mountain ridge" />
    </Frame>
  );
}

// ------------------------------------------------------------------ glacial troughs, truncated spurs, hanging valleys

export function TroughsSpursHanging({ t, time }: SceneProps) {
  const g = ease(ramp(t, 0.3, 0.7));
  const prof = troughProfile(g, 80);
  const ice = ramp(t, 0.16, 0.26) * (1 - ramp(t, 0.68, 0.74));
  const iceZ = iceSurface(Math.max(0.3, g));
  const X = (x: number) => 250 + x * (210 / VALLEY_HALF_WIDTH_M);
  const Z = (z: number) => 440 - z * 0.42;
  const floorZ = Math.min(...prof.map((q) => q.z));
  const river = ramp(t, 0.72, 0.78);
  // Plan view (right): valley from top to bottom.
  const px = 730;
  const py0 = 70;
  const py1 = 520;
  const trunc = ease(ramp(t, 0.42, 0.62));
  const wind = 1 - trunc;
  const half = 70;
  const rx = (y: number) => px + 40 * wind * Math.sin((2 * Math.PI * (y - py0)) / 150);
  const spurs = [0, 1, 2, 3, 4, 5].map((k) => {
    const y = py0 + 37 + 75 * k;
    const west = k % 2 === 0;
    const tipX = west ? lerp(rx(y) - 18, px - half, trunc) : lerp(rx(y) + 18, px + half, trunc);
    const baseX = west ? px - 200 : px + 200;
    return { y, west, tipX, baseX };
  });
  const lake = ramp(t, 0.86, 0.94);
  const hv = ramp(t, 0.84, 0.9);
  return (
    <Frame title="A glacial trough with truncated spurs, a hanging valley and a ribbon lake">
      {/* Section */}
      <rect x={10} y={50} width={480} height={470} rx={12} fill="#ffffffa8" />
      <path
        d={poly([...prof.map((q) => [X(q.x), Z(q.z)] as P), [X(VALLEY_HALF_WIDTH_M), VH - 30], [X(-VALLEY_HALF_WIDTH_M), VH - 30]], true)}
        fill={C.hard}
        stroke={C.ink}
        strokeWidth={2}
      />
      {ice > 0 && (
        <path
          d={poly(
            [
              ...prof.filter((q) => q.z < iceZ).map((q) => [X(q.x), Z(q.z)] as P),
              ...[[X(zCross(prof, iceZ, 1)), Z(iceZ)] as P, [X(zCross(prof, iceZ, -1)), Z(iceZ)] as P],
            ],
            true,
          )}
          fill={iceFill}
          stroke={C.iceEdge}
          strokeWidth={2}
          opacity={ice}
        />
      )}
      {river > 0 && <ellipse cx={X(0)} cy={Z(floorZ) - 3} rx={10} ry={4} fill={C.river} opacity={river} />}
      <path
        d={poly(troughProfile(0, 60).map((q) => [X(q.x), Z(q.z)] as P))}
        stroke="#16211b"
        strokeWidth={2}
        strokeDasharray="7 6"
        fill="none"
        opacity={ramp(t, 0.4, 0.45)}
      />
      <Label x={250} y={85} size={18}>
        Cross-section across the valley
      </Label>
      <Label x={250} y={Z(VALLEY_DEPTH_M) - 26} size={20} show={1 - ramp(t, 0.16, 0.2)}>
        V-shaped river valley
      </Label>
      <Label x={250} y={Z(iceZ) - 16} size={20} show={ice} colour={C.blue}>
        Glacier
      </Label>
      <Arrow a={[X(-500), Z(floorZ + 260)]} b={[X(-640), Z(floorZ + 140)]} colour={C.orange} width={4} show={ramp(t, 0.36, 0.4) * (1 - ramp(t, 0.66, 0.7))} />
      <Arrow a={[X(0), Z(floorZ + 180)]} b={[X(0), Z(floorZ + 40)]} colour={C.orange} width={4} show={ramp(t, 0.36, 0.4) * (1 - ramp(t, 0.66, 0.7))} />
      <Label x={250} y={Z(floorZ) + 50} size={16} colour={C.orange} show={ramp(t, 0.36, 0.4) * (1 - ramp(t, 0.66, 0.7))}>
        abrasion + plucking: deeper and wider
      </Label>
      <Label x={250} y={Z(VALLEY_DEPTH_M) - 26} size={22} show={ramp(t, 0.72, 0.76)}>
        U-shaped glacial trough
      </Label>
      <Label x={X(0) + 30} y={Z(floorZ) - 34} size={15} anchor="start" show={river}>
        misfit river
      </Label>
      {/* Plan */}
      <rect x={510} y={50} width={440} height={470} rx={12} fill="#cfe0c4" />
      <rect x={px - half} y={py0} width={2 * half} height={py1 - py0} fill="#dfe8c6" opacity={trunc} />
      {spurs.map((s, k) => (
        <path
          key={k}
          d={
            smooth([
              [s.baseX, s.y - 40],
              [lerp(s.baseX, s.tipX, 0.6), s.y - 26],
              [s.tipX, s.y],
              [lerp(s.baseX, s.tipX, 0.6), s.y + 26],
              [s.baseX, s.y + 40],
            ]) + 'Z'
          }
          fill={C.grassDark}
          stroke="#3f6b2c"
          strokeWidth={1.5}
        />
      ))}
      <rect x={510} y={50} width={px - half - 150 - 510} height={470} fill={C.grassDark} />
      <rect x={px + half + 150} y={50} width={950 - px - half - 150} height={470} fill={C.grassDark} />
      {trunc > 0.3 &&
        spurs.map((s, k) => (
          <path
            key={`c${k}`}
            d={poly([
              [s.tipX, s.y - 24],
              [s.tipX, s.y + 24],
            ])}
            stroke="#6b4a2b"
            strokeWidth={6}
            opacity={trunc}
          />
        ))}
      {ice > 0 && <rect x={px - half} y={py0} width={2 * half} height={py1 - py0} fill={iceFill} stroke={C.iceEdge} opacity={ice * 0.9} />}
      <FlowLine
        pts={[
          [px, py0 + 10],
          [px, py1 - 10],
        ]}
        time={time}
        show={ice}
      />
      {/* River (before and after the ice) */}
      <path d={smooth(curve(py0, py1, rx, 80).map(([y, x]) => [x, y] as P))} stroke={C.river} strokeWidth={6} fill="none" opacity={1 - ice} />
      {/* Hanging valley from the east */}
      <path
        d={poly(
          [
            [px + half, 190],
            [940, 150],
            [940, 230],
            [px + half, 215],
          ],
          true,
        )}
        fill="#dfe8c6"
        stroke="#3f6b2c"
        opacity={0.9}
      />
      <path
        d={poly([
          [940, 192],
          [px + half + 4, 202],
        ])}
        stroke={C.river}
        strokeWidth={4}
        opacity={hv}
      />
      {hv > 0 && <rect x={px + half - 8} y={196} width={14} height={14} fill="#ffffff" stroke={C.river} strokeWidth={2} opacity={hv} />}
      {/* Tributary glacier: thinner ice, so it eroded its valley floor less deeply */}
      <path
        d={poly(
          [
            [px + half, 192],
            [940, 160],
            [940, 222],
            [px + half, 212],
          ],
          true,
        )}
        fill={iceFill}
        stroke={C.iceEdge}
        opacity={ice * 0.9}
      />
      <Label x={880} y={136} size={14} show={ice * ramp(t, 0.3, 0.35)}>
        tributary glacier (thinner ice)
      </Label>
      {/* Ribbon lake */}
      <ellipse cx={px} cy={400} rx={34} ry={100 * lake} fill={C.river} opacity={lake} />
      <Label x={730} y={40} size={16}>
        Map view · ice flows down the page
      </Label>
      <Label x={px - half - 70} y={spurs[2].y + 6} to={[spurs[2].tipX, spurs[2].y]} anchor="end" size={18} show={ramp(t, 0.58, 0.62)}>
        Truncated spur
      </Label>
      <Label x={px} y={64} size={16} show={1 - ramp(t, 0.3, 0.35)}>
        river winding round interlocking spurs
      </Label>
      <Label x={880} y={140} size={18} show={hv}>
        Hanging valley
      </Label>
      <Label x={px + half + 90} y={232} to={[px + half, 203]} size={15} show={hv} anchor="start">
        waterfall
      </Label>
      <Label x={px} y={512} size={18} show={lake} colour={C.foam}>
        Ribbon lake
      </Label>
      <Tag x={12} y={12} text="e.g. Nant Ffrancon (Snowdonia), Wastwater (ribbon lake)" />
    </Frame>
  );
}

/** x where the profile crosses height z on side `sg` (for drawing the ice surface edge). */
function zCross(prof: { x: number; z: number }[], z: number, sg: number): number {
  const side = prof.filter((q) => Math.sign(q.x) === sg || q.x === 0).sort((a, b) => Math.abs(a.x) - Math.abs(b.x));
  for (let k = 1; k < side.length; k++)
    if (side[k].z >= z) {
      const a = side[k - 1];
      const b = side[k];
      return lerp(a.x, b.x, (z - a.z) / (b.z - a.z || 1));
    }
  return sg * VALLEY_HALF_WIDTH_M;
}

// ------------------------------------------------------------------ roche moutonnée (side view)

export function RocheMoutonnee({ t, time }: SceneProps) {
  const ground = 420;
  const abr = ease(ramp(t, 0.22, 0.6));
  const plk = ease(ramp(t, 0.45, 0.78));
  const ice = 1 - ramp(t, 0.76, 0.84);
  const xc = 480;
  // Before: a rounded knob. After: long smooth stoss (left), steep stepped lee (right).
  const before = (x: number) => ground - 150 * Math.exp(-(((x - xc) / 120) ** 2));
  const stoss = (x: number) => ground - 150 * clamp((x - (xc - 300)) / 300) ** 1.4;
  const shape = (x: number) => {
    if (x <= xc) return lerp(before(x), Math.min(before(x) + 6, x < xc - 300 ? ground : stoss(x)), abr);
    const steps = [xc, xc + 25, xc + 45, xc + 80, xc + 100, xc + 140];
    const hs = [270, 300, 310, 350, 360, 420];
    let lee = ground;
    for (let k = 0; k < steps.length - 1; k++) if (x >= steps[k] && x < steps[k + 1]) lee = hs[k] + (x - steps[k]) * 0.15;
    if (x >= xc + 140) lee = ground;
    return lerp(before(x), Math.max(before(x), lee), plk);
  };
  const rock = curve(0, VW, shape, 240);
  const iceTop = 120 + 30 * (1 - ice);
  const blocks = [0, 1, 2].map((k) => {
    const u = ((time * 0.18 + k / 3) % 1) * plk;
    return { x: xc + 60 + k * 30 + u * 360, y: 330 + k * 22 - u * 20, o: plk > 0.05 ? 1 - u : 0 };
  });
  return (
    <Frame title="A roche moutonnée: smoothed by abrasion, plucked on the lee side">
      <path d={poly([...rock, [VW, VH], [0, VH]], true)} fill={C.hard} stroke={C.ink} strokeWidth={2} />
      <path d={poly([...rock, [VW, VH], [0, VH]], true)} fill="url(#lf-strata)" />
      {/* Striations on the stoss side */}
      {abr > 0.2 &&
        [0, 1, 2, 3].map((k) => (
          <path
            key={k}
            d={poly([
              [xc - 240 + k * 50, shape(xc - 240 + k * 50) + 8],
              [xc - 200 + k * 50, shape(xc - 200 + k * 50) + 8],
            ])}
            stroke="#ffffffaa"
            strokeWidth={2}
            opacity={abr}
          />
        ))}
      {ice > 0 && (
        <g opacity={ice}>
          <path d={poly([[0, iceTop], [VW, iceTop + 40], ...rock.slice().reverse()], true)} fill={iceFill} stroke={C.iceEdge} strokeWidth={2} opacity={0.88} />
          <FlowLine
            pts={[
              [40, iceTop + 50],
              [VW - 40, iceTop + 90],
            ]}
            time={time}
          />
          <FlowLine
            pts={[
              [40, iceTop + 110],
              [VW - 40, iceTop + 150],
            ]}
            time={time}
          />
          {/* Debris at the base of the ice scraping the stoss side */}
          {[0, 1, 2, 3].map((k) => {
            const x = ((time * 40 + k * 120) % 520) + 40;
            return x < xc ? <circle key={k} cx={x} cy={shape(x) - 6} r={6} fill={C.hardDark} /> : null;
          })}
          {blocks.map((b, k) => (
            <rect key={k} x={b.x} y={b.y} width={18} height={14} fill={C.hardDark} stroke={C.ink} opacity={b.o} transform={`rotate(${k * 20} ${b.x} ${b.y})`} />
          ))}
        </g>
      )}
      <Label x={160} y={iceTop + 26} colour={C.blue} show={ice} anchor="start">
        Ice flow →
      </Label>
      <Label x={xc - 250} y={ground + 60} to={[xc - 150, shape(xc - 150) + 2]} show={ramp(t, 0.22, 0.26)} anchor="end">
        Stoss side: abrasion smooths it
      </Label>
      <Label x={xc + 280} y={ground + 60} to={[xc + 70, shape(xc + 70) + 4]} show={ramp(t, 0.48, 0.52)} anchor="start">
        Lee side: plucking makes it jagged
      </Label>
      <Label x={xc + 200} y={250} show={ramp(t, 0.5, 0.54) * ice} size={16} anchor="start">
        meltwater refreezes, blocks pulled away
      </Label>
      <Label x={xc - 30} y={220} size={28} show={ramp(t, 0.8, 0.86)}>
        Roche moutonnée
      </Label>
      <Label x={xc - 30} y={248} size={15} show={ramp(t, 0.84, 0.9)}>
        e.g. in the Lake District and Snowdonia valleys
      </Label>
      <Label x={xc - 200} y={shape(xc - 200) - 18} size={15} show={ramp(t, 0.84, 0.9)}>
        striations
      </Label>
      <Tag x={12} y={12} text="Side view · ice flows to the right" />
    </Frame>
  );
}

// ------------------------------------------------------------------ ground and terminal moraines (long profile)

export function Moraines({ t, time }: SceneProps) {
  const floor = (x: number) => 250 + x * 0.24;
  const snout = t < 0.42 ? lerp(320, 700, ease(ramp(t, 0, 0.42))) : t < 0.76 ? 700 : lerp(700, 330, ease(ramp(t, 0.76, 0.98)));
  const ground = ease(ramp(t, 0.2, 0.75));
  const term = ease(ramp(t, 0.45, 0.76));
  const gm = (x: number) => (x < 690 ? ground * (10 + 7 * Math.sin(x / 23) + 5 * hash(Math.floor(x / 30))) : 0);
  const tm = (x: number) => term * 48 * Math.exp(-(((x - 715) / (x < 715 ? 22 : 34)) ** 2));
  const surface = (x: number) => floor(x) - gm(x) - tm(x);
  const H = 130;
  const iceTopAt = (x: number) => (x >= snout ? NaN : surface(x) - H * Math.sqrt(clamp((snout - x) / snout)) - 8);
  const iceTop = curve(0, snout, (x) => iceTopAt(Math.min(x, snout - 0.01)), 80);
  const lake = ramp(t, 0.9, 0.98);
  // Debris: on the surface (from rockfall), within and beneath the ice, moving towards the snout.
  const debris = Array.from({ length: 14 }, (_, k) => {
    const u = (time * 0.05 + hash(k)) % 1;
    const x = u * snout;
    const depth = k % 3; // 0 on, 1 in, 2 under
    const top = iceTopAt(x);
    const y = depth === 0 ? top + 4 : depth === 1 ? lerp(top, surface(x), 0.55) : surface(x) - 6;
    return Number.isNaN(top) ? null : <circle key={k} cx={x} cy={y} r={depth === 2 ? 5 : 6} fill={C.hardDark} stroke={C.ink} strokeWidth={1} />;
  });
  return (
    <Frame title="Ground moraine and a terminal moraine left by a glacier">
      <path d={poly([[0, 120], ...curve(0, 160, (x) => 120 + x * 0.2, 10), [160, floor(160)], [0, floor(0)]], true)} fill={C.hard} opacity={0} />
      {/* Bedrock and moraine */}
      <path d={poly([...curve(0, VW, floor, 120), [VW, VH], [0, VH]], true)} fill={C.hard} stroke={C.ink} strokeWidth={2} />
      <path d={poly([...curve(0, VW, surface, 240), ...curve(VW, 0, floor, 120)], true)} fill={C.till} stroke={C.tillDark} strokeWidth={1.5} />
      <path d={poly([...curve(0, VW, surface, 240), ...curve(VW, 0, floor, 120)], true)} fill="url(#lf-pebbles)" />
      {lake > 0 && (
        <path
          d={poly(
            [
              ...curve(640, 700, (x) => Math.max(surface(x), surface(700) - 22 * lake), 20).filter((q) => q[1] > surface(700) - 22 * lake),
              [700, surface(700) - 22 * lake],
              [640, surface(700) - 22 * lake],
            ],
            true,
          )}
          fill={C.river}
          opacity={lake}
        />
      )}
      {/* Glacier */}
      <path
        d={
          smooth([[0, iceTopAt(0)], ...iceTop.slice(1), [snout, surface(snout) - 2]]) +
          `L${snout},${surface(snout)}` +
          poly(curve(snout, 0, surface, 60)).replace('M', 'L') +
          'Z'
        }
        fill={iceFill}
        stroke={C.iceEdge}
        strokeWidth={2}
      />
      {debris}
      <FlowLine
        pts={[
          [30, iceTopAt(30) + 40],
          [snout - 40, iceTopAt(snout - 40) + 20],
        ]}
        time={time}
      />
      {/* Rockfall onto the ice */}
      {[0, 1].map((k) => {
        const u = (time * 0.4 + k * 0.5) % 1;
        return <rect key={k} x={60 + k * 50} y={lerp(40, iceTopAt(60 + k * 50), u)} width={10} height={9} fill={C.hardDark} opacity={1 - ramp(t, 0.76, 0.8)} />;
      })}
      <Label x={130} y={70} size={16} show={1 - ramp(t, 0.76, 0.8)}>
        freeze-thaw rockfall
      </Label>
      <Label x={snout / 2} y={iceTopAt(snout / 2) - 20} colour={C.blue} show={ramp(t, 0, 0.04) * (1 - ramp(t, 0.9, 0.94))}>
        Glacier →
      </Label>
      <Arrow
        a={[snout - 70, surface(snout) - 30]}
        b={[snout + 6, surface(snout) - 14]}
        colour={C.orange}
        width={4}
        show={ramp(t, 0.05, 0.1) * (1 - ramp(t, 0.42, 0.45))}
      />
      <Label x={snout - 40} y={surface(snout) - 60} anchor="end" size={15} show={ramp(t, 0.05, 0.1) * (1 - ramp(t, 0.42, 0.45))}>
        advancing snout bulldozes debris
      </Label>
      <Label x={VW - 20} y={110} anchor="end" show={ramp(t, 0.45, 0.5) * (1 - ramp(t, 0.76, 0.8))}>
        snout stays still (melting = forward flow): debris dumped
      </Label>
      <Label x={330} y={floor(330) + 80} to={[330, surface(330) + 4]} show={ramp(t, 0.24, 0.3)} anchor="start">
        Ground moraine
      </Label>
      <Label x={760} y={surface(715) - 80} to={[716, surface(716) + 2]} size={24} show={ramp(t, 0.62, 0.66)}>
        Terminal moraine
      </Label>
      <Label x={560} y={surface(560) - 70} size={16} show={ramp(t, 0.85, 0.9)}>
        marks the furthest advance of the ice
      </Label>
      <Label x={760} y={surface(715) + 80} size={14} show={ramp(t, 0.66, 0.7)}>
        till: unsorted mix of clay and angular rocks
      </Label>
      <Label x={VW / 2} y={VH - 16} size={14} show={ramp(t, 0.9, 0.95)}>
        e.g. Cwm Idwal, Snowdonia
      </Label>
      <Tag x={12} y={12} text="Long profile down the valley · ice flows to the right" />
    </Frame>
  );
}

// ------------------------------------------------------------------ crag and tail (side view)

export function CragTail({ t, time }: SceneProps) {
  const top0 = 300;
  const erode = ease(ramp(t, 0.2, 0.68)) * 120;
  const till = ease(ramp(t, 0.45, 0.72));
  const ice = 1 - ramp(t, 0.7, 0.78);
  const cragX0 = 300;
  const cragX1 = 380;
  const tailEnd = cragX1 + 380;
  const soft = (x: number) => {
    if (x < cragX0) return top0 + erode * (1 + 0.15 * Math.exp(-(((x - cragX0 + 40) / 50) ** 2)));
    if (x <= cragX1) return top0 - 50;
    const s = clamp(1 - (x - cragX1) / (tailEnd - cragX1));
    return top0 + erode * (1 - Math.pow(s, 0.6));
  };
  const tillT = (x: number) => (x > cragX1 && x < tailEnd ? till * 10 * Math.sin((Math.PI * (x - cragX1)) / (tailEnd - cragX1)) : 0);
  const surf = curve(0, VW, (x) => soft(x) - tillT(x), 240);
  const cragTop = top0 - 50 - 30 * ramp(t, 0, 0.01);
  const iceTop = 110;
  return (
    <Frame title="A crag and tail: a hard crag protecting a tail of softer rock">
      <path d={poly([...curve(0, VW, soft, 240), [VW, VH], [0, VH]], true)} fill={C.soft} stroke={C.softDark} strokeWidth={1.5} />
      <path d={poly([...curve(0, VW, soft, 240), [VW, VH], [0, VH]], true)} fill="url(#lf-strata)" />
      {/* Volcanic plug */}
      <path
        d={poly(
          [
            [cragX0 - 10, VH],
            [cragX0, cragTop + 12],
            [cragX0 + 20, cragTop],
            [cragX1, cragTop + 6],
            [cragX1 + 6, VH],
          ],
          true,
        )}
        fill={C.volcanic}
        stroke={C.ink}
        strokeWidth={2}
      />
      {/* Till on the tail */}
      <path d={poly([...curve(cragX1, tailEnd, (x) => soft(x) - tillT(x), 40), ...curve(tailEnd, cragX1, soft, 40)], true)} fill={C.till} opacity={till} />
      <path d={poly(curve(0, VW, () => top0, 2))} stroke="#16211b" strokeWidth={2} strokeDasharray="7 6" opacity={ramp(t, 0.3, 0.35)} />
      <Label x={20} y={top0 - 10} anchor="start" size={15} show={ramp(t, 0.3, 0.35)}>
        ground level before the ice
      </Label>
      {ice > 0 && (
        <g opacity={ice}>
          <path d={poly([[0, iceTop], [VW, iceTop + 30], ...surf.slice().reverse()], true)} fill={iceFill} stroke={C.iceEdge} strokeWidth={2} opacity={0.85} />
          <FlowLine
            pts={[
              [40, iceTop + 50],
              [VW - 40, iceTop + 80],
            ]}
            time={time}
          />
          <FlowLine
            pts={[
              [40, iceTop + 100],
              [cragX0 - 30, iceTop + 120],
              [cragX1 + 60, cragTop - 30],
              [VW - 40, iceTop + 160],
            ]}
            time={time}
          />
        </g>
      )}
      <Arrow a={[120, soft(120) - 70]} b={[180, soft(180) - 8]} show={ramp(t, 0.2, 0.25) * ice} />
      <Label x={110} y={soft(110) - 84} colour={C.orange} show={ramp(t, 0.2, 0.25) * ice} anchor="start" size={17}>
        soft rock eroded
      </Label>
      <Label x={cragX0 - 30} y={cragTop - 26} anchor="end" show={1}>
        {ramp(t, 0.7, 0.75) > 0 ? 'Crag (hard volcanic rock)' : 'Hard volcanic plug'}
      </Label>
      <Label x={cragX1 + 200} y={soft(cragX1 + 200) - 40} show={ramp(t, 0.45, 0.5)} anchor="start" size={17}>
        sheltered behind the crag
      </Label>
      <Label x={cragX1 + 230} y={soft(cragX1 + 230) + 70} to={[cragX1 + 230, soft(cragX1 + 230) + 6]} size={24} show={ramp(t, 0.72, 0.76)}>
        Tail
      </Label>
      {/* Edinburgh analogue */}
      <g opacity={ramp(t, 0.8, 0.88)}>
        <path
          d={poly(
            [
              [cragX0 + 14, cragTop],
              [cragX0 + 14, cragTop - 30],
              [cragX0 + 24, cragTop - 30],
              [cragX0 + 24, cragTop - 40],
              [cragX0 + 34, cragTop - 40],
              [cragX0 + 34, cragTop - 26],
              [cragX0 + 58, cragTop - 26],
              [cragX0 + 58, cragTop],
            ],
            true,
          )}
          fill="#5c5650"
        />
        <Label x={cragX0 + 40} y={cragTop - 60} size={16}>
          e.g. Edinburgh Castle Rock
        </Label>
        <Label x={cragX1 + 200} y={soft(cragX1 + 200) + 120} size={15}>
          the Royal Mile runs down the tail
        </Label>
      </g>
      <Label x={130} y={iceTop + 28} colour={C.blue} show={ice}>
        Ice flow →
      </Label>
      <Tag x={12} y={12} text="Side view · ice flows to the right" />
    </Frame>
  );
}

// ------------------------------------------------------------------ drumlins (side view + map)

export function Drumlins({ t, time }: SceneProps) {
  const ground = 300;
  const dep = ease(ramp(t, 0.22, 0.45));
  const mould = ease(ramp(t, 0.45, 0.7));
  const ice = 1 - ramp(t, 0.68, 0.75);
  const x0 = 300;
  const L = 380;
  const lump = (u: number) => 70 * Math.exp(-(((u - 0.45) / 0.22) ** 2)) * (1 + 0.15 * Math.sin(u * 30));
  const drum = (u: number) => 80 * (u < 0.22 ? Math.sin((u / 0.22) * (Math.PI / 2)) ** 0.7 : Math.cos(((u - 0.22) / 0.78) * (Math.PI / 2)) ** 1.6);
  const h = (x: number) => {
    const u = (x - x0) / L;
    if (u < 0 || u > 1) return 0;
    return dep * lerp(lump(u), drum(u), mould);
  };
  const surf = curve(0, VW, (x) => ground - h(x), 200);
  const map = ramp(t, 0.72, 0.8);
  const eggs: { x: number; y: number; s: number }[] = [];
  for (let k = 0; k < 14; k++)
    eggs.push({ x: 130 + (k % 5) * 160 + 50 * hash(k), y: 380 + Math.floor(k / 5) * 52 + 16 * hash(k + 9), s: 0.8 + 0.4 * hash(k + 2) });
  const egg = (cx: number, cy: number, s: number) =>
    smooth(
      Array.from({ length: 24 }, (_, k) => {
        const a = (2 * Math.PI * k) / 24;
        const r = Math.cos(a) < 0 ? 1.0 : 1.0 + 0.9 * Math.cos(a); // blunt up-ice (left), tapered down-ice (right)
        return [cx + 30 * s * r * Math.cos(a), cy + 13 * s * Math.sin(a)] as P;
      }),
      true,
    );
  return (
    <Frame title="Drumlins: till moulded into streamlined hills by moving ice">
      <rect x={0} y={ground} width={VW} height={VH - ground} fill={C.hard} />
      <path d={poly([...surf, [VW, ground + 2], [0, ground + 2]], true)} fill={C.till} stroke={C.tillDark} strokeWidth={1.5} />
      <path d={poly([...surf, [VW, ground + 2], [0, ground + 2]], true)} fill="url(#lf-pebbles)" />
      <rect x={0} y={ground} width={VW} height={6} fill={C.grass} opacity={1 - ice} />
      {ice > 0 && (
        <g opacity={ice}>
          <path d={poly([[0, 70], [VW, 100], ...surf.slice().reverse()], true)} fill={iceFill} stroke={C.iceEdge} strokeWidth={2} opacity={0.85} />
          <FlowLine
            pts={[
              [40, 120],
              [VW - 40, 150],
            ]}
            time={time}
          />
          <FlowLine
            pts={[
              [40, 200],
              [x0, 210],
              [x0 + L * 0.3, ground - 110],
              [VW - 40, 230],
            ]}
            time={time}
          />
          {Array.from({ length: 8 }, (_, k) => {
            const x = ((time * 50 + k * 110) % 880) + 40;
            return <circle key={k} cx={x} cy={ground - h(x) - 12 - 20 * hash(k)} r={4 + 2 * hash(k + 1)} fill={C.tillDark} />;
          })}
        </g>
      )}
      <Label x={140} y={110} colour={C.blue} show={ice}>
        Ice flow →
      </Label>
      <Label x={140} y={250} show={ramp(t, 0, 0.04) * (1 - ramp(t, 0.22, 0.26)) * ice} size={17}>
        ice loaded with till
      </Label>
      <Label x={x0 + L * 0.45} y={ground - 110} show={ramp(t, 0.24, 0.28) * (1 - ramp(t, 0.45, 0.5))} size={17}>
        friction: till is dropped
      </Label>
      <Label x={x0 + L * 0.5} y={ground - 120} show={ramp(t, 0.48, 0.52) * ice} size={17}>
        moving ice moulds it
      </Label>
      <Label x={x0 - 20} y={ground - 100} to={[x0 + 30, ground - h(x0 + 30)]} anchor="end" show={ramp(t, 0.66, 0.7)} size={18}>
        Blunt, steep end (stoss) faces the ice
      </Label>
      <Label x={x0 + L + 30} y={ground - 70} to={[x0 + L * 0.75, ground - h(x0 + L * 0.75)]} anchor="start" show={ramp(t, 0.66, 0.7)} size={18}>
        Tapered end points down-ice
      </Label>
      <Label x={x0 + L * 0.35} y={ground - 150} size={28} show={ramp(t, 0.72, 0.76)}>
        Drumlin
      </Label>
      {/* Drumlin field (map) */}
      <g opacity={map}>
        <rect x={20} y={330} width={VW - 40} height={196} rx={10} fill="#cfe0c4" stroke="#3f6b2c" />
        {eggs.map((e, k) => (
          <path key={k} d={egg(e.x, e.y, e.s)} fill={C.grassDark} stroke="#3f6b2c" strokeWidth={1.5} />
        ))}
        <Arrow a={[40, 350]} b={[150, 350]} colour={C.blue} width={4} />
        <Label x={VW / 2} y={352} size={16}>
          Map view: a drumlin field (“basket of eggs”) — all point the way the ice moved
        </Label>
        <Label x={VW / 2} y={520} size={14}>
          e.g. the Ribble Valley, Lancashire, and the Vale of Eden, Cumbria
        </Label>
      </g>
      <Tag x={12} y={12} text="Side view · ice flows to the right" />
    </Frame>
  );
}
