import { addTopRock, type WorldState } from '../../engine/world';
import type { CellRect } from '../../utils/rect';
import {
  BULK_FACTOR,
  CINDER_R0_M,
  FALL_L_PER_KM,
  coarseFraction,
  depositTephra,
  footprint,
  plumeHeightKm,
  settleLoose,
  type EruptionStyle,
  type Footprint,
} from './tephra';

/**
 * Lava flows (spec E10), CPU, explicit, real simulated time (seconds – days).
 *
 * State per cell: lava thickness h (m), mean temperature T (°C), lava kind (0 basalt, 1 andesite).
 * Vents erupt a volume rate Q (m³/s) at the eruption temperature into their cell.
 *
 * Flow — Bingham gravity current between the 4 neighbours, driven by the lava-surface slope
 * S = Δ(ground + h)/cs, sin α = S/√(1+S²), donor (upwind) thickness h:
 *   critical thickness  h_c = τ_y / (ρ g sin α)          (no flow while h ≤ h_c: lava has a yield strength)
 *   flux per unit width q = ρ g sin α h³ / (3 η) · (1 − 3a/2 + a³/2),  a = h_c / h   (Dragoni 1989; MAGFLOW)
 * Viscosity and yield strength stiffen as lava cools (exponential, a common lava-flow-model form):
 *   η = η₀ e^{b_η (T_e − T)},  τ_y = τ₀ e^{b_τ (T_e − T)};  lava at or below its solidus does not move.
 * Heat — transfers carry their donor's temperature (mixing by volume); every cell loses heat by
 *   radiation and convection from its top surface: ρ c h dT/dt = −[ε σ (T⁴ − T_a⁴) + h_c (T − T_a)],
 *   with h_c = 10 W/m²K in air and 500 W/m²K under water (quenching). No crust insulation is
 *   modelled, so the mean temperature falls like that of an uncrusted flow (fast for thin flows).
 * Solidification — lava at or below its solidus is frozen in place; Engine calls solidify() on a
 *   cadence to turn it into volcanic rock (a new top layer; buried soil becomes a weak sedimentary
 *   layer). Map edges are walls. Step: dt = 0.2·cs²/max(ρ g h³/3η), kept within 0.5 … 5 s. Each pair
 *   transfer is capped at an eighth of the lava-surface difference, so even with four donors or four
 *   receivers no cell overshoots its neighbours (where very thick runny lava near a vent would level
 *   out faster than 0.5 s, the cap levels it within the step instead); a donor never gives more than it has.
 * Ledger: erupted = flowing + solidified.
 * Vent styles: 'lava' (all magma as lava), 'explosive' (all as tephra, see tephra.ts), 'mixed' (half each).
 * The vent rate is the magma rate (dense rock, m³/s); tephra is laid on the solidify cadence.
 */
export type LavaKind = 'basalt' | 'andesite';

export interface LavaKindDef {
  label: string;
  eruptC: number;
  solidC: number;
  viscosityPaS: number;
  yieldPa: number;
  densityKgM3: number;
}

/** Teaching values within published ranges (basalt η 10²–10³ Pa·s, andesite 10⁶–10⁹ Pa·s). */
export const LAVA_KINDS: Record<LavaKind, LavaKindDef> = {
  basalt: { label: 'Basalt (runny)', eruptC: 1150, solidC: 900, viscosityPaS: 1e3, yieldPa: 100, densityKgM3: 2600 },
  andesite: { label: 'Andesite (sticky)', eruptC: 1050, solidC: 850, viscosityPaS: 1e8, yieldPa: 5e4, densityKgM3: 2500 },
};
const KIND_IDS: LavaKind[] = ['basalt', 'andesite'];
const B_ETA = 0.04;
const B_TAU = 0.03;
const SIGMA = 5.67e-8;
const EMISSIVITY = 0.95;
const HEAT_CAPACITY = 1150;
const H_AIR = 10;
const H_WATER = 500;
const G = 9.81;
const MAX_DT = 5;
const MIN_DT = 0.5;
const TEPHRA_INTERVAL_S = 600;
const HMIN = 1e-4;
export const VOLCANIC_ID = 5;
const BURIED_SOIL_ID = 2;

export interface LavaVent {
  id: number;
  x: number;
  y: number;
  rateM3PerS: number;
  kind: LavaKind;
  /** Eruption time left (s). */
  remainingS: number;
  /** How the magma comes out (older saves: 'lava'). */
  style?: EruptionStyle;
  /** Tephra erupted but not yet laid down (bulk m³). */
  pendingTephraM3?: number;
}

export interface LavaParams {
  vents: LavaVent[];
  /** Simulated seconds between solidification / tephra passes. */
  solidifyIntervalS: number;
  /** High-level wind speed carrying ash (m/s); direction from the climate wind. */
  windSpeedMS: number;
}

export function defaultLavaParams(): LavaParams {
  return { vents: [], solidifyIntervalS: 60, windSpeedMS: 10 };
}

/** Lava share of a vent's magma by style. */
export function lavaShare(style: EruptionStyle | undefined): number {
  return style === 'explosive' ? 0 : style === 'mixed' ? 0.5 : 1;
}

export interface LavaLedger {
  erupted: number;
  solidified: number;
  /** Ground volume changed by solidification (lava → rock), m³. */
  rockAdded: number;
  /** Tephra (bulk m³): erupted = deposited + off the map + pending in vents. */
  tephraErupted: number;
  tephraDeposited: number;
  tephraOffMap: number;
}

export function lavaKindDef(id: number): LavaKindDef {
  return LAVA_KINDS[KIND_IDS[id] ?? 'basalt'];
}

export class LavaSim {
  ledger: LavaLedger = { erupted: 0, solidified: 0, rockAdded: 0, tephraErupted: 0, tephraDeposited: 0, tephraOffMap: 0 };
  /** Wind the ash plume blows FROM (bearing, °); Engine keeps it equal to the climate wind. */
  windFromDeg = 240;
  private footprints = new Map<string, Footprint>();
  /** Ash too thin to register on a cell yet (m), see depositTephra. */
  readonly tephraResidual: Float64Array;
  /** Height of the last explosive column (km), for the panel. */
  lastPlumeKm = 0;
  private flux: Float32Array;
  private maxD = 0;
  private box: CellRect | null = null;
  private sinceSolid = 0;
  private sinceTephra = 0;
  /** Ambient air temperature per cell (°C), when a climate field is attached. */
  airC: Float32Array | null = null;
  /** 1 where the cell is sea (water sim's mask), for quenching. */
  sea: Uint8Array | null = null;

  constructor(
    private w: WorldState,
    private surface: Float32Array,
  ) {
    this.flux = new Float32Array(w.width * w.height * 4);
    this.tephraResidual = new Float64Array(w.width * w.height);
    this.ledger.erupted = this.flowingVolume();
    this.box = this.findBox();
  }

  get active(): boolean {
    return this.w.lava.vents.length > 0 || this.box !== null;
  }

  flowingVolume(): number {
    let v = 0;
    for (let i = 0; i < this.w.lavaDepthM.length; i++) v += this.w.lavaDepthM[i];
    return v * this.w.cellSizeM * this.w.cellSizeM;
  }

  /** Bounding box of lava + vents (or null). */
  private findBox(): CellRect | null {
    const w = this.w;
    let r: CellRect | null = null;
    const add = (x: number, y: number) => {
      if (!r) r = { x0: x, y0: y, x1: x + 1, y1: y + 1 };
      else {
        r.x0 = Math.min(r.x0, x);
        r.y0 = Math.min(r.y0, y);
        r.x1 = Math.max(r.x1, x + 1);
        r.y1 = Math.max(r.y1, y + 1);
      }
    };
    for (let i = 0; i < w.lavaDepthM.length; i++) if (w.lavaDepthM[i] > 0) add(i % w.width, (i / w.width) | 0);
    for (const v of w.lava.vents) add(v.x, v.y);
    return r;
  }

  /** Cells with lava or vents, grown by one cell (renderer redraw region). */
  get region(): CellRect | null {
    const b = this.box;
    if (!b) return null;
    return { x0: Math.max(0, b.x0 - 1), y0: Math.max(0, b.y0 - 1), x1: Math.min(this.w.width, b.x1 + 1), y1: Math.min(this.w.height, b.y1 + 1) };
  }

  /** Called after lava fields were replaced (load, vent edits). */
  refresh(): void {
    this.box = this.findBox();
  }

  stableDt(): number {
    if (!this.active) return Infinity;
    if (this.maxD <= 0) return MAX_DT;
    return Math.max(MIN_DT, Math.min(MAX_DT, (0.2 * this.w.cellSizeM * this.w.cellSizeM) / this.maxD));
  }

  addVent(x: number, y: number, rateM3PerS: number, kind: LavaKind, durationS: number, style: EruptionStyle = 'lava'): LavaVent {
    const id = this.w.lava.vents.reduce((m, v) => Math.max(m, v.id), 0) + 1;
    const v: LavaVent = { id, x, y, rateM3PerS, kind, remainingS: durationS, style, pendingTephraM3: 0 };
    this.w.lava.vents.push(v);
    this.box = this.findBox();
    return v;
  }

  /** Stop a vent (tephra it already produced is still laid down on the next pass). */
  removeVent(id: number): void {
    for (const v of this.w.lava.vents) if (v.id === id) v.remainingS = 0;
    this.w.lava.vents = this.w.lava.vents.filter((v) => v.remainingS > 0 || (v.pendingTephraM3 ?? 0) > 0);
    this.box = this.findBox();
  }

  /** Advance `seconds` in stable sub-steps. */
  advance(seconds: number): void {
    let left = seconds;
    while (left > 1e-9 && this.active) {
      const dt = Math.min(left, this.stableDt());
      this.step(dt);
      left -= dt;
    }
  }

  step(dt: number): void {
    if (!this.active || dt <= 0) return;
    const w = this.w;
    const W = w.width;
    const H = w.height;
    const cs = w.cellSizeM;
    const A = cs * cs;
    const h = w.lavaDepthM;
    const T = w.lavaTempC;
    const kind = w.lavaKind;
    const z = this.surface;
    // Vents: new lava at the eruption temperature.
    const vents = w.lava.vents;
    for (const v of vents) {
      const run = Math.min(dt, v.remainingS);
      v.remainingS -= dt;
      if (run <= 0) continue;
      const i = v.y * W + v.x;
      const kd = LAVA_KINDS[v.kind];
      const share = lavaShare(v.style);
      if (share < 1) {
        const t = (1 - share) * v.rateM3PerS * run * BULK_FACTOR;
        v.pendingTephraM3 = (v.pendingTephraM3 ?? 0) + t;
        this.ledger.tephraErupted += t;
      }
      if (share <= 0) continue;
      const add = (share * v.rateM3PerS * run) / A;
      const nh = Math.fround(h[i] + add);
      T[i] = (h[i] * T[i] + (nh - h[i]) * kd.eruptC) / nh;
      this.ledger.erupted += (nh - h[i]) * A;
      h[i] = nh;
      kind[i] = KIND_IDS.indexOf(v.kind);
    }
    // Finished vents leave once their last tephra has been laid down.
    w.lava.vents = vents.filter((v) => v.remainingS > 0 || (v.pendingTephraM3 ?? 0) > 0);
    const box = this.findBoxFast();
    this.box = box;
    if (!box) {
      this.maxD = 0;
      return;
    }
    const x0 = Math.max(0, box.x0 - 1);
    const y0 = Math.max(0, box.y0 - 1);
    const x1 = Math.min(W, box.x1 + 1);
    const y1 = Math.min(H, box.y1 + 1);
    const f = this.flux;
    const DX = [-1, 1, 0, 0];
    const DY = [0, 0, -1, 1];
    // Pass 1: outflows (m³ over dt), limited.
    for (let y = y0; y < y1; y++)
      for (let x = x0; x < x1; x++) {
        const i = y * W + x;
        const o = i * 4;
        f[o] = f[o + 1] = f[o + 2] = f[o + 3] = 0;
        const hi = h[i];
        if (hi <= HMIN) continue;
        const kd = lavaKindDef(kind[i]);
        if (T[i] <= kd.solidC) continue;
        const cool = kd.eruptC - T[i];
        const eta = kd.viscosityPaS * Math.exp(B_ETA * cool);
        const tau = kd.yieldPa * Math.exp(B_TAU * cool);
        const Hi = z[i] + hi;
        let total = 0;
        for (let k = 0; k < 4; k++) {
          const xn = x + DX[k];
          const yn = y + DY[k];
          if (xn < 0 || yn < 0 || xn >= W || yn >= H) continue;
          const j = yn * W + xn;
          const dH = Hi - (z[j] + h[j]);
          if (dH <= 0) continue;
          const S = dH / cs;
          const sinA = S / Math.sqrt(1 + S * S);
          const rhoGs = kd.densityKgM3 * G * sinA;
          const hc = tau / rhoGs;
          if (hi <= hc) continue;
          const a = hc / hi;
          const q = ((rhoGs * hi * hi * hi) / (3 * eta)) * (1 - 1.5 * a + 0.5 * a * a * a);
          const vol = Math.min(q * cs * dt, 0.125 * dH * A);
          f[o + k] = vol;
          total += vol;
        }
        if (total > hi * A) {
          const s = (hi * A) / total;
          for (let k = 0; k < 4; k++) f[o + k] *= s;
        }
      }
    // Pass 2: apply transfers with heat (energy per area = h·T).
    for (let y = y0; y < y1; y++)
      for (let x = x0; x < x1; x++) {
        const i = y * W + x;
        const o = i * 4;
        for (let k = 0; k < 4; k++) {
          const vol = f[o + k];
          if (vol <= 0) continue;
          const j = (y + DY[k]) * W + (x + DX[k]);
          const dh = vol / A;
          const before = h[j];
          const nj = Math.fround(before + dh);
          const moved = nj - before; // what actually arrived (float32)
          T[j] = before > 0 ? (before * T[j] + moved * T[i]) / nj : T[i];
          if (before <= HMIN) kind[j] = kind[i];
          h[j] = nj;
          h[i] = Math.max(0, Math.fround(h[i] - moved));
        }
      }
    // Pass 3: cooling, stability estimate, box.
    let maxD = 0;
    const air = this.airC;
    const sea = this.sea;
    const wd = w.waterDepthM;
    for (let y = y0; y < y1; y++)
      for (let x = x0; x < x1; x++) {
        const i = y * W + x;
        const hi = h[i];
        if (hi <= 0) continue;
        const kd = lavaKindDef(kind[i]);
        const Ta = air ? air[i] : 15;
        if (T[i] > Ta) {
          const Tk = T[i] + 273.15;
          const Tak = Ta + 273.15;
          const hcv = (sea && sea[i]) || wd[i] > 0.05 ? H_WATER : H_AIR;
          const loss = EMISSIVITY * SIGMA * (Tk ** 4 - Tak ** 4) + hcv * (T[i] - Ta);
          const dT = (loss * dt) / (kd.densityKgM3 * HEAT_CAPACITY * Math.max(hi, 0.01));
          T[i] = Math.max(Ta, T[i] - dT);
        }
        if (T[i] > kd.solidC) {
          const eta = kd.viscosityPaS * Math.exp(B_ETA * (kd.eruptC - T[i]));
          const D = (kd.densityKgM3 * G * hi * hi * hi) / (3 * eta);
          if (D > maxD) maxD = D;
        }
      }
    this.maxD = maxD;
    this.sinceSolid += dt;
    this.sinceTephra += dt;
  }

  /** Bounding box from the previous box grown by one (lava moves at most one cell per step). */
  private findBoxFast(): CellRect | null {
    const w = this.w;
    const W = w.width;
    const prev = this.box;
    if (!prev) return this.findBox();
    const x0 = Math.max(0, prev.x0 - 1);
    const y0 = Math.max(0, prev.y0 - 1);
    const x1 = Math.min(W, prev.x1 + 1);
    const y1 = Math.min(w.height, prev.y1 + 1);
    let r: CellRect | null = null;
    for (let y = y0; y < y1; y++)
      for (let x = x0; x < x1; x++)
        if (w.lavaDepthM[y * W + x] > 0) {
          if (!r) r = { x0: x, y0: y, x1: x + 1, y1: y + 1 };
          else {
            if (x < r.x0) r.x0 = x;
            if (y < r.y0) r.y0 = y;
            if (x + 1 > r.x1) r.x1 = x + 1;
            if (y + 1 > r.y1) r.y1 = y + 1;
          }
        }
    for (const v of w.lava.vents) {
      if (!r) r = { x0: v.x, y0: v.y, x1: v.x + 1, y1: v.y + 1 };
      else {
        r.x0 = Math.min(r.x0, v.x);
        r.y0 = Math.min(r.y0, v.y);
        r.x1 = Math.max(r.x1, v.x + 1);
        r.y1 = Math.max(r.y1, v.y + 1);
      }
    }
    return r;
  }

  /** True when a solidification pass is due (Engine then syncs ground and calls solidify()). */
  solidifyDue(): boolean {
    return this.box !== null && this.sinceSolid >= this.w.lava.solidifyIntervalS;
  }

  /**
   * Turn lava at or below its solidus into volcanic rock (new top layer; soil it buries becomes a
   * weak sedimentary layer). Hot lava burns plants and melts snow (snow → surface water).
   * Returns the changed rect (or null).
   */
  solidify(): CellRect | null {
    this.sinceSolid = 0;
    const box = this.box;
    if (!box) return null;
    const w = this.w;
    const W = w.width;
    const A = w.cellSizeM * w.cellSizeM;
    let r: CellRect | null = null;
    for (let y = box.y0; y < box.y1; y++)
      for (let x = box.x0; x < box.x1; x++) {
        const i = y * W + x;
        const hi = w.lavaDepthM[i];
        if (hi <= 0) continue;
        if (w.lavaTempC[i] > lavaKindDef(w.lavaKind[i]).solidC) {
          w.vegCover[i] = 0;
          if (w.snowSweM[i] > 0) {
            w.waterDepthM[i] = Math.fround(w.waterDepthM[i] + w.snowSweM[i]);
            w.snowSweM[i] = 0;
          }
          continue;
        }
        const before = w.bedrockElevationM[i] + w.looseSedimentThicknessM[i];
        const soil = w.looseSedimentThicknessM[i];
        if (soil > 0) {
          w.looseSedimentThicknessM[i] = 0;
          addTopRock(w, i, soil, BURIED_SOIL_ID);
        }
        addTopRock(w, i, hi, VOLCANIC_ID);
        w.vegCover[i] = 0;
        this.surface[i] = w.bedrockElevationM[i] + w.looseSedimentThicknessM[i];
        this.ledger.solidified += hi * A;
        this.ledger.rockAdded += (this.surface[i] - before) * A;
        w.lavaDepthM[i] = 0;
        w.lavaTempC[i] = 0;
        if (!r) r = { x0: x, y0: y, x1: x + 1, y1: y + 1 };
        else {
          r.x0 = Math.min(r.x0, x);
          r.y0 = Math.min(r.y0, y);
          r.x1 = Math.max(r.x1, x + 1);
          r.y1 = Math.max(r.y1, y + 1);
        }
      }
    this.box = this.findBox();
    return r;
  }

  /** Tephra is laid every TEPHRA_INTERVAL_S of simulated time, and at once when a vent stops. */
  tephraDue(): boolean {
    const vs = this.w.lava.vents;
    if (!vs.some((v) => (v.pendingTephraM3 ?? 0) > 0)) return false;
    return this.sinceTephra >= TEPHRA_INTERVAL_S || vs.some((v) => v.remainingS <= 0);
  }

  /**
   * Lay down the tephra each vent produced since the last pass (cinder near the vent settling to
   * the angle of repose, ash downwind). Returns the changed rect (or null).
   */
  layTephra(): CellRect | null {
    const w = this.w;
    this.sinceTephra = 0;
    let r: CellRect | null = null;
    const grow = (q: CellRect | null) => {
      if (!q) return;
      r = r ? { x0: Math.min(r.x0, q.x0), y0: Math.min(r.y0, q.y0), x1: Math.max(r.x1, q.x1), y1: Math.max(r.y1, q.y1) } : { ...q };
    };
    for (const v of w.lava.vents) {
      const bulk = v.pendingTephraM3 ?? 0;
      if (bulk <= 0) continue;
      v.pendingTephraM3 = 0;
      const H = plumeHeightKm((1 - lavaShare(v.style)) * v.rateM3PerS);
      this.lastPlumeKm = H;
      const fc = coarseFraction(H);
      const L = Math.max(w.cellSizeM, FALL_L_PER_KM * H);
      const e = 1 + w.lava.windSpeedMS / 5;
      const toDeg = (this.windFromDeg + 180) % 360;
      const key = (s: string) => `${s}:${v.x},${v.y}`;
      const cKey = key('c');
      const fKey = key(`f${H.toFixed(2)}:${e.toFixed(2)}:${toDeg.toFixed(1)}`);
      if (!this.footprints.has(cKey)) this.footprints.set(cKey, footprint(w, v.x, v.y, CINDER_R0_M, CINDER_R0_M, CINDER_R0_M, 0));
      if (!this.footprints.has(fKey)) {
        if (this.footprints.size > 32) this.footprints.clear();
        this.footprints.set(fKey, footprint(w, v.x, v.y, L * e, L / e, L, toDeg));
      }
      for (const [fp, part] of [
        [this.footprints.get(cKey)!, fc * bulk],
        [this.footprints.get(fKey)!, (1 - fc) * bulk],
      ] as const) {
        const res = depositTephra(w, this.surface, fp, part, this.tephraResidual);
        this.ledger.tephraDeposited += res.depositedM3;
        this.ledger.tephraOffMap += res.offMapM3;
        grow(res.rect);
      }
      // The cinder pile near the vent slides to its angle of repose.
      const rc = Math.ceil((6 * CINDER_R0_M) / w.cellSizeM);
      grow(
        settleLoose(w, this.surface, {
          x0: Math.max(0, v.x - rc),
          y0: Math.max(0, v.y - rc),
          x1: Math.min(w.width, v.x + rc + 1),
          y1: Math.min(w.height, v.y + rc + 1),
        }),
      );
    }
    w.lava.vents = w.lava.vents.filter((v) => v.remainingS > 0 || (v.pendingTephraM3 ?? 0) > 0);
    this.box = this.findBox();
    return r;
  }

  /** Tephra still waiting in vents or below a cell's float32 resolution (bulk m³). */
  pendingTephra(): number {
    let r = 0;
    for (const v of this.tephraResidual) r += v;
    return this.w.lava.vents.reduce((s, v) => s + (v.pendingTephraM3 ?? 0), 0) + r * this.w.cellSizeM * this.w.cellSizeM;
  }

  /** Hottest lava (°C), or null. */
  maxTemp(): number | null {
    let m = -Infinity;
    for (let i = 0; i < this.w.lavaDepthM.length; i++) if (this.w.lavaDepthM[i] > 0 && this.w.lavaTempC[i] > m) m = this.w.lavaTempC[i];
    return m === -Infinity ? null : m;
  }
}

/** Relative closure error of the lava volume ledger. */
export function lavaClosure(sim: LavaSim): number {
  const l = sim.ledger;
  return Math.abs(l.erupted - sim.flowingVolume() - l.solidified) / Math.max(1e-9, l.erupted);
}

/** Relative closure error of the tephra ledger. */
export function tephraClosure(sim: LavaSim): number {
  const l = sim.ledger;
  return Math.abs(l.tephraErupted - l.tephraDeposited - l.tephraOffMap - sim.pendingTephra()) / Math.max(1e-9, l.tephraErupted);
}
