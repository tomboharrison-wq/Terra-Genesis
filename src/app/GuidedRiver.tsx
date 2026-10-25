import { waterfallGeometry, WATERFALL_DEFAULTS, type Pt as WPt } from '../local/waterfall/model';
import { bendSection, CHANNEL_WIDTH_M, meanderAt, type Pt as MPt } from '../local/meander/model';

/** Guided river models for Education Mode (spec G1 mode 2: controlled demonstrations, labelled as such). */

const W = 900;
const H = 560;

function Label({
  x,
  y,
  text,
  anchor = 'middle',
  colour = '#ffe627',
}: {
  x: number;
  y: number;
  text: string;
  anchor?: 'start' | 'middle' | 'end';
  colour?: string;
}) {
  return (
    <text
      x={x}
      y={y}
      textAnchor={anchor}
      className="guided-label"
      style={{
        fill: '#fff',
        stroke: '#0c1611',
        strokeWidth: 5,
        paintOrder: 'stroke',
      }}
    >
      <tspan style={{ fill: colour }}>■ </tspan>
      {text}
    </text>
  );
}

/** Waterfall long profile after `years`; `labels` toggles annotations, `answer` reveals hidden ones. */
export function WaterfallView({ years, labels }: { years: number; labels: boolean }) {
  const g = waterfallGeometry(years, WATERFALL_DEFAULTS, -120, 60);
  const s = g.state;
  const p = WATERFALL_DEFAULTS;
  // Fit x −120 … 60 m across the view; heights drawn ×3 (z −18 … 24 m) for legibility.
  const X = (x: number) => 40 + ((x + 120) / 180) * (W - 80);
  const sx = (W - 80) / 180;
  const Z = (z: number) => H - 60 - (z + 18) * ((H - 140) / 42);
  const poly = (pts: WPt[]) => pts.map((q) => `${X(q.x).toFixed(1)},${Z(q.z).toFixed(1)}`).join(' ');
  const line = (pts: WPt[]) => pts.map((q, k) => `${k ? 'L' : 'M'}${X(q.x).toFixed(1)},${Z(q.z).toFixed(1)}`).join('');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="guided-svg" role="img" aria-label={`Waterfall cross-section after ${Math.round(years)} years`}>
      <rect x={0} y={0} width={W} height={H} fill="#cfe0ec" />
      {/* Gorge walls behind the river: the old plateau surface either side of the stretch the fall has cut back through. */}
      {g.gorge && <rect x={X(g.gorge.x0)} y={Z(p.heightM)} width={X(g.gorge.x1) - X(g.gorge.x0)} height={Z(0) - Z(p.heightM)} fill="#9c8f7d" opacity={0.55} />}
      <polygon points={poly(g.soft)} fill="#b9a17e" stroke="#5a4632" strokeWidth={1.5} />
      <polygon points={poly(g.hard)} fill="#6b6560" stroke="#2e2a27" strokeWidth={2} />
      {s.blocks.map((b, k) => (
        <rect
          key={k}
          x={X(b.x) - (b.size * sx) / 2}
          y={Z(0) - b.size * sx * 1.1}
          width={b.size * sx}
          height={b.size * sx * 1.1}
          fill="#5d5853"
          stroke="#2e2a27"
          transform={`rotate(${((k * 23) % 40) - 20} ${X(b.x)} ${Z(0)})`}
        />
      ))}
      <path d={line(g.waterUp)} stroke="#2a78d6" strokeWidth={6} fill="none" />
      <path d={line(g.curtain)} stroke="#6da7ec" strokeWidth={9} fill="none" opacity={0.85} />
      <path d={line(g.waterDown)} stroke="#2a78d6" strokeWidth={6} fill="none" />
      {labels && (
        <g>
          <Label x={X(-95)} y={Z(p.heightM) - 30} text="Hard (resistant) rock" anchor="start" />
          <Label x={X(-95)} y={Z(4)} text="Soft (less resistant) rock" anchor="start" colour="#ffb4e5" />
          {s.overhangM > 1.5 && <Label x={X(s.lipX - s.overhangM / 2)} y={Z(p.heightM - p.capThicknessM) + 28} text={`Overhang ${s.overhangM.toFixed(1)} m`} />}
          {s.overhangM > 1.5 && <Label x={X(s.lipX - s.overhangM) - 10} y={Z(p.heightM * 0.45)} text="Undercutting" anchor="end" colour="#ff912a" />}
          <Label x={X(g.pool.x) + 40} y={Z(-s.poolDepthM) + 26} text={`Plunge pool ${s.poolDepthM.toFixed(0)} m deep`} anchor="start" colour="#2a78d6" />
          {s.blocks.length > 0 && <Label x={X(s.blocks[s.blocks.length - 1].x) + 30} y={Z(0) - 36} text="Collapsed rock" anchor="start" colour="#ed3f23" />}
          {g.gorge && (
            <>
              <path
                d={`M${X(g.gorge.x0)},${Z(p.heightM) - 12}h${X(g.gorge.x1) - X(g.gorge.x0)}`}
                stroke="#ffe627"
                strokeWidth={3}
                markerEnd="url(#arr)"
                markerStart="url(#arr)"
              />
              <Label x={(X(g.gorge.x0) + X(g.gorge.x1)) / 2} y={Z(p.heightM) - 22} text={`Gorge ${s.retreatM.toFixed(0)} m long`} />
            </>
          )}
          <path d={`M${X(-110)},${Z(p.heightM) + 30}h60`} stroke="#2a78d6" strokeWidth={3} markerEnd="url(#arrB)" />
          <text x={X(-110)} y={Z(p.heightM) + 50} className="guided-small">
            river flow
          </text>
        </g>
      )}
      <defs>
        <marker id="arr" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0,0L10,5L0,10z" fill="#ffe627" />
        </marker>
        <marker id="arrB" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0,0L10,5L0,10z" fill="#2a78d6" />
        </marker>
      </defs>
      <text x={W - 20} y={H - 16} textAnchor="end" className="guided-small dark">
        {Math.round(years)} years (illustrative) · {s.collapses} collapse
        {s.collapses === 1 ? '' : 's'} · retreated {s.retreatM.toFixed(0)} m · heights ×{((H - 140) / 42 / sx).toFixed(1)}
      </text>
    </svg>
  );
}

/** Meander plan view at stage parameter p (0 … 1 bends grow, 1 cutoff, 1 … 2 oxbow silts up). */
export function MeanderView({ p, labels, section }: { p: number; labels: boolean; section: boolean }) {
  const m = meanderAt(p);
  const all = [...m.channel, ...(m.oxbow ?? [])];
  const xs = all.map((q) => q.x);
  const ys = all.map((q) => q.y);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const y0 = Math.min(...ys);
  const y1 = Math.max(...ys);
  const sc = Math.min((W - 80) / (x1 - x0), (H - (section ? 250 : 130)) / Math.max(400, y1 - y0));
  const X = (x: number) => 40 + (x - x0) * sc;
  const top0 = section ? 70 : Math.max(70, (H - 40 - (y1 - y0) * sc) / 2);
  const Y = (y: number) => top0 + (y1 - y) * sc;
  const path = (pts: MPt[]) => pts.map((q, k) => `${k ? 'L' : 'M'}${X(q.x).toFixed(1)},${Y(q.y).toFixed(1)}`).join('');
  // Bend apices (outer banks) of the middle loop: points of extreme y.
  const mid = m.channel.slice(Math.round(m.channel.length * 0.3), Math.round(m.channel.length * 0.7));
  const top = mid.reduce((a, b) => (b.y > a.y ? b : a), mid[0]);
  const sec = bendSection();
  const SX = (x: number) => 60 + (x + 8) * 5.5;
  const SZ = (z: number) => H - 44 - (z + 3.5) * 14;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="guided-svg" role="img" aria-label="Meandering river, plan view">
      <rect x={0} y={0} width={W} height={H} fill="#b9c98f" />
      <rect x={0} y={Y(y1) - 20} width={W} height={Y(y0) - Y(y1) + 40} fill="#a7ba78" opacity={0.6} />
      {m.oxbow && (
        <path
          d={path(m.oxbow) + 'Z'}
          fill={m.oxbowInfill < 0.9 ? '#6da7ec' : 'none'}
          fillOpacity={1 - m.oxbowInfill}
          stroke={m.oxbowInfill > 0.5 ? '#7d8f4e' : '#2a78d6'}
          strokeWidth={CHANNEL_WIDTH_M * sc}
          strokeOpacity={m.oxbowInfill > 0.5 ? 0.9 : 0.85}
          strokeLinejoin="round"
        />
      )}
      <path d={path(m.channel)} stroke="#2a78d6" strokeWidth={Math.max(3, CHANNEL_WIDTH_M * sc)} fill="none" strokeLinejoin="round" strokeLinecap="round" />
      {labels && (
        <g>
          {!m.cutoff && (
            <>
              {/* One bend: its outer bank (river cliff) and its inner bank (slip-off slope, inside the loop). */}
              <circle cx={X(top.x)} cy={Y(top.y) - CHANNEL_WIDTH_M * sc * 0.5 - 4} r={6} fill="#ed3f23" stroke="#0c1611" strokeWidth={2} />
              <circle cx={X(top.x)} cy={Y(top.y) + CHANNEL_WIDTH_M * sc * 0.5 + 4} r={6} fill="#ffb4e5" stroke="#0c1611" strokeWidth={2} />
              <Label x={X(top.x)} y={Y(top.y) - CHANNEL_WIDTH_M * sc * 0.5 - 22} text="River cliff: outside of the bend (erosion)" colour="#ed3f23" />
              <path d={`M${X(top.x)},${Y(top.y) + CHANNEL_WIDTH_M * sc * 0.5 + 10}V${Y(top.y) + 70}`} stroke="#ffb4e5" strokeWidth={2} />
              <Label x={X(top.x)} y={Y(top.y) + 88} text="Slip-off slope: inside of the bend (deposition)" colour="#ffb4e5" />
              {p > 0.6 && m.neckA && m.neckB && (
                <>
                  <path d={`M${X(m.neckA.x)},${Y(m.neckA.y)}L${X(m.neckB.x)},${Y(m.neckB.y)}`} stroke="#ff912a" strokeWidth={3} strokeDasharray="5 4" />
                  <Label
                    x={(X(m.neckA.x) + X(m.neckB.x)) / 2}
                    y={(Y(m.neckA.y) + Y(m.neckB.y)) / 2 - 14}
                    text={`Neck ${m.neckM.toFixed(0)} m`}
                    colour="#ff912a"
                  />
                </>
              )}
            </>
          )}
          {m.oxbow && (
            <Label
              x={X(m.oxbow[Math.floor(m.oxbow.length / 2)].x)}
              y={Y(Math.min(...m.oxbow.map((q) => q.y))) + 40}
              text={m.oxbowInfill < 0.5 ? 'Oxbow lake' : 'Meander scar (silted-up oxbow)'}
              colour="#6da7ec"
            />
          )}
          {m.cutoff && (
            <Label x={X(m.oxbow![0].x)} y={Y(Math.max(...m.oxbow!.map((q) => q.y))) - 30} text="New straight course across the old neck" colour="#2a78d6" />
          )}
        </g>
      )}
      {section && (
        <g>
          <rect x={40} y={H - 190} width={360} height={170} fill="#f4f1ea" stroke="#3b2a1c" rx={8} />
          <path d={`M${SX(-8)},${SZ(sec.water)}H${SX(CHANNEL_WIDTH_M)}`} stroke="#6da7ec" strokeWidth={2} />
          <polygon
            points={[...sec.bed.map((q) => `${SX(q.x)},${SZ(q.z)}`), `${SX(CHANNEL_WIDTH_M + 8)},${SZ(-3.6)}`, `${SX(-8)},${SZ(-3.6)}`].join(' ')}
            fill="#b9a17e"
            stroke="#5a4632"
          />
          <text x={50} y={H - 170} className="guided-small dark" fontWeight={700}>
            Cross-section across a bend
          </text>
          <text x={390} y={H - 150} textAnchor="end" className="guided-small dark">
            outside: deep, fast → erosion
          </text>
          <text x={50} y={H - 26} className="guided-small dark">
            inside: shallow, slow → deposition
          </text>
          <circle cx={SX(sec.thalwegX)} cy={SZ(-2.4)} r={4} fill="#ed3f23" />
        </g>
      )}
      <text x={W - 20} y={H - 14} textAnchor="end" className="guided-small dark">
        Sinuosity {m.sinuosity.toFixed(2)} (channel length ÷ straight distance) · plan view
      </text>
    </svg>
  );
}
