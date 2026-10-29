import type { WorldState } from '../engine/world';
import { MATERIALS } from '../terrain/materials';
import { LandscapeEvolution } from '../sim/geology/landscapeEvolution';
import type { MeanderState } from '../sim/geology/meander';

/**
 * River landforms found in the simulated landscape (for geological-time lessons). Everything is
 * measured from the current terrain and its drainage (the same priority-flood routing the
 * landscape model uses); nothing is placed by hand.
 */
export interface RiverPath {
  /** Cells from the mouth upstream to the source, along the largest tributary at each confluence. */
  cells: number[];
  /** Distance upstream from the mouth (m) of each cell. */
  distM: number[];
  /** Ground height (m) of each cell. */
  z: number[];
  area: Float64Array;
}

const surf = (w: WorldState, i: number) => w.bedrockElevationM[i] + w.looseSedimentThicknessM[i];
export const cellXY = (w: WorldState, i: number) => ({ xM: (i % w.width) * w.cellSizeM, yM: ((i / w.width) | 0) * w.cellSizeM });

/** The main river: from the land outlet draining the most ground, upstream while ≥ minCells drain through. */
export function mainRiver(w: WorldState, minCells = 40): RiverPath {
  const geo = new LandscapeEvolution(w);
  geo.route();
  const W = w.width;
  const H = w.height;
  const n = W * H;
  const sea = w.seaLevelM;
  let mouth = -1;
  for (let i = 0; i < n; i++) {
    if (surf(w, i) < sea) continue;
    const r = geo.receiver[i];
    if ((r < 0 || surf(w, r) < sea) && (mouth < 0 || geo.area[i] > geo.area[mouth])) mouth = i;
  }
  const cells = [mouth];
  const distM = [0];
  const thr = minCells * w.cellSizeM * w.cellSizeM;
  let c = mouth;
  for (let guard = 0; guard < n; guard++) {
    const x = c % W;
    const y = (c / W) | 0;
    let best = -1;
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const xn = x + dx;
        const yn = y + dy;
        if ((dx === 0 && dy === 0) || xn < 0 || yn < 0 || xn >= W || yn >= H) continue;
        const j = yn * W + xn;
        if (geo.receiver[j] === c && (best < 0 || geo.area[j] > geo.area[best])) best = j;
      }
    if (best < 0 || geo.area[best] < thr) break;
    distM.push(distM[distM.length - 1] + Math.hypot((best % W) - x, ((best / W) | 0) - y) * w.cellSizeM);
    cells.push(best);
    c = best;
  }
  return { cells, distM, z: cells.map((i) => surf(w, i)), area: geo.area };
}

export interface Waterfall {
  /** Lip (top of the steep reach) and foot cells. */
  lip: number;
  foot: number;
  dropM: number;
  lengthM: number;
  /** Steepest single link (°). */
  steepestDeg: number;
  /** Rock at the lip, and the rock the river cuts below it. */
  lipRock: string;
  footRock: string;
  /** Distance of the lip upstream from the mouth (m). */
  distM: number;
}

/**
 * The waterfall: the largest drop of the main river within `windowM` of river length (a steep step in
 * the long profile, cut where the river crosses from hard rock onto softer rock; with `hardOnly` the
 * step must include hard rock, erodibility ≤ 0.3). Null when no drop reaches `minDropM`. Its top
 * (lip) and foot are the window ends.
 */
export function findWaterfall(w: WorldState, p: RiverPath, windowM = 300, minDropM = 15, hardOnly = false): Waterfall | null {
  let best = 0;
  let ba = -1;
  let bb = -1;
  let b = 0;
  const hard = (k: number) => (MATERIALS[w.materialId[p.cells[k]]]?.erodibility ?? 1) <= 0.3;
  for (let a = 0; a < p.cells.length; a++) {
    if (b < a) b = a;
    while (b + 1 < p.cells.length && p.distM[b + 1] - p.distM[a] <= windowM) b++;
    if (hardOnly) {
      let any = false;
      for (let k = a; k <= b && !any; k++) any = hard(k);
      if (!any) continue;
    }
    const drop = p.z[b] - p.z[a];
    if (drop > best) {
      best = drop;
      ba = a;
      bb = b;
    }
  }
  if (ba < 0 || best < minDropM) return null;
  let steep = 0;
  for (let k = ba + 1; k <= bb; k++) steep = Math.max(steep, (p.z[k] - p.z[k - 1]) / Math.max(1e-6, p.distM[k] - p.distM[k - 1]));
  // Lip: the top of the steepest part (first cell upstream where the slope eases).
  const lip = p.cells[bb];
  const foot = p.cells[ba];
  return {
    lip,
    foot,
    dropM: best,
    lengthM: p.distM[bb] - p.distM[ba],
    steepestDeg: (Math.atan(steep) * 180) / Math.PI,
    lipRock: MATERIALS[w.materialId[lip]]?.name ?? '?',
    footRock: MATERIALS[w.materialId[foot]]?.name ?? '?',
    distM: p.distM[bb],
  };
}

export interface CrossSection {
  /** Valley depth: lower of the two side crests above the river (m). */
  depthM: number;
  /** Width between the crests (m). */
  widthM: number;
  /** Mean valley-side slope (°), river to half the crest height on each side. */
  sideDeg: number;
  /** Valley floor width: ground within 2 m of the river height (m). */
  floorM: number;
}

/** Cross-valley profile at path index k, perpendicular to the river there (crests within reachM). */
export function crossSection(w: WorldState, p: RiverPath, k: number, reachM = 800): CrossSection {
  const W = w.width;
  const H = w.height;
  const cs = w.cellSizeM;
  const a = p.cells[Math.max(0, k - 3)];
  const b = p.cells[Math.min(p.cells.length - 1, k + 3)];
  let dx = (b % W) - (a % W);
  let dy = ((b / W) | 0) - ((a / W) | 0);
  const L = Math.hypot(dx, dy) || 1;
  dx /= L;
  dy /= L;
  const c = p.cells[k];
  const cx = c % W;
  const cy = (c / W) | 0;
  const z0 = surf(w, c);
  const sample = (sgn: number) => {
    const out: { d: number; z: number }[] = [];
    for (let d = cs; d <= reachM; d += cs * 0.5) {
      const x = Math.round(cx + (sgn * -dy * d) / cs);
      const y = Math.round(cy + (sgn * dx * d) / cs);
      if (x < 0 || y < 0 || x >= W || y >= H) break;
      out.push({ d, z: surf(w, y * W + x) });
    }
    return out;
  };
  const side = (sgn: number) => {
    const s = sample(sgn);
    let crest = z0;
    let crestD = 0;
    let floor = 0;
    let onFloor = true;
    for (const { d, z } of s) {
      if (onFloor && z - z0 <= 2) floor = d;
      else onFloor = false;
      if (z > crest) {
        crest = z;
        crestD = d;
      }
    }
    // Valley-side slope: river to where the side reaches half the crest height.
    const half = z0 + (crest - z0) / 2;
    const h = s.find((q) => q.z >= half);
    const slope = h ? Math.atan((h.z - z0) / h.d) : 0;
    return { crest, crestD, floor, slope };
  };
  const l = side(1);
  const r = side(-1);
  const depth = Math.min(l.crest, r.crest) - z0;
  const sideDeg = ((l.slope + r.slope) * 90) / Math.PI;
  return { depthM: Math.max(0, depth), widthM: l.crestD + r.crestD, sideDeg, floorM: l.floor + r.floor };
}

export interface Spur {
  cell: number;
  /** Index along the river path of the bend. */
  k: number;
  /** Which bank the spur comes from (1 = left looking downstream, −1 = right). */
  side: 1 | -1;
  heightM: number;
}

/**
 * Interlocking spurs: where the river bends, the high ground on the inside of the bend projects
 * into the valley. A bend is a local extreme of the river's offset from the straight line between
 * points `halfCells` either side; a spur is the inside ground ≥ minRiseM above the river there.
 */
export function findSpurs(w: WorldState, p: RiverPath, from: number, to: number, halfCells = 6, minRiseM = 15): Spur[] {
  const W = w.width;
  const H = w.height;
  const off: number[] = [];
  const xy = (k: number) => [p.cells[k] % W, (p.cells[k] / W) | 0];
  for (let k = 0; k < p.cells.length; k++) {
    if (k < halfCells || k + halfCells >= p.cells.length) {
      off.push(0);
      continue;
    }
    const [ax, ay] = xy(k - halfCells);
    const [bx, by] = xy(k + halfCells);
    const [x, y] = xy(k);
    const L = Math.hypot(bx - ax, by - ay) || 1;
    off.push(((bx - ax) * (y - ay) - (by - ay) * (x - ax)) / L); // signed distance from the chord (cells)
  }
  const spurs: Spur[] = [];
  for (let k = Math.max(from, halfCells + 1); k < Math.min(to, p.cells.length - halfCells - 1); k++) {
    const o = off[k];
    if (Math.abs(o) < 1.2 || Math.abs(o) < Math.abs(off[k - 1]) || Math.abs(o) < Math.abs(off[k + 1])) continue;
    // Inside of the bend: from the river towards the chord, 2–4 cells.
    const [ax, ay] = xy(k - halfCells);
    const [bx, by] = xy(k + halfCells);
    const [x, y] = xy(k);
    const mx = (ax + bx) / 2 - x;
    const my = (ay + by) / 2 - y;
    const m = Math.hypot(mx, my) || 1;
    let top = -Infinity;
    let topCell = -1;
    for (let d = 2; d <= 5; d++) {
      const xi = Math.round(x + (mx / m) * d);
      const yi = Math.round(y + (my / m) * d);
      if (xi < 0 || yi < 0 || xi >= W || yi >= H) continue;
      const z = surf(w, yi * W + xi);
      if (z > top) {
        top = z;
        topCell = yi * W + xi;
      }
    }
    const rise = top - p.z[k];
    if (topCell >= 0 && rise >= minRiseM && !spurs.some((s) => Math.abs(s.k - k) < 3)) spurs.push({ cell: topCell, k, side: o > 0 ? 1 : -1, heightM: rise });
  }
  return spurs;
}

// ---------------- lowland river (meanders) ----------------

export interface Bend {
  /** Centreline node at the bend apex. */
  k: number;
  /** Dimensionless curvature W/Rc there. */
  curvature: number;
  /** Outer bank (river cliff) and inner bank (slip-off slope) points (m). */
  outer: { xM: number; yM: number };
  inner: { xM: number; yM: number };
}

/** Meander bends: apexes of the centreline (local maxima of |curvature| above 0.25, i.e. Rc < 4 widths). */
export function meanderBends(m: MeanderState): Bend[] {
  const N = m.xs.length;
  const W = m.params.widthM;
  const C = new Float64Array(N);
  for (let k = 3; k < N - 3; k++) {
    const t1 = Math.atan2(m.ys[k] - m.ys[k - 3], m.xs[k] - m.xs[k - 3]);
    const t2 = Math.atan2(m.ys[k + 3] - m.ys[k], m.xs[k + 3] - m.xs[k]);
    let d = t2 - t1;
    if (d > Math.PI) d -= 2 * Math.PI;
    if (d < -Math.PI) d += 2 * Math.PI;
    const ds = Math.hypot(m.xs[k + 3] - m.xs[k - 3], m.ys[k + 3] - m.ys[k - 3]) / 2 || 1;
    C[k] = (d / ds) * W;
  }
  const out: Bend[] = [];
  for (let k = 4; k < N - 4; k++) {
    const c = C[k];
    if (Math.abs(c) < 0.25 || Math.abs(c) < Math.abs(C[k - 1]) || Math.abs(c) < Math.abs(C[k + 1])) continue;
    if (out.length && k - out[out.length - 1].k < 6) continue;
    const tx = m.xs[k + 1] - m.xs[k - 1];
    const ty = m.ys[k + 1] - m.ys[k - 1];
    const L = Math.hypot(tx, ty) || 1;
    const nx = -ty / L;
    const ny = tx / L; // left normal; c > 0 turns left, so the outside of the bend is on the right
    const s = Math.sign(c);
    const d = W * 0.5 + 30;
    out.push({
      k,
      curvature: c,
      outer: { xM: m.xs[k] - nx * s * d, yM: m.ys[k] - ny * s * d },
      inner: { xM: m.xs[k] + nx * s * (d + 20), yM: m.ys[k] + ny * s * (d + 20) },
    });
  }
  return out;
}

const cellAt = (w: WorldState, xM: number, yM: number) => {
  const x = Math.max(0, Math.min(w.width - 1, Math.round(xM / w.cellSizeM)));
  const y = Math.max(0, Math.min(w.height - 1, Math.round(yM / w.cellSizeM)));
  return y * w.width + x;
};
export const heightAt = (w: WorldState, xM: number, yM: number) => surf(w, cellAt(w, xM, yM));

/** Bank height above the channel bed (m) at a bank point next to node k. */
export function bankHeight(w: WorldState, m: MeanderState, k: number, bank: { xM: number; yM: number }): number {
  return heightAt(w, bank.xM, bank.yM) - heightAt(w, m.xs[k], m.ys[k]);
}

/**
 * Levees: the ground beside the channel compared with the floodplain `awayM` further out, on straight
 * reaches between bends (in bends the inner bank is a low point bar instead), both banks; the median (m).
 */
export function leveeHeight(w: WorldState, m: MeanderState, awayM = 700): { heightM: number; at: { xM: number; yM: number } } {
  const W = m.params.widthM;
  const mask = new Set(m.mask);
  const hs: { h: number; at: { xM: number; yM: number } }[] = [];
  for (let k = 6; k < m.xs.length - 6; k += 3) {
    const t1 = Math.atan2(m.ys[k] - m.ys[k - 4], m.xs[k] - m.xs[k - 4]);
    const t2 = Math.atan2(m.ys[k + 4] - m.ys[k], m.xs[k + 4] - m.xs[k]);
    let dth = Math.abs(t2 - t1);
    if (dth > Math.PI) dth = 2 * Math.PI - dth;
    if (dth > 0.15) continue; // a bend
    const tx = m.xs[k + 1] - m.xs[k - 1];
    const ty = m.ys[k + 1] - m.ys[k - 1];
    const L = Math.hypot(tx, ty) || 1;
    for (const sg of [1, -1]) {
      const nx = (-ty / L) * sg;
      const ny = (tx / L) * sg;
      const near = { xM: m.xs[k] + nx * (W * 0.5 + 25), yM: m.ys[k] + ny * (W * 0.5 + 25) };
      const far = { xM: m.xs[k] + nx * awayM, yM: m.ys[k] + ny * awayM };
      if (mask.has(cellAt(w, far.xM, far.yM)) || mask.has(cellAt(w, near.xM, near.yM))) continue;
      const h = heightAt(w, near.xM, near.yM) - heightAt(w, far.xM, far.yM);
      if (Math.abs(h) > 8) continue; // a valley side, not floodplain
      hs.push({ h, at: near });
    }
  }
  if (!hs.length) return { heightM: 0, at: { xM: m.xs[0], yM: m.ys[0] } };
  hs.sort((p, q) => p.h - q.h);
  const med = hs[Math.floor(hs.length / 2)];
  return { heightM: med.h, at: med.at };
}
