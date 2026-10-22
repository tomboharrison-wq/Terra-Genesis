import { refreshExposed, type WorldState } from '../../engine/world';
import { MATERIALS, LOOSE_REPOSE_DEG } from '../../terrain/materials';
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
  /** Bedrock converted to loose regolith by weathering (internal transfer, informational). */
  weathered: number;
  /** Bedrock converted to rubble by cliff failure (internal transfer, informational). */
  rockfall: number;
}

export function emptySedimentLedger(initialSuspended = 0): SedimentLedger {
  return { erodedLoose: 0, erodedBedrock: 0, deposited: 0, seaDeposited: 0, edgeExport: 0, initialSuspended, weathered: 0, rockfall: 0 };
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
 * Saturation proxy for slope stability (until a soil-moisture model exists, spec M06):
 * wet = min(1, max(surface water depth / SATURATION_DEPTH, rain intensity / SATURATION_RAIN)).
 */
export const SATURATION_DEPTH = 0.01;
export const SATURATION_RAIN = 20 / 3.6e6; // 20 mm/h
/** Fraction of the excess over the stable angle removed per step (avalanche / rockfall). */
export const FAILURE_RATE = 0.2;
/** Saturation lowers tan(stable angle) by this fraction for loose sediment / bedrock. */
export const WET_LOOSE_WEAKENING = 0.35;
export const WET_ROCK_WEAKENING = 0.2;
export const TAN_LOOSE = Math.tan((LOOSE_REPOSE_DEG * Math.PI) / 180);

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
  private zSnap: Float32Array;
  private looseSnap: Float32Array;
  /** Per-material bedrock erodibility and tan(critical cliff angle) lookups. */
  private erod = new Float32Array(256);
  private tanCliff = new Float32Array(256);
  private bSnap: Float32Array;
  private wet: Float32Array;
  /**
   * Weathering demand not yet applied to bedrock (m). Per-step regolith production is often
   * below float32 resolution at high elevations; it accumulates here until it registers, so the
   * long-run rate is exact. Mirrored in the GPU bed texture's alpha channel.
   */
  weatherPending: Float32Array;

  constructor(private world: WorldState, private surface: Float32Array, private water: WaterSim) {
    this.buf = new Float32Array(world.width * world.height);
    this.zSnap = new Float32Array(world.width * world.height);
    this.looseSnap = new Float32Array(world.width * world.height);
    for (const m of MATERIALS) {
      this.erod[m.id] = m.erodibility;
      this.tanCliff[m.id] = Math.tan((m.cliffDeg * Math.PI) / 180);
    }
    this.bSnap = new Float32Array(world.width * world.height);
    this.wet = new Float32Array(world.width * world.height);
    this.weatherPending = new Float32Array(world.width * world.height);
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
    // Slope processes use the state at the start of the step (Jacobi), as in the GPU port.
    this.zSnap.set(this.surface);
    this.looseSnap.set(this.world.looseSedimentThicknessM);
    this.bSnap.set(this.world.bedrockElevationM);
    const d0 = this.water.prevDepth;
    const sea = this.water.sea;
    const rainWet = this.world.water.rainMPerS / SATURATION_RAIN;
    const rf = this.water.climate?.rainFactor;
    for (let i = 0; i < this.wet.length; i++) this.wet[i] = sea[i] ? 1 : Math.min(1, Math.max(d0[i] / SATURATION_DEPTH, rf ? rainWet * rf[i] : rainWet));
    this.creep(dt);
    this.rockfallAndWeathering(dt);
    this.advect(dt);
    this.exchange(dt);
  }

  /** Dimensionless creep coefficient κ = K·speedup·dt/cs², capped for explicit stability. */
  static creepKappa(w: WorldState, dt: number): number {
    return Math.min(0.125, (w.erosion.creepK * w.erosion.speedup * dt) / (w.cellSizeM * w.cellSizeM));
  }

  /**
   * Hillslope creep + loose-sediment avalanching: each face moves
   *   min(κ·Δz + FAILURE_RATE·max(0, Δz − cs·tanφ_eff)/4, loose_donor/4)
   * from the higher (donor) to the lower cell, where tanφ_eff = tan(33°)·(1 − 0.35·wet_donor).
   * Pairwise from start-of-step values ⇒ exactly conservative, never more than a donor holds.
   * Map edges are closed.
   */
  private creep(dt: number) {
    const w = this.world;
    const kappa = SedimentSim.creepKappa(w, dt);
    const aval = w.erosion.slopeFailure;
    if (kappa <= 0 && !aval) return;
    const cs = w.cellSizeM;
    const wet = this.wet;
    const W = w.width;
    const H = w.height;
    const zs = this.zSnap;
    const ls = this.looseSnap;
    const loose = w.looseSedimentThicknessM;
    const b = w.bedrockElevationM;
    const z = this.surface;
    const amount = (dz: number, donor: number) => {
      let a = kappa * dz;
      if (aval) {
        const excess = dz - cs * TAN_LOOSE * (1 - WET_LOOSE_WEAKENING * wet[donor]);
        if (excess > 0) a += 0.25 * FAILURE_RATE * excess;
      }
      return Math.min(a, 0.25 * ls[donor]);
    };
    const face = (i: number, j: number) => {
      const dz = zs[i] - zs[j];
      return dz > 0 ? amount(dz, i) : -amount(-dz, j);
    };
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        let net = 0; // positive = this cell loses
        if (x > 0) net += face(i, i - 1);
        if (x < W - 1) net += face(i, i + 1);
        if (y > 0) net += face(i, i - W);
        if (y < H - 1) net += face(i, i + W);
        if (net !== 0) {
          loose[i] = Math.max(0, ls[i] - net);
          z[i] = b[i] + loose[i];
        }
      }
    }
  }

  /**
   * Per cell, from start-of-step values: (1) rockfall — if the drop to the lowest neighbouring
   * bedrock exceeds cs·tan(cliff angle of the exposed rock)·(1 − 0.2·wet), FAILURE_RATE of the
   * excess becomes loose rubble; (2) weathering — bedrock → regolith at
   * weatherK·speedup·erodibility·(1 + wet)·exp(−soil/soilScale)·dt. Both are bedrock → loose
   * transfers booked as the exact float32 change applied.
   */
  private rockfallAndWeathering(dt: number) {
    const w = this.world;
    const p = w.erosion;
    const W = w.width;
    const H = w.height;
    const cs = w.cellSizeM;
    const A = cs * cs;
    const b = w.bedrockElevationM;
    const bs = this.bSnap;
    const ls = this.looseSnap;
    const loose = w.looseSedimentThicknessM;
    const z = this.surface;
    const mat = w.materialId;
    const wet = this.wet;
    const wRate = p.weatherK * p.speedup * dt;
    let fallSum = 0;
    let weatherSum = 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        const m = mat[i];
        const bi = bs[i];
        let changed = false;
        if (p.slopeFailure) {
          let low = bi;
          if (x > 0) low = Math.min(low, bs[i - 1]);
          if (x < W - 1) low = Math.min(low, bs[i + 1]);
          if (y > 0) low = Math.min(low, bs[i - W]);
          if (y < H - 1) low = Math.min(low, bs[i + W]);
          const excess = bi - low - cs * this.tanCliff[m] * (1 - WET_ROCK_WEAKENING * wet[i]);
          if (excess > 0) {
            const nb = Math.fround(b[i] - FAILURE_RATE * excess);
            const act = b[i] - nb;
            b[i] = nb;
            loose[i] += act;
            fallSum += act;
            changed = true;
          }
        }
        if (wRate > 0) {
          const pend = Math.fround(this.weatherPending[i] + wRate * this.erod[m] * (1 + wet[i]) * Math.exp(-ls[i] / p.soilScaleM));
          const nb = Math.fround(b[i] - pend);
          const act = b[i] - nb;
          this.weatherPending[i] = Math.fround(pend - act);
          if (act > 0) {
            b[i] = nb;
            loose[i] += act;
            weatherSum += act;
            changed = true;
          }
        }
        if (changed) {
          z[i] = b[i] + loose[i];
          refreshExposed(w, i);
        }
      }
    }
    this.ledger.rockfall += fallSum * A;
    this.ledger.weathered += weatherSum * A;
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
    const zs = this.zSnap;
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
        const sx = (zs[y * W + xr] - zs[y * W + xl]) / ((xr - xl) * cs);
        const sy = (zs[yu * W + x] - zs[yd * W + x]) / ((yu - yd) * cs);
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
            refreshExposed(w, i); // cutting through a strata boundary exposes the next layer
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
