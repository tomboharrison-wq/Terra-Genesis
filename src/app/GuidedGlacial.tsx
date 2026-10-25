import { hangingHeight, iceSurface, ridgeAt, troughProfile, VALLEY_DEPTH_M, VALLEY_HALF_WIDTH_M, type Pt } from '../local/glacial/model';

/** Guided glaciation cross-sections for Education Mode (spec G1 mode 2). */
const W = 900;
const H = 560;

function Label({
  x,
  y,
  text,
  colour = '#ffe627',
  anchor = 'middle',
}: {
  x: number;
  y: number;
  text: string;
  colour?: string;
  anchor?: 'start' | 'middle' | 'end';
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

/** Valley cross-section: p 0 … 1 glacial stage (ice present from 0.15), p > 1 after the ice has melted. */
export function TroughView({ p, labels }: { p: number; labels: boolean }) {
  const g = Math.min(1, p);
  const melted = p > 1;
  const prof = troughProfile(g);
  const zMin = -0.36 * VALLEY_DEPTH_M;
  const X = (x: number) => 60 + ((x + VALLEY_HALF_WIDTH_M) / (2 * VALLEY_HALF_WIDTH_M)) * (W - 120);
  const Z = (z: number) => 70 + ((VALLEY_DEPTH_M + 60 - z) / (VALLEY_DEPTH_M + 60 - zMin + 40)) * (H - 140);
  const ground = prof.map((q: Pt) => `${X(q.x).toFixed(1)},${Z(q.z).toFixed(1)}`).join(' ');
  const floorZ = Math.min(...prof.map((q) => q.z));
  const ice = !melted && p >= 0.15;
  const iceTop = iceSurface(p);
  const icePoly = prof.filter((q) => q.z <= iceTop).map((q) => `${X(q.x).toFixed(1)},${Z(q.z).toFixed(1)}`);
  // Hanging valley: a tributary floor on the left wall, left high above the deepened main floor.
  const hangZ = floorZ + hangingHeight(g) + 0.02 * VALLEY_DEPTH_M;
  const hangX = -VALLEY_HALF_WIDTH_M * Math.pow((hangZ - floorZ) / (VALLEY_DEPTH_M - floorZ), 1 / (1 + g)) - 30;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="guided-svg" role="img" aria-label="Glacial valley cross-section">
      <rect x={0} y={0} width={W} height={H} fill="#cfe0ec" />
      <polygon points={`${ground} ${X(VALLEY_HALF_WIDTH_M)},${H} ${X(-VALLEY_HALF_WIDTH_M)},${H}`} fill="#8a8580" stroke="#2e2a27" strokeWidth={2} />
      {ice && icePoly.length > 2 && <polygon points={icePoly.join(' ')} fill="#e8f3fb" stroke="#7fb3d8" strokeWidth={2} opacity={0.95} />}
      {!ice && <path d={`M${X(-40)},${Z(floorZ + 4)}h${X(40) - X(-40)}`} stroke="#2a78d6" strokeWidth={6} strokeLinecap="round" />}
      {melted && (
        <>
          {/* Moraine left on the floor, and the hanging tributary with its waterfall. */}
          {[-260, 200, 330].map((x, k) => (
            <ellipse key={k} cx={X(x)} cy={Z(floorZ) - 4} rx={18 + 6 * k} ry={8} fill="#a7988a" stroke="#5d5853" />
          ))}
          <path d={`M${X(hangX - 260)},${Z(hangZ)}H${X(hangX)}`} stroke="#5d5853" strokeWidth={5} />
          <path d={`M${X(hangX - 260)},${Z(hangZ) - 3}H${X(hangX)}`} stroke="#2a78d6" strokeWidth={4} />
          <path d={`M${X(hangX)},${Z(hangZ)}V${Z(floorZ + 4)}`} stroke="#6da7ec" strokeWidth={3} strokeDasharray="6 4" />
        </>
      )}
      {labels && (
        <g>
          {p < 0.15 && <Label x={X(0)} y={Z(floorZ) + 40} text="V-shaped river valley" />}
          {ice && <Label x={X(0)} y={Z(iceTop) + 34} text="Glacier fills the valley" colour="#7fb3d8" />}
          {ice && g > 0.5 && <Label x={X(-VALLEY_HALF_WIDTH_M * 0.55)} y={Z(VALLEY_DEPTH_M * 0.35)} text="Plucking & abrasion" colour="#ff912a" anchor="end" />}
          {melted && <Label x={X(0)} y={Z(floorZ) + 40} text="U-shaped valley (glacial trough)" />}
          {melted && <Label x={X(0)} y={Z(floorZ) - 24} text="Misfit river" colour="#2a78d6" />}
          {melted && <Label x={X(hangX - 130)} y={Z(hangZ) - 16} text="Hanging valley" colour="#ffb4e5" />}
          {melted && <Label x={X(330)} y={Z(floorZ) - 56} text="Moraine" colour="#a7988a" />}
        </g>
      )}
      <text x={W - 20} y={H - 14} textAnchor="end" className="guided-small dark">
        Cross-section across the valley · {Math.round(((2 * VALLEY_HALF_WIDTH_M) / 1000) * 10) / 10} km wide
      </text>
    </svg>
  );
}

/** Ridge cross-section with corries eroding back from both sides; p > 1 = ice melted (tarns). */
export function RidgeView({ p, labels }: { p: number; labels: boolean }) {
  const r = ridgeAt(Math.min(1, p));
  const melted = p > 1;
  const X = (x: number) => 40 + ((x + 1500) / 3000) * (W - 80);
  const Z = (z: number) => 60 + ((760 - z) / 900) * (H - 120);
  const ground = r.profile.map((q) => `${X(q.x).toFixed(1)},${Z(q.z).toFixed(1)}`).join(' ');
  // Corrie hollows (lowest points each side) for ice / tarns.
  const left = r.profile.filter((q) => q.x < -r.crestWidthM / 2 && q.x > -1300);
  const right = r.profile.filter((q) => q.x > r.crestWidthM / 2 && q.x < 1300);
  const low = (side: Pt[]) => side.reduce((a, b) => (b.z < a.z ? b : a), side[0]);
  const hollows = [low(left), low(right)];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="guided-svg" role="img" aria-label="Corries and arête cross-section">
      <rect x={0} y={0} width={W} height={H} fill="#cfe0ec" />
      <polygon points={`${ground} ${X(1500)},${H} ${X(-1500)},${H}`} fill="#8a8580" stroke="#2e2a27" strokeWidth={2} />
      {hollows.map((h, k) => (
        <ellipse
          key={k}
          cx={X(h.x)}
          cy={Z(h.z) - (melted ? 2 : 30)}
          rx={melted ? 70 : 120}
          ry={melted ? 10 : 45}
          fill={melted ? '#2a78d6' : '#e8f3fb'}
          stroke={melted ? '#1a4f8f' : '#7fb3d8'}
          strokeWidth={2}
          opacity={0.9}
        />
      ))}
      {labels && (
        <g>
          {!melted && p < 0.2 && <Label x={X(0)} y={Z(700) - 20} text="Mountain ridge with snow hollows" />}
          {!melted && p >= 0.2 && <Label x={X(hollows[0].x)} y={Z(hollows[0].z) - 90} text="Corrie glacier (rotational movement)" colour="#7fb3d8" />}
          {!melted && p >= 0.2 && <Label x={X(hollows[1].x) + 20} y={Z(hollows[1].z) + 50} text="Back wall: plucking" colour="#ff912a" anchor="start" />}
          {r.arete && <Label x={X(0)} y={Z(r.profile[60].z) - 24} text="Arête (knife-edge ridge)" />}
          {!r.arete && p >= 0.2 && <Label x={X(0)} y={Z(r.profile[60].z) - 24} text={`Ridge ${Math.round(r.crestWidthM)} m wide`} />}
          {melted && <Label x={X(hollows[0].x)} y={Z(hollows[0].z) + 40} text="Tarn (corrie lake)" colour="#2a78d6" />}
          {melted && <Label x={X(hollows[1].x)} y={Z(hollows[1].z) + 40} text="Rock lip" colour="#a7988a" />}
        </g>
      )}
      <text x={W - 20} y={H - 14} textAnchor="end" className="guided-small dark">
        Cross-section through a ridge · 3 km across · three or more corries cutting back into one peak make a pyramidal peak
      </text>
    </svg>
  );
}
