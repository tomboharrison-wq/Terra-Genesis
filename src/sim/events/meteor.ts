import { refreshExposed, type WorldState } from '../../engine/world';
import type { CellRect } from '../../utils/rect';

/**
 * Meteor impact (spec E12). Crater size from the pi-scaling laws as used by the Earth Impact Effects
 * Program (Collins, Melosh & Marcus 2005):
 *   transient diameter  D_tc = 1.161 (ρi/ρt)^⅓ L^0.78 v^0.44 g^−0.22 sin^⅓θ   (SI units)
 *   simple crater       D = 1.25 D_tc                         (D < 3.2 km on Earth)
 *   complex crater      D = 1.17 D_tc^1.13 / D_c^0.13,  D_c = 3.2 km
 * Depth (rim crest to floor): simple d = 0.196 D (Pike 1977); complex d = 0.4 D^0.3 (km).
 *
 * Shape on the map: a paraboloid bowl cut below the pre-impact ground (a plane at the mean height of
 * the crater area), so it works on slopes. Everything removed is thrown out as an ejecta blanket of
 * loose broken rock whose thickness falls off as (R/r)³ beyond the rim (McGetchin et al. 1973); the
 * blanket's own pile at the rim makes the raised rim. Volume is conserved exactly: removed = ejecta on
 * the map + ejecta thrown beyond the map edge (reported). Simplifications (stated in the UI): vertical
 * profile only (no central peak or terraces in complex craters), no bulking of broken rock, no melt,
 * no atmospheric break-up; the impact angle only scales the size.
 */
export interface ImpactOptions {
  xM: number;
  yM: number;
  /** Impactor diameter (m). */
  diameterM: number;
  /** Impact speed (m/s); typical asteroid ≈ 17 km/s. */
  speedMS: number;
  /** Impactor density (kg/m³): stony ≈ 3000, iron ≈ 7800, comet ice ≈ 1000. */
  densityKgM3: number;
  /** Angle from the horizontal (degrees); 45° is the most likely. */
  angleDeg: number;
}

export const TARGET_DENSITY = 2500;
const G = 9.81;
const D_COMPLEX = 3200;

export interface CraterSize {
  transientM: number;
  diameterM: number;
  /** Rim crest to floor (m). */
  depthM: number;
  complex: boolean;
  /** Kinetic energy (J) and in megatonnes of TNT. */
  energyJ: number;
  megatons: number;
}

export function craterSize(o: Pick<ImpactOptions, 'diameterM' | 'speedMS' | 'densityKgM3' | 'angleDeg'>): CraterSize {
  const s = Math.sin((Math.max(5, Math.min(90, o.angleDeg)) * Math.PI) / 180);
  const Dtc = 1.161 * Math.cbrt(o.densityKgM3 / TARGET_DENSITY) * o.diameterM ** 0.78 * o.speedMS ** 0.44 * G ** -0.22 * Math.cbrt(s);
  let D = 1.25 * Dtc;
  let complex = false;
  if (D > D_COMPLEX) {
    D = (1.17 * Dtc ** 1.13) / D_COMPLEX ** 0.13;
    complex = true;
  }
  const depthM = complex ? 0.4 * (D / 1000) ** 0.3 * 1000 : 0.196 * D;
  const energyJ = 0.5 * o.densityKgM3 * (Math.PI / 6) * o.diameterM ** 3 * o.speedMS ** 2;
  return { transientM: Dtc, diameterM: D, depthM, complex, energyJ, megatons: energyJ / 4.184e15 };
}

export interface ImpactResult extends CraterSize {
  rect: CellRect;
  /** Rock and soil dug out of the crater (m³). */
  excavatedM3: number;
  /** Ejecta landing on the map (m³) and thrown beyond its edge (m³). excavated = onMap + offMap. */
  ejectaOnMapM3: number;
  ejectaOffMapM3: number;
  /** Highest rim above the pre-impact ground (m). */
  rimM: number;
}

/**
 * Dig the crater and lay the ejecta. `beforeModify` is called once with the whole map (undo capture).
 * Bowl depth below the pre-impact ground = d / 1.25: the ejecta pile at the rim (a quarter of the bowl
 * depth for a paraboloid with (R/r)³ ejecta) supplies the rest of the rim-to-floor depth.
 */
export function impact(w: WorldState, surface: Float32Array, o: ImpactOptions, beforeModify?: (r: CellRect) => void): ImpactResult {
  const W = w.width;
  const H = w.height;
  const cs = w.cellSizeM;
  const A = cs * cs;
  const size = craterSize(o);
  const R = size.diameterM / 2;
  const bowl = size.depthM / 1.25;
  const cx = o.xM / cs;
  const cy = o.yM / cs;
  const Rc = R / cs;
  beforeModify?.({ x0: 0, y0: 0, x1: W, y1: H });
  const b = w.bedrockElevationM;
  const loose = w.looseSedimentThicknessM;
  const dist = (i: number) => Math.hypot((i % W) - cx, Math.floor(i / W) - cy);

  // Pre-impact ground: mean surface over the crater area (the centre cell if the crater is sub-cell).
  let zs = 0;
  let nz = 0;
  for (let i = 0; i < W * H; i++)
    if (dist(i) < Math.max(Rc, 0.71)) {
      zs += surface[i];
      nz++;
    }
  const zRef = nz > 0 ? zs / nz : surface[Math.min(H - 1, Math.max(0, Math.round(cy))) * W + Math.min(W - 1, Math.max(0, Math.round(cx)))];

  // 1. Excavate: cut every cell above the bowl down to it (loose sediment first, then bedrock).
  let excavated = 0;
  for (let i = 0; i < W * H; i++) {
    const r = dist(i);
    if (r >= Rc) continue;
    const target = zRef - bowl * (1 - (r / Rc) ** 2);
    const cut = surface[i] - target;
    if (cut <= 0) continue;
    const fromLoose = Math.min(loose[i], cut);
    const nl = Math.fround(loose[i] - fromLoose);
    excavated += loose[i] - nl;
    loose[i] = nl;
    const nb = Math.fround(Math.min(b[i], target));
    excavated += b[i] - nb;
    b[i] = nb;
    refreshExposed(w, i);
    surface[i] = b[i] + loose[i];
    w.vegCover[i] = 0;
  }
  excavated *= A;

  // 2. Ejecta: thickness k (R/r)³ for r ≥ R, k chosen so the whole (infinite) blanket holds the
  // excavated volume: ∫_R^∞ k (R/r)³ 2πr dr = 2π k R². What lands beyond the map edge is reported.
  const k = R > 0 ? excavated / (2 * Math.PI * R * R) : 0;
  let onMap = 0;
  let rim = 0;
  let x0 = W;
  let y0 = H;
  let x1 = 0;
  let y1 = 0;
  for (let i = 0; i < W * H; i++) {
    const r = dist(i) * cs;
    const x = i % W;
    const y = Math.floor(i / W);
    const t = r < R ? 0 : k * (R / r) ** 3;
    if (r >= R && t < 1e-4) continue;
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x + 1);
    y1 = Math.max(y1, y + 1);
    if (r < R) continue;
    const nl = Math.fround(loose[i] + t);
    const added = nl - loose[i];
    onMap += added;
    loose[i] = nl;
    surface[i] = b[i] + loose[i];
    rim = Math.max(rim, added);
    if (added > 0.5) w.vegCover[i] = 0; // buried
  }
  onMap *= A;
  return {
    ...size,
    rect: x1 > x0 ? { x0, y0, x1, y1 } : { x0: 0, y0: 0, x1: 0, y1: 0 },
    excavatedM3: excavated,
    ejectaOnMapM3: onMap,
    ejectaOffMapM3: excavated - onMap,
    rimM: rim,
  };
}
