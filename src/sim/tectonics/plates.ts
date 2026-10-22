import { refreshExposed, STRATA_BOUNDS, STRATA_NONE, type WorldState } from '../../engine/world';
import { Noise2D } from '../../utils/noise';
import { deriveSeed, mulberry32 } from '../../utils/rng';
import { settleSlopes } from '../../terrain/settle';

/**
 * Kinematic plate tectonics (spec E9 — no mantle solver). Rigid plates on the map, each with a
 * velocity; boundaries are classified from relative motion and deform the bedrock column (strata
 * move with it) on a slow cadence in accelerated tectonic time (yearsPerSimHour).
 *
 * At each boundary cell i (neighbour j on another plate, n = unit vector from i towards j):
 *   v_rel = v_j − v_i;  convergence c = −v_rel·n (> 0 approaching), transform t = |v_rel × n|.
 *   Type: convergent if c > 0.3·|v_rel|, divergent if c < −0.3·|v_rel|, else transform.
 * Vertical rates (m/yr) spread from the nearest boundary cell with a Gaussian of half-width w:
 *   convergent: uplift = upliftFactor · c · exp(−(d/w)²) on both sides — but where an oceanic plate
 *     meets a continental one the oceanic side sinks into a trench (−trenchFactor · c · …, narrower)
 *     and the continental side rises (a simple stand-in for subduction; detailed in M07-C03);
 *   divergent: subsidence = −riftFactor · |c| · exp(−(d/w_r)²) (a rift / spreading valley);
 *   transform: no vertical change (horizontal offset is M07-C02).
 *   w = beltWidthM (continental–continental ×1.5), w_r = 0.5·w.
 * Applied as exact float32 bedrock changes (strata boundaries shifted with the rock); the ledger
 * books uplifted and subsided volume. Rock pushed steeper than its lithology can stand then
 * collapses into talus (the generator's slope-settling rules, mass conserved) — so belts become
 * mountain ranges rather than walls. Plate fragments < 2 % of the map merge into a neighbour. Simplifications: plates do not move their outlines; no
 * isostasy, flexure, or thermal subsidence.
 */
export type PlateKind = 'continental' | 'oceanic';
export type BoundaryType = 0 | 1 | 2 | 3; // none, convergent, divergent, transform

export interface Plate {
  id: number;
  name: string;
  kind: PlateKind;
  /** Velocity (mm/yr), x east, y north. */
  vxMmYr: number;
  vyMmYr: number;
}

export interface TectonicsParams {
  enabled: boolean;
  plates: Plate[];
  /** Tectonic time per simulated hour (years). */
  yearsPerSimHour: number;
  /** Half-width of a mountain belt (m). */
  beltWidthM: number;
  /** Uplift per unit convergence (dimensionless: m of uplift per m of convergence). */
  upliftFactor: number;
  trenchFactor: number;
  riftFactor: number;
  intervalS: number;
}

export function defaultTectonicsParams(): TectonicsParams {
  return { enabled: false, plates: [], yearsPerSimHour: 20000, beltWidthM: 1500, upliftFactor: 0.2, trenchFactor: 0.4, riftFactor: 0.25, intervalS: 600 };
}

export interface TectonicsLedger {
  uplifted: number;
  subsided: number;
  years: number;
}

/** Plate palette (overlay): distinct, mid-tone hues. */
export const PLATE_COLOURS = [0x4e79a7, 0xf28e2b, 0x59a14f, 0xb07aa1, 0x76b7b2, 0xedc948, 0xff9da7, 0x9c755f];

const PLATE_NAMES = ['Northern', 'Southern', 'Eastern', 'Western', 'Central', 'Arc', 'Ridge', 'Basin'];

/**
 * Divide the map into `n` plates: warped Voronoi regions from seeded centres (natural, irregular
 * boundaries). Kind from mean elevation (land ⇒ continental), velocity 10–40 mm/yr, seeded.
 */
export function generatePlates(w: WorldState, n: number, seed: number, surface: Float32Array): Plate[] {
  const W = w.width;
  const H = w.height;
  const rnd = mulberry32(deriveSeed(seed, 'plates'));
  const noise = new Noise2D(deriveSeed(seed, 'plate-warp'));
  const centres: [number, number][] = [];
  for (let k = 0; k < n; k++) centres.push([0.1 + 0.8 * rnd(), 0.1 + 0.8 * rnd()]);
  const sum = new Float64Array(n);
  const cnt = new Float64Array(n);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const u = x / (W - 1);
      const v = y / (H - 1);
      const wu = u + 0.08 * noise.fbm(u * 3, v * 3, 3);
      const wv = v + 0.08 * noise.fbm(u * 3 + 5.2, v * 3 + 1.3, 3);
      let best = 0;
      let bd = Infinity;
      for (let k = 0; k < n; k++) {
        const d = (wu - centres[k][0]) ** 2 + (wv - centres[k][1]) ** 2;
        if (d < bd) {
          bd = d;
          best = k;
        }
      }
      const i = y * W + x;
      w.plateId[i] = best;
      sum[best] += surface[i] - w.seaLevelM;
      cnt[best]++;
    }
  mergeFragments(w, n, Math.max(4, Math.round(0.02 * W * H)));
  const plates: Plate[] = [];
  for (let k = 0; k < n; k++) {
    const a = rnd() * Math.PI * 2;
    const s = 10 + 30 * rnd();
    plates.push({
      id: k,
      name: `${PLATE_NAMES[k % PLATE_NAMES.length]} plate`,
      kind: cnt[k] && sum[k] / cnt[k] >= 0 ? 'continental' : 'oceanic',
      vxMmYr: Math.round(Math.cos(a) * s),
      vyMmYr: Math.round(Math.sin(a) * s),
    });
  }
  return plates;
}

/**
 * Plate fragments smaller than minCells (islands left by the warped Voronoi) join the plate they
 * share the longest border with — plates are large coherent slabs, not specks.
 */
function mergeFragments(w: WorldState, n: number, minCells: number) {
  const W = w.width;
  const H = w.height;
  const N = W * H;
  const comp = new Int32Array(N).fill(-1);
  const q: number[] = [];
  let nc = 0;
  for (let s = 0; s < N; s++) {
    if (comp[s] >= 0) continue;
    const pid = w.plateId[s];
    q.length = 0;
    q.push(s);
    comp[s] = nc;
    const border = new Float64Array(n);
    for (let k = 0; k < q.length; k++) {
      const i = q[k];
      const x = i % W;
      const y = (i / W) | 0;
      for (const [dx, dy] of NB) {
        const xx = x + dx;
        const yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        const j = yy * W + xx;
        if (w.plateId[j] !== pid) border[w.plateId[j]]++;
        else if (comp[j] < 0) {
          comp[j] = nc;
          q.push(j);
        }
      }
    }
    if (q.length < minCells) {
      let best = -1;
      for (let k = 0; k < n; k++) if (k !== pid && border[k] > 0 && (best < 0 || border[k] > border[best])) best = k;
      if (best >= 0) for (const i of q) w.plateId[i] = best;
    }
    nc++;
  }
}

const NB: [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

export class TectonicsSim {
  ledger: TectonicsLedger = { uplifted: 0, subsided: 0, years: 0 };
  /** Boundary type per cell (0 none, 1 convergent, 2 divergent, 3 transform), from the last classify(). */
  boundary: Uint8Array;
  /** Vertical rate per cell (m/yr) from the last rates() call. */
  rate: Float32Array;
  private sinceLast = 0;

  constructor(
    private world: WorldState,
    private surface: Float32Array,
  ) {
    const n = world.width * world.height;
    this.boundary = new Uint8Array(n);
    this.rate = new Float32Array(n);
    this.classify();
  }

  get params(): TectonicsParams {
    return this.world.tectonics;
  }

  private plate(k: number): Plate | undefined {
    return this.params.plates[k];
  }

  /** Classify every boundary cell; returns per-cell (convergence, transform) rates in m/yr. */
  classify(): { conv: Float32Array; kindOther: Int16Array } {
    const w = this.world;
    const W = w.width;
    const H = w.height;
    const n = W * H;
    const conv = new Float32Array(n);
    const kindOther = new Int16Array(n).fill(-1);
    this.boundary.fill(0);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        const pi = this.plate(w.plateId[i]);
        if (!pi) continue;
        let nx = 0;
        let ny = 0;
        let other = -1;
        for (const [dx, dy] of NB) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
          const pj = w.plateId[yy * W + xx];
          if (pj !== w.plateId[i]) {
            nx += dx;
            ny += dy;
            other = pj;
          }
        }
        if (other < 0) continue;
        const pj = this.plate(other);
        if (!pj) continue;
        const l = Math.hypot(nx, ny) || 1;
        nx /= l;
        ny /= l;
        const rx = (pj.vxMmYr - pi.vxMmYr) / 1000;
        const ry = (pj.vyMmYr - pi.vyMmYr) / 1000;
        const c = -(rx * nx + ry * ny);
        const mag = Math.hypot(rx, ry);
        conv[i] = c;
        kindOther[i] = other;
        this.boundary[i] = mag < 1e-9 ? 3 : c > 0.3 * mag ? 1 : c < -0.3 * mag ? 2 : 3;
      }
    return { conv, kindOther };
  }

  /** Vertical rate field (m/yr) from the boundaries (multi-source spread to the nearest boundary). */
  rates(): Float32Array {
    const w = this.world;
    const W = w.width;
    const H = w.height;
    const n = W * H;
    const cs = w.cellSizeM;
    const p = this.params;
    const { conv, kindOther } = this.classify();
    // Nearest boundary cell per cell on its own plate: two-pass sweep carrying the nearest
    // boundary cell (8-neighbour distance transform, exact Euclidean distance to the carried cell).
    const near = new Int32Array(n).fill(-1);
    const dist = new Float32Array(n).fill(Infinity);
    for (let i = 0; i < n; i++)
      if (this.boundary[i]) {
        near[i] = i;
        dist[i] = 0;
      }
    const reach = 3 * p.beltWidthM * 1.5;
    const relax = (i: number, x: number, y: number, dx: number, dy: number) => {
      const xx = x + dx;
      const yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= W || yy >= H) return;
      const j = yy * W + xx;
      const bj = near[j];
      if (bj < 0 || w.plateId[j] !== w.plateId[i]) return;
      const d = Math.hypot(x - (bj % W), y - ((bj / W) | 0)) * cs;
      if (d < dist[i] && d <= reach) {
        dist[i] = d;
        near[i] = bj;
      }
    };
    for (let pass = 0; pass < 2; pass++) {
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          const i = y * W + x;
          relax(i, x, y, -1, 0);
          relax(i, x, y, -1, -1);
          relax(i, x, y, 0, -1);
          relax(i, x, y, 1, -1);
        }
      for (let y = H - 1; y >= 0; y--)
        for (let x = W - 1; x >= 0; x--) {
          const i = y * W + x;
          relax(i, x, y, 1, 0);
          relax(i, x, y, 1, 1);
          relax(i, x, y, 0, 1);
          relax(i, x, y, -1, 1);
        }
    }
    const r = this.rate;
    r.fill(0);
    for (let i = 0; i < n; i++) {
      const b = near[i];
      if (b < 0) continue;
      const type = this.boundary[b];
      const c = conv[b];
      const me = this.plate(w.plateId[i]);
      const them = this.plate(kindOther[b]);
      if (!me || !them) continue;
      const d = dist[i];
      if (type === 1) {
        const cc = me.kind === 'continental' && them.kind === 'continental';
        const wid = p.beltWidthM * (cc ? 1.5 : 1);
        if (me.kind === 'oceanic' && them.kind === 'continental') {
          r[i] = -p.trenchFactor * c * Math.exp(-((d / (0.5 * wid)) ** 2)); // trench on the oceanic side
        } else {
          r[i] = p.upliftFactor * c * Math.exp(-((d / wid) ** 2)) * (me.kind === 'continental' && them.kind === 'oceanic' ? 1.3 : 1);
        }
      } else if (type === 2) {
        r[i] = -p.riftFactor * Math.abs(c) * Math.exp(-((d / (0.5 * p.beltWidthM)) ** 2));
      }
    }
    return r;
  }

  accumulate(dtWater: number): boolean {
    if (!this.params.enabled || !this.params.plates.length) return false;
    this.sinceLast += dtWater;
    return this.sinceLast >= this.params.intervalS;
  }

  update(): boolean {
    const dt = this.sinceLast;
    this.sinceLast = 0;
    if (!this.params.enabled || dt <= 0) return false;
    this.run((dt * this.params.yearsPerSimHour) / 3600);
    return true;
  }

  /** Advance `years` of tectonic time: move bedrock (and strata) by rate × years. */
  run(years: number) {
    const w = this.world;
    const r = this.rates();
    const b = w.bedrockElevationM;
    const A = w.cellSizeM * w.cellSizeM;
    let up = 0;
    let down = 0;
    for (let i = 0; i < r.length; i++) {
      if (r[i] === 0) continue;
      const nb = Math.fround(b[i] + r[i] * years);
      const dz = nb - b[i];
      if (dz === 0) continue;
      b[i] = nb;
      for (let k = 0; k < STRATA_BOUNDS; k++) {
        const o = i * STRATA_BOUNDS + k;
        if (w.strataBoundsM[o] !== STRATA_NONE) w.strataBoundsM[o] += dz;
      }
      refreshExposed(w, i);
      this.surface[i] = b[i] + w.looseSedimentThicknessM[i];
      if (dz > 0) up += dz;
      else down -= dz;
    }
    this.ledger.uplifted += up * A;
    this.ledger.subsided += down * A;
    this.ledger.years += years;
    if (up > 0 || down > 0) {
      settleSlopes(w, 60);
      for (let i = 0; i < this.surface.length; i++) this.surface[i] = b[i] + w.looseSedimentThicknessM[i];
    }
  }
}
