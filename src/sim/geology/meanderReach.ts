import type { WorldState } from '../../engine/world';
import { LandscapeEvolution } from './landscapeEvolution';
import { createMeander, defaultMeanderParams, type MeanderState } from './meander';

/**
 * Pick the lower course of a world's main river for the meandering-river model (M13-C05b): the
 * largest river reaching the sea or an open map edge, followed upstream while its valley stays
 * gentle (floodplain gradient under MAX_GRADIENT) and it carries a large share of the mouth's flow.
 * Meanders need a floodplain of river sediment to swing across: the reach is accepted only if most
 * of the ground along it has at least a channel depth of loose sediment (else banks are rock or thin
 * soil and the river would barely move — the reason is returned so the UI can say what to do).
 */
export const MAX_GRADIENT = 0.003;
const MIN_WIDTHS = 30;

export type MeanderReach = { ok: true; meander: MeanderState; lengthM: number; gradient: number; alluviumShare: number } | { ok: false; reason: string };

export function findMeanderReach(w: WorldState): MeanderReach {
  const W = w.width;
  const H = w.height;
  const n = W * H;
  const cs = w.cellSizeM;
  const geo = new LandscapeEvolution(w);
  geo.route();
  const z = (i: number) => w.bedrockElevationM[i] + w.looseSedimentThicknessM[i];
  // The mouth: the land cell with the largest drainage area that drains to base level.
  let mouth = -1;
  for (let i = 0; i < n; i++) {
    const r = geo.receiver[i];
    if (r < 0 || geo.receiver[r] >= 0 || z(i) < w.seaLevelM) continue;
    if (mouth < 0 || geo.area[i] > geo.area[mouth]) mouth = i;
  }
  if (mouth < 0) return { ok: false, reason: 'No river reaches the sea or an open map edge on this world.' };
  // Donor with the largest area for each cell (the main stem upstream).
  const up = new Int32Array(n).fill(-1);
  for (let i = 0; i < n; i++) {
    const r = geo.receiver[i];
    if (r >= 0 && (up[r] < 0 || geo.area[i] > geo.area[up[r]])) up[r] = i;
  }
  const path: number[] = [];
  for (let i = mouth; i >= 0 && geo.area[i] >= 0.1 * geo.area[mouth] && path.length < n; i = up[i]) path.push(i);
  // Floodplain level along the path (mouth first): the ground, never rising downstream.
  const zs = path.map((i) => z(i));
  for (let k = zs.length - 2; k >= 0; k--) zs[k] = Math.min(zs[k], zs[k + 1]);
  const params = defaultMeanderParams();
  params.widthM = Math.max(2.5 * cs, 40);
  params.supplyM3Yr = 0; // its load is what the landscape upstream on this map delivers
  const window = Math.max(3, Math.round((10 * params.widthM) / cs));
  const dist = (a: number, b: number) => Math.hypot((path[a] % W) - (path[b] % W), ((path[a] / W) | 0) - ((path[b] / W) | 0)) * cs;
  let end = 0; // last gentle cell (inclusive), going upstream
  for (let k = 0; k < path.length; k++) {
    const a = Math.max(0, k - window);
    const b = Math.min(path.length - 1, k + window);
    let L = 0;
    for (let q = a + 1; q <= b; q++) L += dist(q - 1, q);
    const g = L > 0 ? (zs[b] - zs[a]) / L : 0;
    if (g > MAX_GRADIENT) break;
    end = k;
  }
  let lengthM = 0;
  for (let q = 1; q <= end; q++) lengthM += dist(q - 1, q);
  if (lengthM < MIN_WIDTHS * params.widthM)
    return {
      ok: false,
      reason: `The main river has no lower course gentle enough for meanders (needs at least ${((MIN_WIDTHS * params.widthM) / 1000).toFixed(1)} km sloping less than 1 in ${Math.round(1 / MAX_GRADIENT)}; this one has ${(lengthM / 1000).toFixed(1)} km).`,
    };
  // Floodplain sediment along the reach: loose sediment at least a channel depth thick within two widths.
  let thick = 0;
  let cells = 0;
  const rad = Math.ceil((2 * params.widthM) / cs);
  for (let k = 0; k <= end; k++) {
    const x0 = path[k] % W;
    const y0 = (path[k] / W) | 0;
    for (let dy = -rad; dy <= rad; dy++)
      for (let dx = -rad; dx <= rad; dx++) {
        const x = x0 + dx;
        const y = y0 + dy;
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        cells++;
        if (w.looseSedimentThicknessM[y * W + x] >= params.depthM) thick++;
      }
  }
  const alluviumShare = thick / Math.max(1, cells);
  if (alluviumShare < 0.5)
    return {
      ok: false,
      reason: `The lower course has too little river sediment to meander across (${Math.round(alluviumShare * 100)} % of its floodplain has ${params.depthM} m or more). Run geological time with river deposition on to build a floodplain first.`,
    };
  // Centreline from inlet to mouth, smoothed over ~3 widths (removes the 8-direction zigzag, keeps the valley's bends).
  const reach = path.slice(0, end + 1).reverse();
  const vz = zs.slice(0, end + 1).reverse();
  const px = reach.map((i) => (i % W) * cs);
  const py = reach.map((i) => ((i / W) | 0) * cs);
  const sm = Math.max(1, Math.round((1.5 * params.widthM) / cs));
  const smooth = (a: number[]) => a.map((_, k) => (k === 0 || k === a.length - 1 ? a[k] : avg(a, k, sm)));
  const vx = smooth(px);
  const vy = smooth(py);
  const xs: number[] = [];
  const ys: number[] = [];
  const step = 0.4 * params.widthM;
  for (let k = 1; k < vx.length; k++) {
    const d = Math.hypot(vx[k] - vx[k - 1], vy[k] - vy[k - 1]);
    const parts = Math.max(1, Math.round(d / step));
    for (let q = k === 1 ? 0 : 1; q <= parts; q++) {
      xs.push(vx[k - 1] + ((vx[k] - vx[k - 1]) * q) / parts);
      ys.push(vy[k - 1] + ((vy[k] - vy[k - 1]) * q) / parts);
    }
  }
  // Real channels are never perfectly smooth: a small wiggle (±0.3 widths, ~12 widths long, the scale at
  // which bends grow fastest; Ikeda et al. 1981) is the starting irregularity bends grow from — as in
  // the meanders lesson. It tapers to nothing at the inlet and mouth.
  const N = xs.length;
  let arc = 0;
  const total = (N - 1) * step;
  for (let k = 1; k < N - 1; k++) {
    arc += Math.hypot(xs[k] - xs[k - 1], ys[k] - ys[k - 1]);
    const tx = xs[k + 1] - xs[k - 1];
    const ty = ys[k + 1] - ys[k - 1];
    const L = Math.hypot(tx, ty) || 1;
    const taper = Math.min(1, arc / (8 * params.widthM), (total - arc) / (8 * params.widthM));
    const off = 0.3 * params.widthM * taper * (Math.sin((arc * 2 * Math.PI) / (12 * params.widthM)) + 0.4 * Math.sin((arc * 2 * Math.PI) / (7.3 * params.widthM) + 1.7));
    xs[k] += (-ty / L) * off;
    ys[k] += (tx / L) * off;
  }
  const m = createMeander(xs, ys, vz[0], vz[vz.length - 1], params);
  m.vx = vx;
  m.vy = vy;
  m.vz = vz;
  m.onMap = true;
  m.pendingM3 = 0;
  return { ok: true, meander: m, lengthM, gradient: (vz[0] - vz[vz.length - 1]) / Math.max(1, lengthM), alluviumShare };
}

function avg(a: number[], k: number, r: number): number {
  let s = 0;
  let c = 0;
  for (let q = Math.max(0, k - r); q <= Math.min(a.length - 1, k + r); q++) (s += a[q]), c++;
  return s / c;
}
