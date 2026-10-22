import type { WorldState } from '../../engine/world';
import { MATERIALS } from '../../terrain/materials';
import type { WaterSim } from '../water/waterSim';

/** Cumulative sediment accounting (m³ bulk volume) since reset. */
export interface SedimentLedger {
  erodedLoose: number;
  erodedBedrock: number;
  /** Settled back onto land (loose sediment). */
  deposited: number;
  /** Settled onto the sea floor (delta / shelf building). */
  seaDeposited: number;
  /** Carried off open map edges. */
  edgeExport: number;
  initialSuspended: number;
}

export function emptySedimentLedger(initialSuspended = 0): SedimentLedger {
  return { erodedLoose: 0, erodedBedrock: 0, deposited: 0, seaDeposited: 0, edgeExport: 0, initialSuspended };
}

/** Suspended volume the ledger predicts. */
export function expectedSuspended(l: SedimentLedger): number {
  return l.initialSuspended + l.erodedLoose + l.erodedBedrock - l.deposited - l.seaDeposited - l.edgeExport;
}

export function sedimentClosure(l: SedimentLedger, suspended: number): number {
  const scale = Math.max(1e-9, l.initialSuspended + l.erodedLoose + l.erodedBedrock);
  return Math.abs(suspended - expectedSuspended(l)) / scale;
}

/** Below this water depth (m) flow cannot hold sediment: everything settles. */
export const MIN_TRANSPORT_DEPTH = 1e-3;
/** Slope floor/ceiling used in the capacity law. */
export const SLOPE_MIN = 5e-4;
export const SLOPE_MAX = 1.0;

/**
 * Hydraulic erosion, suspended transport and deposition (spec E2) on top of WaterSim.
 * Call step(dt) immediately after water.step(dt). Per step:
 *  1. Advection — suspended sediment leaves each cell in exactly the proportion the water did
 *     (same face discharges as the water solver, upwind concentration s/d): conservative and
 *     positive. Sediment entering a sea cell settles there (raises the sea floor → deltas);
 *     sediment leaving an open map edge is exported.
 *  2. Exchange — capacity C = capacityK·q·S. If s < C, erode min(demand, available): loose
 *     sediment first, then bedrock at (lithology erodibility × bedrockFactor). If s > C, deposit
 *     depositK·(s − C) as loose sediment. Rates × speedup. Where d < 1 mm, all suspended settles.
 * Bedrock change is booked as the exact float32 difference actually applied, so the sediment
 * ledger closes to round-off even where elevation precision is coarse.
 * Limits: single grain class, no bedload/armouring, no lateral bank erosion beyond what the
 * slope/flow fields produce; landforms are approximate at heightfield resolution.
 */
export class SedimentSim {
  ledger: SedimentLedger;
  private buf: Float32Array;
  /** Per-material bedrock erodibility lookup. */
  private erod = new Float32Array(256);

  constructor(private world: WorldState, private surface: Float32Array, private water: WaterSim) {
    this.buf = new Float32Array(world.width * world.height);
    for (const m of MATERIALS) this.erod[m.id] = m.erodibility;
    this.ledger = emptySedimentLedger(this.suspendedVolume());
  }

  suspendedVolume(): number {
    const s = this.world.sedimentSuspendedM;
    let v = 0;
    for (let i = 0; i < s.length; i++) v += s[i];
    return v * this.world.cellSizeM * this.world.cellSizeM;
  }

  resetLedger() {
    this.ledger = emptySedimentLedger(this.suspendedVolume());
  }

  step(dt: number): void {
    if (!this.world.erosion.enabled) return;
    this.advect(dt);
    this.exchange(dt);
  }

  private advect(dt: number) {
    const w = this.world;
    const W = w.width;
    const H = w.height;
    const A = w.cellSizeM * w.cellSizeM;
    const F = w.waterFluxM3PerS;
    const s = w.sedimentSuspendedM;
    const d0 = this.water.prevDepth;
    const sea = this.water.sea;
    const loose = w.looseSedimentThicknessM;
    const b = w.bedrockElevationM;
    const z = this.surface;
    const next = this.buf;
    next.fill(0);
    let edge = 0;
    let seaDep = 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        const si = s[i];
        if (si <= 0) continue;
        if (sea[i]) {
          // Suspended load already in a sea cell settles there.
          loose[i] += si;
          z[i] = b[i] + loose[i];
          seaDep += si;
          continue;
        }
        const o = i * 4;
        const vol = d0[i] * A;
        // Fraction of this cell's water that left through each face this step.
        const k = vol > 0 ? (si * dt) / vol : 0;
        const out0 = F[o] * k;
        const out1 = F[o + 1] * k;
        const out2 = F[o + 2] * k;
        const out3 = F[o + 3] * k;
        next[i] += si - (out0 + out1 + out2 + out3);
        if (x > 0) next[i - 1] += out0;
        else edge += out0;
        if (x < W - 1) next[i + 1] += out1;
        else edge += out1;
        if (y > 0) next[i - W] += out2;
        else edge += out2;
        if (y < H - 1) next[i + W] += out3;
        else edge += out3;
      }
    }
    // Sediment arriving in sea cells settles on the sea floor.
    for (let i = 0; i < next.length; i++) {
      let v = next[i];
      if (v < 0) v = 0; // round-off only
      if (sea[i] && v > 0) {
        loose[i] += v;
        z[i] = b[i] + loose[i];
        seaDep += v;
        v = 0;
      }
      s[i] = v;
    }
    this.ledger.edgeExport += edge * A;
    this.ledger.seaDeposited += seaDep * A;
  }

  private exchange(dt: number) {
    const w = this.world;
    const W = w.width;
    const H = w.height;
    const cs = w.cellSizeM;
    const A = cs * cs;
    const p = w.erosion;
    const z = this.surface;
    const d = w.waterDepthM;
    const s = w.sedimentSuspendedM;
    const b = w.bedrockElevationM;
    const loose = w.looseSedimentThicknessM;
    const mat = w.materialId;
    const vx = this.water.vx;
    const vy = this.water.vy;
    const sea = this.water.sea;
    const ke = Math.min(1, p.erodeK * p.speedup * dt);
    const kd = Math.min(1, p.depositK * p.speedup * dt);
    let eL = 0;
    let eB = 0;
    let dep = 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (sea[i]) continue;
        const di = d[i];
        const si = s[i];
        if (di < MIN_TRANSPORT_DEPTH) {
          if (si > 0) {
            loose[i] += si;
            dep += si;
            s[i] = 0;
            z[i] = b[i] + loose[i];
          }
          continue;
        }
        const xl = x > 0 ? x - 1 : x;
        const xr = x < W - 1 ? x + 1 : x;
        const yd = y > 0 ? y - 1 : y;
        const yu = y < H - 1 ? y + 1 : y;
        const sx = (z[y * W + xr] - z[y * W + xl]) / ((xr - xl) * cs);
        const sy = (z[yu * W + x] - z[yd * W + x]) / ((yu - yd) * cs);
        let S = Math.sqrt(sx * sx + sy * sy);
        S = S < SLOPE_MIN ? SLOPE_MIN : S > SLOPE_MAX ? SLOPE_MAX : S;
        const q = di * Math.sqrt(vx[i] * vx[i] + vy[i] * vy[i]);
        const C = p.capacityK * q * S;
        if (si < C) {
          let demand = ke * (C - si);
          const fromLoose = Math.min(loose[i], demand);
          loose[i] -= fromLoose;
          demand -= fromLoose;
          let fromRock = 0;
          if (demand > 0) {
            const want = demand * this.erod[mat[i]] * p.bedrockFactor;
            const nb = Math.fround(b[i] - want);
            fromRock = b[i] - nb; // exactly what float32 storage removed
            b[i] = nb;
          }
          s[i] = si + fromLoose + fromRock;
          eL += fromLoose;
          eB += fromRock;
        } else if (si > C) {
          const amt = kd * (si - C);
          s[i] = si - amt;
          loose[i] += amt;
          dep += amt;
        } else continue;
        z[i] = b[i] + loose[i];
      }
    }
    this.ledger.erodedLoose += eL * A;
    this.ledger.erodedBedrock += eB * A;
    this.ledger.deposited += dep * A;
    // Sea mask may change where deposits emerge above / incision cuts below sea level.
    this.water.refreshSea();
  }
}
