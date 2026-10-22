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
 *   transform: no vertical change — instead slip accumulates (tangential relative speed × time) and
 *     each whole cell of slip shifts the higher-id plate one cell along the fault (dominant axis of
 *     the fault tangent): every column field moves (rock, strata, soil, water, snow, ice, plants), so
 *     ridges and rivers crossing the fault are offset. Within the plate it is an exact move; at the
 *     leading end of each strip a column leaves, the trailing cell is extended — booked as
 *     edgeExchange.
 *   subduction (oceanic under continental, or the lower-id of two oceanic plates): trench on the
 *     sinking side; on the overriding plate vents are spaced along a line ARC_DISTANCE × w inboard
 *     (the ~100 km slab-depth rule, scaled), and volcanic cones grow there (arcFactor · c, conical,
 *     radius 0.45 w) as a new volcanic top layer — ledgered as volcanic addition. Oceanic–oceanic
 *     arcs grow islands.
 *   continent–continent collision also folds the strata: boundaries gain an extra
 *     FOLD_GAIN·|uplift|·sin(2πd/(0.6w))·exp(−(d/w)²) (anticlines and synclines parallel to the belt),
 *     leaving the surface unchanged; erosion of the range then exposes folded rock bands.
 *   divergent: fault-bounded blocks — graben (d < w/4) at the full rate, steps at 0.6 and 0.3, a
 *     shoulder rising at 0.12 — so rifts grow normal-fault scarps.
 *   w = beltWidthM (continental–continental ×1.5).
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
  /** Peak volcanic growth per unit convergence at arc vents. */
  arcFactor: number;
  intervalS: number;
}

export function defaultTectonicsParams(): TectonicsParams {
  return { enabled: false, plates: [], yearsPerSimHour: 20000, beltWidthM: 1500, upliftFactor: 0.2, trenchFactor: 0.4, riftFactor: 0.25, arcFactor: 0.25, intervalS: 600 };
}

export interface TectonicsLedger {
  uplifted: number;
  subsided: number;
  years: number;
  /** Lateral slip on transform faults (m, summed over faults) and cell shifts applied. */
  slipM: number;
  shifts: number;
  /** Ground volume that left (−) / entered (+) at the ends of shifted strips (m³). */
  edgeExchange: number;
  /** Volcanic rock added at arc vents (m³). */
  volcanic: number;
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

/** Which plate sinks where two converge: oceanic under continental; of two oceanic, the lower id. */
function subducts(a: Plate, b: Plate): boolean {
  if (a.kind === 'oceanic' && b.kind === 'continental') return true;
  if (a.kind === 'oceanic' && b.kind === 'oceanic') return a.id < b.id;
  return false;
}

/** Arc volcanoes sit this many belt widths inboard of the trench (scaled ~100 km slab-depth rule). */
export const ARC_DISTANCE = 2.5;
/** Fold wavelength (in belt widths) and amplitude growth (× uplift) of strata in collision belts. */
const FOLD_WAVELENGTH = 0.6;
const FOLD_GAIN = 1.5;
const VOLCANIC = 5;

function cellHash(i: number): number {
  let h = Math.imul(i ^ 0x27d4eb2d, 0x85ebca6b);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

const NB: [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

export class TectonicsSim {
  ledger: TectonicsLedger = { uplifted: 0, subsided: 0, years: 0, slipM: 0, shifts: 0, edgeExchange: 0, volcanic: 0 };
  /** Slip not yet applied as a whole-cell shift, per plate pair 'a-b' (m, + along the tangent). */
  pendingSlip = new Map<string, number>();
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
    const arcCand: number[] = [];
    if (this.fold.length !== n) this.fold = new Float32Array(n);
    const fold = this.fold;
    fold.fill(0);
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
        if (subducts(me, them)) {
          r[i] = -p.trenchFactor * c * Math.exp(-((d / (0.5 * wid)) ** 2)); // trench on the sinking side
        } else {
          // Overriding plate edge / collision belt (an oceanic overriding plate rises less).
          const k = me.kind === 'continental' && them.kind === 'oceanic' ? 1.3 : me.kind === 'oceanic' ? 0.5 : 1;
          r[i] = p.upliftFactor * c * Math.exp(-((d / wid) ** 2)) * k;
          if (subducts(them, me)) arcCand.push(i);
          if (cc) fold[i] = Math.sin((2 * Math.PI * d) / (FOLD_WAVELENGTH * wid)) * Math.exp(-((d / wid) ** 2));
        }
      } else if (type === 2) {
        // Fault-bounded blocks: graben, two step blocks, raised shoulder (normal-fault scarps between).
        const blk = Math.floor(d / (0.25 * p.beltWidthM));
        const f = blk === 0 ? 1 : blk === 1 ? 0.6 : blk === 2 ? 0.3 : blk === 3 ? -0.12 : 0;
        r[i] = -p.riftFactor * Math.abs(c) * f;
      }
    }
    this.arcVolcanoes(arcCand, dist, near, conv);
    return r;
  }

  /** Fold phase per cell in continental collision belts (−1 … 1) from the last rates() call. */
  fold = new Float32Array(0);

  /** Volcanic vents on the overriding plate, ARC_DISTANCE × belt width inboard of a subduction trench. */
  vents: number[] = [];
  /** Volcanic growth rate per cell (m/yr) from the last rates() call. */
  arcRate = new Float32Array(0);

  private arcVolcanoes(cand: number[], dist: Float32Array, near: Int32Array, conv: Float32Array) {
    const w = this.world;
    const W = w.width;
    const cs = w.cellSizeM;
    const p = this.params;
    if (this.arcRate.length !== W * w.height) this.arcRate = new Float32Array(W * w.height);
    const a = this.arcRate;
    a.fill(0);
    const arcD = ARC_DISTANCE * p.beltWidthM;
    const spacing = 1.2 * p.beltWidthM;
    const R = Math.max(1.5 * cs, 0.45 * p.beltWidthM);
    const band = cand.filter((i) => Math.abs(dist[i] - arcD) <= 0.75 * cs);
    band.sort((i, j) => cellHash(i) - cellHash(j));
    const vents: number[] = [];
    for (const i of band) {
      const x = i % W;
      const y = (i / W) | 0;
      if (vents.every((v) => Math.hypot(x - (v % W), y - ((v / W) | 0)) * cs >= spacing)) vents.push(i);
    }
    this.vents = vents;
    const rc = Math.ceil(R / cs);
    for (const v of vents) {
      const vx = v % W;
      const vy = (v / W) | 0;
      const rate = p.arcFactor * Math.max(0, conv[near[v]]);
      for (let y = Math.max(0, vy - rc); y <= Math.min(w.height - 1, vy + rc); y++)
        for (let x = Math.max(0, vx - rc); x <= Math.min(W - 1, vx + rc); x++) {
          const d = Math.hypot(x - vx, y - vy) * cs;
          if (d < R) a[y * W + x] += rate * (1 - d / R);
        }
    }
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

  /** Number of cells shifted by the last run (callers re-upload water when > 0). */
  lastShifts = 0;

  /** Accumulate slip on each transform fault and shift plates by whole cells. */
  private transformSlip(years: number) {
    const w = this.world;
    const W = w.width;
    const H = w.height;
    const plates = this.params.plates;
    this.lastShifts = 0;
    // Fault normal per pair (sum of boundary-cell directions from the lower to the higher id).
    const normals = new Map<string, [number, number, number]>();
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (this.boundary[i] !== 3) continue;
        const a = w.plateId[i];
        for (const [dx, dy] of NB) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
          const b = w.plateId[yy * W + xx];
          if (b <= a) continue;
          const key = `${a}-${b}`;
          const v = normals.get(key) ?? [0, 0, 0];
          normals.set(key, [v[0] + dx, v[1] + dy, v[2] + 1]);
        }
      }
    for (const [key, [nx0, ny0, cnt]] of normals) {
      if (cnt < 3) continue;
      const [a, b] = key.split('-').map(Number);
      const pa = plates[a];
      const pb = plates[b];
      if (!pa || !pb) continue;
      const l = Math.hypot(nx0, ny0) || 1;
      const nx = nx0 / l;
      const ny = ny0 / l;
      const tx = -ny;
      const ty = nx;
      const rel = ((pb.vxMmYr - pa.vxMmYr) * tx + (pb.vyMmYr - pa.vyMmYr) * ty) / 1000; // m/yr along t
      const slip = rel * years;
      this.ledger.slipM += Math.abs(slip);
      let pend = (this.pendingSlip.get(key) ?? 0) + slip;
      const cs = w.cellSizeM;
      while (Math.abs(pend) >= cs) {
        const sgn = Math.sign(pend);
        // Shift plate b one cell along the dominant axis of the tangent.
        if (Math.abs(tx) >= Math.abs(ty)) this.shiftPlate(b, Math.sign(tx) * sgn, 0);
        else this.shiftPlate(b, 0, Math.sign(ty) * sgn);
        pend -= sgn * cs;
        this.ledger.shifts++;
        this.lastShifts++;
      }
      this.pendingSlip.set(key, pend);
    }
  }

  /** Move every column of plate k one cell by (dx, dy) along its runs (see class comment). */
  shiftPlate(k: number, dx: number, dy: number) {
    const w = this.world;
    const W = w.width;
    const H = w.height;
    const A = w.cellSizeM * w.cellSizeM;
    const fields: { a: Float32Array | Uint8Array; per: number }[] = [
      { a: w.bedrockElevationM, per: 1 },
      { a: w.looseSedimentThicknessM, per: 1 },
      { a: w.materialId, per: 1 },
      { a: w.strataBoundsM, per: STRATA_BOUNDS },
      { a: w.strataMaterial, per: 4 },
      { a: w.waterDepthM, per: 1 },
      { a: w.sedimentSuspendedM, per: 1 },
      { a: w.snowSweM, per: 1 },
      { a: w.iceThicknessM, per: 1 },
      { a: w.iceDebrisM, per: 1 },
      { a: w.vegCover, per: 1 },
    ];
    const copy = (to: number, from: number) => {
      for (const f of fields) for (let c = 0; c < f.per; c++) f.a[to * f.per + c] = f.a[from * f.per + c];
    };
    const ground = (i: number) => w.bedrockElevationM[i] + w.looseSedimentThicknessM[i];
    // Runs along the shift axis; walk from the leading end backwards so each cell takes its predecessor.
    const lines = dx !== 0 ? H : W;
    const len = dx !== 0 ? W : H;
    const at = (line: number, t: number) => (dx !== 0 ? line * W + t : t * W + line);
    const dir = dx !== 0 ? dx : dy;
    for (let line = 0; line < lines; line++) {
      let t = dir > 0 ? len - 1 : 0;
      while (dir > 0 ? t >= 0 : t < len) {
        if (w.plateId[at(line, t)] !== k) {
          t -= dir;
          continue;
        }
        // Run of plate k from its leading end `t` back to its trailing end.
        const lead = t;
        let trail = t;
        while ((dir > 0 ? trail - 1 >= 0 : trail + 1 < len) && w.plateId[at(line, trail - dir)] === k) trail -= dir;
        this.ledger.edgeExchange -= ground(at(line, lead)) * A; // the leading column leaves the run
        for (let u = lead; u !== trail; u -= dir) copy(at(line, u), at(line, u - dir));
        this.ledger.edgeExchange += ground(at(line, trail)) * A; // trailing column extended (duplicated)
        t = trail - dir;
      }
    }
    for (let i = 0; i < W * H; i++) {
      if (w.plateId[i] !== k) continue;
      w.waterFluxM3PerS.fill(0, i * 4, i * 4 + 4);
      this.surface[i] = ground(i);
    }
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
      // Strata move with the rock; in collision belts they also fold (anticlines / synclines across
      // the belt), so erosion of the range exposes alternating rock bands.
      const fz = this.fold[i] ? FOLD_GAIN * Math.abs(dz) * this.fold[i] : 0;
      for (let k = 0; k < STRATA_BOUNDS; k++) {
        const o = i * STRATA_BOUNDS + k;
        if (w.strataBoundsM[o] !== STRATA_NONE) w.strataBoundsM[o] += dz + fz;
      }
      refreshExposed(w, i);
      this.surface[i] = b[i] + w.looseSedimentThicknessM[i];
      if (dz > 0) up += dz;
      else down -= dz;
    }
    // Arc volcanism: new volcanic rock laid on top (a volcanic top layer in the strata column).
    let volc = 0;
    const av = this.arcRate;
    for (let i = 0; i < av.length; i++) {
      if (av[i] <= 0) continue;
      const add = av[i] * years;
      const o = i * STRATA_BOUNDS;
      const m = i * 4;
      if (w.strataMaterial[m] !== VOLCANIC) {
        for (let k = STRATA_BOUNDS - 1; k > 0; k--) w.strataBoundsM[o + k] = w.strataBoundsM[o + k - 1];
        for (let k = 3; k > 0; k--) w.strataMaterial[m + k] = w.strataMaterial[m + k - 1];
        w.strataBoundsM[o] = b[i];
        w.strataMaterial[m] = VOLCANIC;
      }
      const nb = Math.fround(b[i] + add);
      volc += nb - b[i];
      b[i] = nb;
      refreshExposed(w, i);
      this.surface[i] = b[i] + w.looseSedimentThicknessM[i];
    }
    this.ledger.volcanic += volc * A;
    this.ledger.uplifted += up * A;
    this.ledger.subsided += down * A;
    this.ledger.years += years;
    this.transformSlip(years);
    if (up > 0 || down > 0 || volc > 0) {
      settleSlopes(w, 60);
      for (let i = 0; i < this.surface.length; i++) this.surface[i] = b[i] + w.looseSedimentThicknessM[i];
    }
  }
}
