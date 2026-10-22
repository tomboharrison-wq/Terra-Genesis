import { refreshExposed, type WorldState } from '../../engine/world';
import type { ClimateField } from '../climate/climate';
import { YEAR_S } from '../climate/climate';

/**
 * Glaciers (spec E8), CPU, run on a slow cadence (every intervalS of simulated water time) in
 * accelerated glacier time: each update advances dtWater × yearsPerSimHour · YEAR_S / 3600 seconds.
 *
 * Mass balance (m of ice per year, applied each substep), linear in height about the equilibrium line (ELA):
 *   b = β · (z − z_ELA), capped at bMax above; accumulation (b > 0) scaled by the climate rain factor.
 *   z_ELA is where the annual-mean temperature equals elaTempC: z_ELA = sea + (T₀ − elaTempC)/Γ.
 *   Ablation only removes ice that exists. Ice reaching the sea calves (removed, ledgered).
 * Flow: shallow-ice approximation on cell faces, surface s = ground + ice:
 *   q = −(1 + f_s) · Γ_i · H⁵ · |∇s|² · ∇s,  Γ_i = 2A(ρg)³/5  (Glen n = 3; f_s = sliding / deformation)
 *   H on a face = the upstream (higher-surface) cell's ice, so ice-free cells cannot lose ice;
 *   |∇s| from the face-normal and averaged transverse slopes. Each substep (≤ 5 years, and
 *   short enough that dt·D_max/cs² ≤ 100) is semi-implicit: face diffusivities D are frozen and (I − dt∇·D∇)H' = H + dt∇·(D∇z) is solved by
 *   Jacobi-preconditioned conjugate gradients; the fluxes of that solution then move the ice as
 *   pairwise donor-limited transfers — stable at long steps, exactly conservative, never negative.
 *   |∇s|² in D is capped at 0.16 (slope 0.4: steeper icefalls are outside the SIA). Mass balance
 *   is applied per substep, so glacier time = flow time.
 *   At most MAX_SUBSTEPS per update and `budgetMs` of wall-clock time: beyond that the glacier
 *   clock lags and the lag is reported; transfers capped by the ice a donor holds.
 *   Map edges: ice leaves where the ground slopes outward (ghost cell continues the slope), booked
 *   as exported with its debris; no ice flows in.
 * Erosion (abrasion): bed lowering = abrasionK · u_b · dt, u_b = f_s/(1+f_s) · |q|/H (sliding speed,
 *   under ice ≥ 10 m thick, capped at 2 km/yr);
 *   loose sediment first, then bedrock (exact float32 deltas). Eroded rock is carried in the ice as
 *   debris (moved with the ice fraction transferred) and dropped as loose sediment where ice thins
 *   below DROP_ICE_M — moraines at the snout. Ice and debris ledgers close.
 * Meltwater: ablated ice (as water, ×0.917) reaches the rivers at the real-time rate — the ablated
 *   volume ÷ the time acceleration — and is booked as a water-ledger input (glacierMeltIn), the same
 *   separation of geomorphic and water time as erosion's speedup.
 * Limits: no thermodynamics, no longitudinal stresses (icefalls are approximate), no subglacial
 * hydrology; ice sits on the terrain surface; fine landforms (corries, arêtes) are below grid scale.
 */
export interface GlacierParams {
  enabled: boolean;
  /** Glacier time per simulated hour (years). */
  yearsPerSimHour: number;
  /** Mass-balance gradient (m ice per year per m of height). */
  balanceGradient: number;
  /** Maximum accumulation (m ice per year). */
  maxAccumulation: number;
  /** Annual-mean temperature at the equilibrium line (°C). */
  elaTempC: number;
  /** Basal sliding as a multiple of internal deformation. */
  slidingFactor: number;
  /** Abrasion: m of bed eroded per m of sliding. */
  abrasionK: number;
  /** Cadence (simulated water seconds). */
  intervalS: number;
}

export function defaultGlacierParams(): GlacierParams {
  return { enabled: false, yearsPerSimHour: 10, balanceGradient: 0.007, maxAccumulation: 2, elaTempC: -6, slidingFactor: 1, abrasionK: 1e-4, intervalS: 600 };
}

export interface GlacierLedger {
  /** Ice gained by accumulation (m³ of ice). */
  accumulated: number;
  /** Ice lost to melt (m³ of ice). */
  ablated: number;
  /** Ice lost by calving into the sea (m³). */
  calved: number;
  /** Ice added by clamping tiny negative thicknesses from the implicit solve (m³, numerical). */
  correction: number;
  /** Ice (and the debris it carries) that flowed off the map edges (m³). */
  exported: number;
  debrisExported: number;
  /** Rock eroded by the ice (m³) — of which bedrock. */
  eroded: number;
  erodedBedrock: number;
  /** Debris dropped from the ice as moraine / on the sea floor (m³). */
  deposited: number;
  /** Glacier time advanced (s) and time the CFL cap could not run (s). */
  timeS: number;
  lagS: number;
  /** Ice and debris volume at the last reset (m³). */
  initialIce: number;
  initialDebris: number;
}

const RHO_I = 917;
const G = 9.81;
const GLEN_A = 2.4e-24;
const GAMMA = (2 * GLEN_A * Math.pow(RHO_I * G, 3)) / 5;
const MAX_SUBSTEPS = 2000;
/** Longest substep (s): mass balance is applied per substep. */
const MAX_SUB_S = 5 * YEAR_S;
/** Largest dt·D/cs² per substep: implicit, but bounded so CG converges in a few hundred iterations. */
const MAX_IMPLICIT_RATIO = 100;
/** Sliding (and so abrasion) only under ice this thick, capped at 2 km/yr (valley glaciers, not surges). */
const MIN_SLIDE_ICE_M = 10;
const MAX_SLIDE_MS = 2000 / YEAR_S;
/** Surface slope used in the flow law is capped (the SIA does not hold on icefalls). */
const MAX_SLOPE2 = 0.16;
const DROP_ICE_M = 0.5;
export const ICE_TO_WATER = RHO_I / 1000;

export class GlacierSim {
  ledger: GlacierLedger;
  private sinceLast = 0;
  /** Implicit solves that hit the CG iteration cap (diagnostic; should stay 0). */
  unconverged = 0;
  private lastSolveConverged = true;
  /** Wall-clock budget per update (ms); glacier time that does not fit is reported as lag. */
  budgetMs = Infinity;
  /** Fastest sliding speed at the last update (m/yr) — for display. */
  maxSlideMPerYr = 0;
  private qx: Float64Array;
  private qy: Float64Array;

  constructor(
    private world: WorldState,
    private surface: Float32Array,
    private climate: ClimateField,
  ) {
    const n = world.width * world.height;
    this.qx = new Float64Array(n);
    this.qy = new Float64Array(n);
    this.ledger = this.emptyLedger();
  }

  private emptyLedger(): GlacierLedger {
    return { accumulated: 0, ablated: 0, calved: 0, correction: 0, exported: 0, debrisExported: 0, eroded: 0, erodedBedrock: 0, deposited: 0, timeS: 0, lagS: 0, initialIce: this.iceVolume(), initialDebris: this.debrisVolume() };
  }

  resetLedger() {
    this.ledger = this.emptyLedger();
  }

  get params(): GlacierParams {
    return this.world.glacier;
  }

  iceVolume(): number {
    let v = 0;
    for (const h of this.world.iceThicknessM) v += h;
    return v * this.world.cellSizeM * this.world.cellSizeM;
  }

  debrisVolume(): number {
    let v = 0;
    for (const d of this.world.iceDebrisM) v += d;
    return v * this.world.cellSizeM * this.world.cellSizeM;
  }

  accumulate(dtWater: number): boolean {
    if (!this.params.enabled || !this.world.climate.enabled) return false;
    this.sinceLast += dtWater;
    return this.sinceLast >= this.params.intervalS;
  }

  /** Run the accumulated interval. Returns meltwater per cell (m of water depth, real-time share). */
  update(): Float32Array | null {
    const dt = this.sinceLast;
    this.sinceLast = 0;
    if (!this.params.enabled || dt <= 0) return null;
    return this.run((dt * this.params.yearsPerSimHour * YEAR_S) / 3600, dt);
  }

  /**
   * Advance glacier time dtGeo (s). dtWater is the matching water time, used to scale meltwater
   * to the real-time rate. Returns per-cell meltwater depth (m) to add to surface water.
   */
  run(dtGeo: number, dtWater: number): Float32Array {
    const w = this.world;
    const W = w.width;
    const H = w.height;
    const n = W * H;
    const cs = w.cellSizeM;
    const A = cs * cs;
    const p = this.params;
    const c = w.climate;
    const ice = w.iceThicknessM;
    const deb = w.iceDebrisM;
    const z = this.surface;
    const melt = new Float32Array(n);
    const lapse = c.lapseRateCPerKm / 1000;
    const zEla = w.seaLevelM + (c.seaLevelTempC - p.elaTempC) / Math.max(1e-6, lapse);
    const scale = dtWater / Math.max(dtGeo, 1e-9); // meltwater real-time share

    let acc = 0;
    let abl = 0;
    let calv = 0;
    let dropped = 0;
    // Mass balance and calving for a substep of `sub` seconds (interleaved with flow, so ice only
    // accumulates for glacier time that the flow actually simulates).
    const balance = (sub: number) => {
      const years = sub / YEAR_S;
      for (let i = 0; i < n; i++) {
        if (z[i] < w.seaLevelM) {
          if (ice[i] > 0) {
            calv += ice[i];
            ice[i] = 0;
          }
          if (deb[i] > 0) this.drop(i, deb[i]), (dropped += deb[i]), (deb[i] = 0);
          continue;
        }
        const zs = z[i] + ice[i];
        let bm = p.balanceGradient * (zs - zEla);
        if (bm > 0) bm = Math.min(p.maxAccumulation, bm) * this.climate.rainFactor[i];
        const dh = bm * years;
        if (dh >= 0) {
          ice[i] += dh;
          acc += dh;
        } else if (ice[i] > 0) {
          const m = Math.min(ice[i], -dh);
          ice[i] -= m;
          abl += m;
          melt[i] += m * ICE_TO_WATER * scale;
        }
      }
    };
    // 2. Flow + erosion: semi-implicit substeps (backward Euler with face diffusivities frozen at
    //    the start of the substep, solved by Jacobi-preconditioned conjugate gradients).
    let t = 0;
    let steps = 0;
    let eroded = 0;
    let erodedB = 0;
    let exported = 0;
    let debExported = 0;
    let correction = 0;
    this.maxSlideMPerYr = 0;
    const fs = p.slidingFactor;
    const slideShare = fs / (1 + fs);
    const Dx = this.qx; // reused as face diffusivities, then fluxes
    const Dy = this.qy;
    const wall0 = performance.now();
    const k2 = 1 / (cs * cs);
    while (t < dtGeo - 1e-6 && steps < MAX_SUBSTEPS && performance.now() - wall0 < this.budgetMs) {
      // Face diffusivities from the upstream cell's ice (no ice ⇒ no outflow from that cell).
      let anyIce = false;
      let dMax = 0;
      for (let i = 0; i < n; i++) {
        const x = i % W;
        Dx[i] = 0;
        Dy[i] = 0;
        if (ice[i] > 0) anyIce = true;
        if (x < W - 1) Dx[i] = this.faceD(i, i + 1, x, Math.floor(i / W), true, fs);
        if (i + W < n) Dy[i] = this.faceD(i, i + W, x, Math.floor(i / W), false, fs);
        dMax = Math.max(dMax, Dx[i], Dy[i]);
      }
      // Substep: ≤ MAX_SUB_S and dt·D_max/cs² ≤ MAX_IMPLICIT_RATIO (keeps CG well conditioned).
      const sub = Math.min(dtGeo - t, MAX_SUB_S, dMax > 0 ? (MAX_IMPLICIT_RATIO * cs * cs) / dMax : Infinity);
      balance(sub);
      if (!anyIce) {
        t += sub;
        steps++;
        continue;
      }
      // Solve (I − dt·∇·D∇) H' = H + dt·∇·(D∇z)  for H'.
      const h0 = Float64Array.from(ice);
      void correction;
      const rhs = new Float64Array(n);
      const diag = new Float64Array(n);
      for (let i = 0; i < n; i++) {
        const x = i % W;
        let r = h0[i];
        let dg = 1;
        const face = (D: number, j: number) => {
          if (D <= 0) return;
          r += sub * k2 * D * (z[j] - z[i]);
          dg += sub * k2 * D;
        };
        if (x < W - 1) face(Dx[i], i + 1);
        if (x > 0) face(Dx[i - 1], i - 1);
        if (i + W < n) face(Dy[i], i + W);
        if (i >= W) face(Dy[i - W], i - W);
        rhs[i] = r;
        diag[i] = dg;
      }
      const hNew = this.solve(rhs, diag, h0, sub * k2, W, n);
      if (!this.lastSolveConverged) this.unconverged++;
      // Move ice with the fluxes implied by the implicit solution, as pairwise donor-limited
      // transfers: exactly conservative however loosely CG converged, and never negative.
      const fq = new Float64Array(2 * n); // face volume (m of ice over a cell), + = towards +x / +y
      const out = new Float64Array(n);
      const qc = new Float64Array(n); // |q| at cell centres (m²/s), for sliding
      const faceQ = (i: number, j: number, D: number, k: number) => {
        if (D <= 0) return;
        const q = (-D * (z[j] + hNew[j] - z[i] - hNew[i])) / cs; // m²/s, + = i → j
        qc[i] += Math.abs(q) / 2;
        qc[j] += Math.abs(q) / 2;
        const v = (q * cs * sub) / A;
        fq[k] = v;
        out[v > 0 ? i : j] += Math.abs(v);
      };
      for (let i = 0; i < n; i++) {
        const x = i % W;
        if (x < W - 1) faceQ(i, i + 1, Dx[i], 2 * i);
        if (i + W < n) faceQ(i, i + W, Dy[i], 2 * i + 1);
      }
      const lim = new Float64Array(n);
      for (let i = 0; i < n; i++) lim[i] = out[i] > ice[i] ? ice[i] / out[i] : 1;
      const dIce = new Float64Array(n);
      const dDeb = new Float64Array(n);
      const transfer = (from: number, to: number, v: number) => {
        const h = v * lim[from];
        if (h <= 0) return;
        const frac = ice[from] > 0 ? Math.min(1, h / ice[from]) : 0;
        dIce[from] -= h;
        dIce[to] += h;
        const dd = deb[from] * frac;
        dDeb[from] -= dd;
        dDeb[to] += dd;
      };
      for (let i = 0; i < n; i++) {
        const x = i % W;
        const vx = fq[2 * i];
        const vy = fq[2 * i + 1];
        if (x < W - 1 && vx !== 0) vx > 0 ? transfer(i, i + 1, vx) : transfer(i + 1, i, -vx);
        if (i + W < n && vy !== 0) vy > 0 ? transfer(i, i + W, vy) : transfer(i + W, i, -vy);
      }
      for (let i = 0; i < n; i++) {
        ice[i] = Math.max(0, ice[i] + dIce[i]);
        deb[i] = Math.max(0, deb[i] + dDeb[i]);
      }
      // Map edges: ice leaves where the ground slopes outward (explicit, donor-limited).
      const edgeOut = (i: number, inner: number) => {
        const h = ice[i];
        if (h <= 0) return;
        const gs = (z[i] - z[inner]) / cs;
        if (gs >= 0) return;
        const D = (1 + fs) * GAMMA * Math.pow(h, 5) * Math.min(MAX_SLOPE2, gs * gs);
        const out = Math.min(h, (D * -gs * sub) / cs);
        if (out <= 0) return;
        const dd = (deb[i] * out) / h;
        ice[i] -= out;
        deb[i] -= dd;
        exported += out;
        debExported += dd;
      };
      for (let x = 0; x < W; x++)
        if (H > 1) {
          edgeOut(x, x + W);
          edgeOut((H - 1) * W + x, (H - 2) * W + x);
        }
      for (let y = 0; y < H; y++)
        if (W > 1) {
          edgeOut(y * W, y * W + 1);
          edgeOut(y * W + W - 1, y * W + W - 2);
        }
      // Abrasion from the sliding speed u_b = f_s/(1+f_s) · |q| / H.
      for (let i = 0; i < n; i++) {
        const h = ice[i];
        if (h <= MIN_SLIDE_ICE_M) continue;
        const ub = Math.min(MAX_SLIDE_MS, (slideShare * qc[i]) / h);
        const ubYr = ub * YEAR_S;
        if (ubYr > this.maxSlideMPerYr) this.maxSlideMPerYr = ubYr;
        const e = p.abrasionK * ub * sub;
        if (e > 0) {
          const [tot, bed] = this.erode(i, e);
          eroded += tot;
          erodedB += bed;
          deb[i] += tot;
        }
      }
      t += sub;
      steps++;
    }
    // 3. Debris drops where the ice has (nearly) gone: moraine.
    for (let i = 0; i < n; i++)
      if (deb[i] > 0 && ice[i] < DROP_ICE_M) {
        this.drop(i, deb[i]);
        dropped += deb[i];
        deb[i] = 0;
      }
    const L = this.ledger;
    L.accumulated += acc * A;
    L.ablated += abl * A;
    L.calved += calv * A;
    L.exported += exported * A;
    L.correction += correction * A;
    L.debrisExported += debExported * A;
    L.eroded += eroded * A;
    L.erodedBedrock += erodedB * A;
    L.deposited += dropped * A;
    L.timeS += t;
    L.lagS += dtGeo - t;
    return melt;
  }

  /** SIA face diffusivity (m²/s) between i and j using the upstream cell's ice thickness. */
  private faceD(i: number, j: number, x: number, y: number, alongX: boolean, fs: number): number {
    const ice = this.world.iceThicknessM;
    const z = this.surface;
    const si = z[i] + ice[i];
    const sj = z[j] + ice[j];
    const hUp = si >= sj ? ice[i] : ice[j];
    if (hUp <= 0) return 0;
    const cs = this.world.cellSizeM;
    const gn = (sj - si) / cs;
    const gt = this.transverse(x, y, alongX ? x + 1 : x, alongX ? y : y + 1, alongX);
    return (1 + fs) * GAMMA * Math.pow(hUp, 5) * Math.min(MAX_SLOPE2, gn * gn + gt * gt);
  }

  /** Jacobi-preconditioned CG for the 5-point system diag·x − c·Σ D_f·x_nb = rhs (SPD). */
  private solve(rhs: Float64Array, diag: Float64Array, x0: Float64Array, c: number, W: number, n: number): Float64Array {
    const Dx = this.qx;
    const Dy = this.qy;
    const mul = (v: Float64Array, out: Float64Array) => {
      for (let i = 0; i < n; i++) {
        const x = i % W;
        let r = diag[i] * v[i];
        if (x < W - 1 && Dx[i] > 0) r -= c * Dx[i] * v[i + 1];
        if (x > 0 && Dx[i - 1] > 0) r -= c * Dx[i - 1] * v[i - 1];
        if (i + W < n && Dy[i] > 0) r -= c * Dy[i] * v[i + W];
        if (i >= W && Dy[i - W] > 0) r -= c * Dy[i - W] * v[i - W];
        out[i] = r;
      }
    };
    const x = Float64Array.from(x0);
    const r = new Float64Array(n);
    const zv = new Float64Array(n);
    const pv = new Float64Array(n);
    const ap = new Float64Array(n);
    mul(x, ap);
    let bn = 0;
    for (let i = 0; i < n; i++) {
      r[i] = rhs[i] - ap[i];
      zv[i] = r[i] / diag[i];
      pv[i] = zv[i];
      bn += rhs[i] * rhs[i];
    }
    let rz = 0;
    for (let i = 0; i < n; i++) rz += r[i] * zv[i];
    const tol = 1e-12 * Math.max(bn, 1e-30); // relative residual 1e-6
    this.lastSolveConverged = false;
    for (let it = 0; it < 400; it++) {
      let rr = 0;
      for (let i = 0; i < n; i++) rr += r[i] * r[i];
      if (rr <= tol) {
        this.lastSolveConverged = true;
        break;
      }
      mul(pv, ap);
      let pap = 0;
      for (let i = 0; i < n; i++) pap += pv[i] * ap[i];
      if (pap <= 0) break;
      const alpha = rz / pap;
      for (let i = 0; i < n; i++) {
        x[i] += alpha * pv[i];
        r[i] -= alpha * ap[i];
        zv[i] = r[i] / diag[i];
      }
      let rzNew = 0;
      for (let i = 0; i < n; i++) rzNew += r[i] * zv[i];
      const beta = rzNew / rz;
      rz = rzNew;
      for (let i = 0; i < n; i++) pv[i] = zv[i] + beta * pv[i];
    }
    return x;
  }

  /** Mean of the transverse surface slope at the two cells of a face. */
  private transverse(x0: number, y0: number, x1: number, y1: number, alongX: boolean): number {
    const w = this.world;
    const W = w.width;
    const H = w.height;
    const cs = w.cellSizeM;
    const s = (x: number, y: number) => {
      const i = Math.max(0, Math.min(H - 1, y)) * W + Math.max(0, Math.min(W - 1, x));
      return this.surface[i] + w.iceThicknessM[i];
    };
    if (alongX) return (s(x0, y0 + 1) - s(x0, y0 - 1) + s(x1, y1 + 1) - s(x1, y1 - 1)) / (4 * cs);
    return (s(x0 + 1, y0) - s(x0 - 1, y0) + s(x1 + 1, y1) - s(x1 - 1, y1)) / (4 * cs);
  }

  /** Lower the ground at i by e (loose first, then bedrock). Returns [total, bedrock] actually removed. */
  private erode(i: number, e: number): [number, number] {
    const w = this.world;
    const loose = w.looseSedimentThicknessM;
    const fromLoose = Math.min(loose[i], e);
    const nl = Math.fround(loose[i] - fromLoose);
    const dl = loose[i] - nl;
    loose[i] = nl;
    let db = 0;
    if (e - fromLoose > 0) {
      const b = w.bedrockElevationM;
      const nb = Math.fround(b[i] - (e - fromLoose));
      db = b[i] - nb;
      b[i] = nb;
      refreshExposed(w, i);
    }
    this.surface[i] = w.bedrockElevationM[i] + loose[i];
    return [dl + db, db];
  }

  /** Lay debris down as loose sediment (exact float32 delta booked by the caller's amount). */
  private drop(i: number, v: number) {
    const w = this.world;
    const loose = w.looseSedimentThicknessM;
    loose[i] = loose[i] + v;
    this.surface[i] = w.bedrockElevationM[i] + loose[i];
  }
}

/** Ice closure: initial + accumulated − ablated − calved vs current, relative. */
export function iceClosure(l: GlacierLedger, current: number): number {
  const expected = l.initialIce + l.accumulated + l.correction - l.ablated - l.calved - l.exported;
  return Math.abs(current - expected) / Math.max(1e-9, l.initialIce + l.accumulated);
}

/** Debris closure: initial + eroded − deposited vs current debris in ice, relative. */
export function debrisClosure(l: GlacierLedger, current: number): number {
  const expected = l.initialDebris + l.eroded - l.deposited - l.debrisExported;
  return Math.abs(current - expected) / Math.max(1e-9, l.initialDebris + l.eroded);
}
