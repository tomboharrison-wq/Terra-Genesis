import { refreshExposed, STRATA_BOUNDS, STRATA_NONE, type WorldState } from '../../engine/world';
import type { CellRect } from '../../utils/rect';
import { triggerLandslide } from '../slopes/landslide';

/**
 * Earthquake event (spec E9): a fault rupture with persistent surface deformation.
 *
 * Size from magnitude Mw (Wells & Coppersmith 1994, all slip types):
 *   surface rupture length  log10 L[km] = −3.22 + 0.69·Mw
 *   average displacement    log10 D[m]  = −4.80 + 0.69·Mw
 * Rupture: a straight fault through the epicentre along the strike, length L (clipped to the map),
 * slip tapering elliptically from the centre: s(u) = 1.27·D·√(1 − (2u/L)²) (mean over the rupture = D).
 * Deformation at distance d from the fault on side σ (hanging wall = the side the fault dips under):
 *   normal:   hanging wall −s·sin δ·e^(−d/w), footwall +0.25·s·sin δ·e^(−d/w)  (δ = 60°)
 *   reverse:  hanging wall +s·sin δ·e^(−d/w), footwall −0.25·s·sin δ·e^(−d/w)  (δ = 30°)
 *   strike-slip: one side shifted along the strike by round(s/cs) cells (columns moved; offsets
 *     below half a cell are reported as below map resolution, not drawn).
 *   w = 0.25·L. Strata move with the rock.
 * Shaking intensity (Modified-Mercalli-like, teaching approximation):
 *   I = 1.5·Mw − 3·log10(R + 5 km) + 3, R = distance to the rupture (km), clamped 1 … 12.
 * Landslides (optional): on cells with I ≥ 7 and slope > 30°, the existing landslide event runs with
 * weakening growing with I (strongest few sites).
 */
export type QuakeType = 'normal' | 'reverse' | 'strike-slip';

export interface QuakeOptions {
  xM: number;
  yM: number;
  mw: number;
  type: QuakeType;
  /** Fault trend, degrees clockwise from north. */
  strikeDeg: number;
  landslides: boolean;
}

export interface QuakeResult {
  rect: CellRect;
  ruptureKm: number;
  avgSlipM: number;
  maxUpM: number;
  maxDownM: number;
  lateralCells: number;
  landslides: number;
  shaking: Float32Array;
}

export function ruptureLengthKm(mw: number): number {
  return Math.pow(10, -3.22 + 0.69 * mw);
}
export function averageSlipM(mw: number): number {
  return Math.pow(10, -4.8 + 0.69 * mw);
}
export function intensityAt(mw: number, rKm: number): number {
  return Math.max(1, Math.min(12, 1.5 * mw - 3 * Math.log10(rKm + 5) + 3));
}

export function earthquake(w: WorldState, surface: Float32Array, o: QuakeOptions, beforeModify?: (r: CellRect) => void): QuakeResult {
  const W = w.width;
  const H = w.height;
  const cs = w.cellSizeM;
  const L = ruptureLengthKm(o.mw) * 1000;
  const D = averageSlipM(o.mw);
  const a = (o.strikeDeg * Math.PI) / 180;
  const tx = Math.sin(a); // strike direction (x east, y north)
  const ty = Math.cos(a);
  const nx = ty; // normal: hanging wall on the +n side
  const ny = -tx;
  const dip = ((o.type === 'reverse' ? 30 : 60) * Math.PI) / 180;
  const wDecay = 0.25 * L;
  const all: CellRect = { x0: 0, y0: 0, x1: W, y1: H };
  beforeModify?.(all);
  const b = w.bedrockElevationM;
  let maxUp = 0;
  let maxDown = 0;
  // Along-strike coordinate u and signed distance d of a cell centre from the fault.
  const coords = (i: number) => {
    const px = (i % W) * cs - o.xM;
    const py = Math.floor(i / W) * cs - o.yM;
    return { u: px * tx + py * ty, d: px * nx + py * ny };
  };
  const taper = (u: number) => {
    const q = 1 - (2 * u / L) ** 2;
    return q > 0 ? 1.27 * D * Math.sqrt(q) : 0;
  };
  let lateral = 0;
  if (o.type !== 'strike-slip') {
    const sign = o.type === 'normal' ? -1 : 1;
    for (let i = 0; i < W * H; i++) {
      const { u, d } = coords(i);
      const s = taper(u);
      if (s <= 0) continue;
      const v = d >= 0 ? sign * s * Math.sin(dip) * Math.exp(-d / wDecay) : -sign * 0.25 * s * Math.sin(dip) * Math.exp(d / wDecay);
      if (Math.abs(v) < 1e-4) continue;
      const nb = Math.fround(b[i] + v);
      const dz = nb - b[i];
      b[i] = nb;
      for (let k = 0; k < STRATA_BOUNDS; k++) {
        const ix = i * STRATA_BOUNDS + k;
        if (w.strataBoundsM[ix] !== STRATA_NONE) w.strataBoundsM[ix] += dz;
      }
      refreshExposed(w, i);
      surface[i] = b[i] + w.looseSedimentThicknessM[i];
      maxUp = Math.max(maxUp, dz);
      maxDown = Math.max(maxDown, -dz);
    }
  } else {
    // Shift the +n side along the strike by whole cells where the slip reaches them (moved columns).
    const cells = Math.round((1.27 * D) / cs);
    lateral = cells;
    if (cells > 0) {
      const src = {
        b: b.slice(),
        l: w.looseSedimentThicknessM.slice(),
        m: w.materialId.slice(),
        sb: w.strataBoundsM.slice(),
        sm: w.strataMaterial.slice(),
        wd: w.waterDepthM.slice(),
        sn: w.snowSweM.slice(),
        ic: w.iceThicknessM.slice(),
        vg: w.vegCover.slice(),
      };
      for (let i = 0; i < W * H; i++) {
        const { u, d } = coords(i);
        if (d < 0) continue;
        const n = Math.round(taper(u) / cs);
        if (n <= 0) continue;
        // Take the column n cells back along the strike (if on the map and on the same side).
        const sx = Math.round((i % W) - tx * n);
        const sy = Math.round(Math.floor(i / W) - ty * n);
        if (sx < 0 || sy < 0 || sx >= W || sy >= H) continue;
        const j = sy * W + sx;
        b[i] = src.b[j];
        w.looseSedimentThicknessM[i] = src.l[j];
        w.materialId[i] = src.m[j];
        for (let k = 0; k < STRATA_BOUNDS; k++) w.strataBoundsM[i * STRATA_BOUNDS + k] = src.sb[j * STRATA_BOUNDS + k];
        for (let k = 0; k < 4; k++) w.strataMaterial[i * 4 + k] = src.sm[j * 4 + k];
        w.waterDepthM[i] = src.wd[j];
        w.snowSweM[i] = src.sn[j];
        w.iceThicknessM[i] = src.ic[j];
        w.vegCover[i] = src.vg[j];
        surface[i] = b[i] + w.looseSedimentThicknessM[i];
      }
    }
  }
  // Shaking map: distance to the rupture segment.
  const shaking = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) {
    const { u, d } = coords(i);
    const along = Math.max(0, Math.abs(u) - L / 2);
    const r = Math.hypot(along, d) / 1000;
    shaking[i] = intensityAt(o.mw, r);
  }
  // Earthquake-triggered landslides on strongly shaken steep slopes.
  let slides = 0;
  if (o.landslides) {
    const sites: { i: number; I: number }[] = [];
    for (let y = 1; y < H - 1; y++)
      for (let x = 1; x < W - 1; x++) {
        const i = y * W + x;
        if (shaking[i] < 7) continue;
        const sx = (surface[i + 1] - surface[i - 1]) / (2 * cs);
        const sy = (surface[i + W] - surface[i - W]) / (2 * cs);
        if (Math.hypot(sx, sy) > Math.tan((30 * Math.PI) / 180)) sites.push({ i, I: shaking[i] });
      }
    sites.sort((p, q) => q.I - p.I);
    const chosen: number[] = [];
    const minSep = 8;
    for (const s of sites) {
      if (chosen.length >= 6) break;
      const x = s.i % W;
      const y = Math.floor(s.i / W);
      if (chosen.some((c) => Math.hypot((c % W) - x, Math.floor(c / W) - y) < minSep)) continue;
      chosen.push(s.i);
      const res = triggerLandslide(w, surface, { xM: x * cs, yM: y * cs, radiusM: 4 * cs, weakening: Math.max(0.3, 1 - (s.I - 6) * 0.15), iterations: 80 });
      if (res.failedRockM3 + res.movedM3 > 1) slides++;
    }
  }
  return { rect: all, ruptureKm: L / 1000, avgSlipM: D, maxUpM: maxUp, maxDownM: maxDown, lateralCells: lateral, landslides: slides, shaking };
}
