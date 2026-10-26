import type { ReactNode } from 'react';

/**
 * Drawing kit for the Landform Show: one 960 × 540 SVG frame per formation, natural colours for the
 * ground, Scouts colours only for annotation (arrows, highlights), large haloed labels for projection.
 */
export const VW = 960;
export const VH = 540;

export const C = {
  sky: '#cfe3f0',
  skyTop: '#a9cbe6',
  sea: '#3f7fc0',
  seaLight: '#7fb2df',
  seaDeep: '#2b5f97',
  foam: '#f4f9ff',
  river: '#3d86d6',
  sand: '#e6d29a',
  shingle: '#b6aa94',
  mud: '#a58d63',
  silt: '#c4ad7c',
  saltmarsh: '#8fae6a',
  grass: '#86b35e',
  grassDark: '#5f8f42',
  hard: '#7d7670',
  hardDark: '#4d4844',
  soft: '#c79f68',
  softDark: '#8a6a3f',
  chalk: '#e9e4d6',
  chalkDark: '#a8a190',
  ice: '#e8f4fb',
  iceEdge: '#9cc6e2',
  snow: '#ffffff',
  till: '#a69276',
  tillDark: '#6f5f4a',
  volcanic: '#4a4550',
  ink: '#16211b',
  // Scouts accents for process arrows and highlights
  blue: '#006ddf',
  orange: '#ff912a',
  red: '#ed3f23',
  yellow: '#ffe627',
  pink: '#ffb4e5',
  green: '#25b755',
  forest: '#205b41',
};

export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
/** Progress 0 … 1 of t through the window [a, b]. */
export const ramp = (t: number, a: number, b: number) => clamp((t - a) / (b - a));
export const ease = (u: number) => 0.5 - 0.5 * Math.cos(Math.PI * clamp(u));
export const lerp = (a: number, b: number, u: number) => a + (b - a) * u;

export type P = [number, number];

/** Polyline / polygon path through points. */
export const poly = (pts: P[], close = false) => pts.map((p, k) => `${k ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('') + (close ? 'Z' : '');

/** Smooth path through points (Catmull–Rom → cubic Bézier). */
export function smooth(pts: P[], close = false): string {
  if (pts.length < 3) return poly(pts, close);
  const n = pts.length;
  const at = (k: number) => (close ? pts[(k + n) % n] : pts[Math.min(n - 1, Math.max(0, k))]);
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  const last = close ? n : n - 1;
  for (let k = 0; k < last; k++) {
    const p0 = at(k - 1);
    const p1 = at(k);
    const p2 = at(k + 1);
    const p3 = at(k + 2);
    const c1: P = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: P = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d + (close ? 'Z' : '');
}

/** Sample y = f(x) for x0 … x1. */
export const curve = (x0: number, x1: number, f: (x: number) => number, n = 64): P[] =>
  Array.from({ length: n + 1 }, (_, k) => {
    const x = x0 + ((x1 - x0) * k) / n;
    return [x, f(x)] as P;
  });

/** Label with a dark halo; optional leader line to (tx, ty) ending in a dot. */
export function Label({
  x,
  y,
  children,
  to,
  anchor = 'middle',
  size = 20,
  colour = '#ffffff',
  show = 1,
}: {
  x: number;
  y: number;
  children: ReactNode;
  to?: P;
  anchor?: 'start' | 'middle' | 'end';
  size?: number;
  colour?: string;
  show?: number;
}) {
  if (show <= 0) return null;
  // Keep the text inside the frame (approximate width of bold sans text).
  const text = typeof children === 'string' ? children : Array.isArray(children) ? children.join('') : '';
  const w = text.length * size * 0.56;
  const left = anchor === 'start' ? x : anchor === 'end' ? x - w : x - w / 2;
  const shift = left < 8 ? 8 - left : left + w > VW - 8 ? VW - 8 - (left + w) : 0;
  x += shift;
  y = Math.min(VH - 10, Math.max(size + 4, y));
  return (
    <g opacity={clamp(show * 3)} className="lf-label">
      {to && (
        <>
          <line x1={x} y1={y + (to[1] > y ? 4 : -size * 0.75)} x2={to[0]} y2={to[1]} stroke="#16211b" strokeWidth={4} strokeLinecap="round" />
          <line x1={x} y1={y + (to[1] > y ? 4 : -size * 0.75)} x2={to[0]} y2={to[1]} stroke={C.yellow} strokeWidth={2} strokeLinecap="round" />
          <circle cx={to[0]} cy={to[1]} r={4.5} fill={C.yellow} stroke="#16211b" strokeWidth={1.5} />
        </>
      )}
      <text
        x={x}
        y={y}
        textAnchor={anchor}
        fontSize={size}
        fontWeight={700}
        fill={colour}
        stroke="#16211b"
        strokeWidth={size * 0.28}
        paintOrder="stroke"
        strokeLinejoin="round"
      >
        {children}
      </text>
    </g>
  );
}

/** Process arrow (Scouts colour) from a to b with an arrowhead; optional curved bend (perpendicular offset). */
export function Arrow({
  a,
  b,
  colour = C.orange,
  width = 5,
  bend = 0,
  show = 1,
  dash,
}: {
  a: P;
  b: P;
  colour?: string;
  width?: number;
  bend?: number;
  show?: number;
  dash?: string;
}) {
  if (show <= 0) return null;
  const mx = (a[0] + b[0]) / 2;
  const my = (a[1] + b[1]) / 2;
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  const cx = mx - (dy / len) * bend;
  const cy = my + (dx / len) * bend;
  // Head direction = tangent at the end of the quadratic curve.
  const tx = b[0] - cx;
  const ty = b[1] - cy;
  const tl = Math.hypot(tx, ty) || 1;
  const ux = tx / tl;
  const uy = ty / tl;
  const h = width * 3.2;
  const head: P[] = [
    [b[0], b[1]],
    [b[0] - ux * h - uy * h * 0.6, b[1] - uy * h + ux * h * 0.6],
    [b[0] - ux * h + uy * h * 0.6, b[1] - uy * h - ux * h * 0.6],
  ];
  const end: P = [b[0] - ux * h * 0.8, b[1] - uy * h * 0.8];
  const d = `M${a[0]},${a[1]} Q${cx},${cy} ${end[0]},${end[1]}`;
  return (
    <g opacity={clamp(show * 3)}>
      <path d={d} stroke="#16211b" strokeWidth={width + 3} fill="none" strokeLinecap="round" strokeDasharray={dash} />
      <path d={d} stroke={colour} strokeWidth={width} fill="none" strokeLinecap="round" strokeDasharray={dash} />
      <path d={poly(head, true)} fill={colour} stroke="#16211b" strokeWidth={1.5} strokeLinejoin="round" />
    </g>
  );
}

/** Wave crest lines moving in direction (dx, dy) — plan-view sea texture; `time` drives the motion. */
export function PlanWaves({
  x,
  y,
  w,
  h,
  time,
  gap = 34,
  colour = C.foam,
  opacity = 0.55,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  time: number;
  gap?: number;
  colour?: string;
  opacity?: number;
}) {
  const off = (time * 18) % gap;
  const lines: ReactNode[] = [];
  for (let yy = y + h - off; yy > y; yy -= gap) {
    const pts = curve(x, x + w, (xx) => yy + 3 * Math.sin(xx / 40 + yy / 25), 24);
    lines.push(<path key={yy} d={smooth(pts)} stroke={colour} strokeWidth={2} fill="none" opacity={opacity} />);
  }
  return <g>{lines}</g>;
}

/** Side-view sea surface with moving ripples between x0 and x1 at level y. */
export function SeaSurface({ x0, x1, y, time, amp = 4 }: { x0: number; x1: number; y: number; time: number; amp?: number }) {
  const pts = curve(x0, x1, (x) => y + amp * Math.sin(x / 22 - time * 2.2), 80);
  return <path d={smooth(pts)} stroke={C.foam} strokeWidth={3} fill="none" opacity={0.9} />;
}

/** Frame background: sky gradient (side views) or plain fill (map views). */
export function Frame({ children, map = false, title }: { children: ReactNode; map?: boolean; title: string }) {
  return (
    <svg viewBox={`0 0 ${VW} ${VH}`} className="lf-svg" role="img" aria-label={title}>
      <defs>
        <linearGradient id="lf-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={C.skyTop} />
          <stop offset="1" stopColor={C.sky} />
        </linearGradient>
        <linearGradient id="lf-sea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={C.seaLight} />
          <stop offset="1" stopColor={C.seaDeep} />
        </linearGradient>
        <linearGradient id="lf-ice" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#cfe6f4" />
        </linearGradient>
        <pattern id="lf-strata" width="40" height="14" patternUnits="userSpaceOnUse">
          <path d="M0 13 H40" stroke="#00000022" strokeWidth={1.5} />
        </pattern>
        <pattern id="lf-pebbles" width="16" height="12" patternUnits="userSpaceOnUse">
          <circle cx="4" cy="4" r="2.4" fill="#00000026" />
          <circle cx="12" cy="9" r="1.8" fill="#00000020" />
        </pattern>
        <pattern id="lf-dots" width="10" height="10" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1.2" fill="#0000002a" />
          <circle cx="7" cy="7" r="1" fill="#00000020" />
        </pattern>
      </defs>
      <rect x={0} y={0} width={VW} height={VH} fill={map ? '#cfe0c4' : 'url(#lf-sky)'} />
      {children}
    </svg>
  );
}

/** Small legend chip row (bottom left). */
export function Legend({ items, x = 16, y = VH - 16 }: { items: { colour: string; label: string; pattern?: string }[]; x?: number; y?: number }) {
  let cx = x;
  return (
    <g>
      {items.map((it) => {
        const w = 22 + it.label.length * 8.6;
        const g = (
          <g key={it.label} transform={`translate(${cx},${y - 18})`}>
            <rect x={-4} y={-4} width={w + 4} height={26} rx={6} fill="#ffffffd9" />
            <rect x={0} y={0} width={18} height={18} rx={3} fill={it.colour} stroke="#16211b" strokeWidth={1} />
            {it.pattern && <rect x={0} y={0} width={18} height={18} rx={3} fill={`url(#${it.pattern})`} />}
            <text x={24} y={14} fontSize={15} fill="#16211b" fontWeight={600}>
              {it.label}
            </text>
          </g>
        );
        cx += w + 10;
        return g;
      })}
    </g>
  );
}

/** Compass / flow tag in a corner. */
export function Tag({ x, y, text, anchor = 'start' }: { x: number; y: number; text: string; anchor?: 'start' | 'end' }) {
  const w = text.length * 8.4 + 16;
  return (
    <g transform={`translate(${anchor === 'end' ? x - w : x},${y})`}>
      <rect width={w} height={26} rx={13} fill="#16211bcc" />
      <text x={w / 2} y={18} textAnchor="middle" fontSize={15} fill="#fff" fontWeight={600}>
        {text}
      </text>
    </g>
  );
}

/** Deterministic pseudo-random 0 … 1 for decoration (stable between frames). */
export const hash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};
