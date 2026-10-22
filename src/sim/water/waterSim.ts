import type { WorldState } from '../../engine/world';
import type { Stepper } from '../../engine/clock';
import { emptyLedger, type WaterLedger } from './ledger';

const G = 9.81;

/**
 * Surface hydrology on the heightfield (spec E1).
 * Phase 1 (this file, M02-C01): forcing — rainfall, fixed sources, infiltration, evaporation —
 * with an exact volume ledger. Lateral routing is added by the pipe-model flux step (M02-C02).
 *
 * Conventions: water depth d ≥ 0 over the ground surface z (bedrock + loose sediment).
 * Cells whose ground is below sea level are sea: a fixed-head sink (depth kept 0; the sea plane
 * represents them). Volumes in m³, cell area A = cellSizeM².
 */
export class WaterSim implements Stepper {
  ledger: WaterLedger;
  /** Cell-centred velocity components (m/s), x east, y north. Derived, not saved. */
  vx: Float32Array;
  vy: Float32Array;
  /** 1 where cell is sea (ground below sea level). Refreshed each step. */
  sea: Uint8Array;
  maxDepth = 0;
  maxSpeed = 0;
  /** Largest step allowed regardless of CFL (s). */
  maxDt = 10;

  constructor(private world: WorldState, private surface: Float32Array) {
    const n = world.width * world.height;
    this.vx = new Float32Array(n);
    this.vy = new Float32Array(n);
    this.sea = new Uint8Array(n);
    this.refreshSea();
    this.ledger = emptyLedger(this.storedVolume());
    this.refreshStats();
  }

  get cellArea() {
    return this.world.cellSizeM * this.world.cellSizeM;
  }

  refreshSea() {
    const z = this.surface;
    const sl = this.world.seaLevelM;
    const d = this.world.waterDepthM;
    for (let i = 0; i < z.length; i++) {
      const s = z[i] < sl ? 1 : 0;
      this.sea[i] = s;
      if (s && d[i] > 0) {
        this.ledger && (this.ledger.seaOut += d[i] * this.cellArea);
        d[i] = 0;
      }
    }
  }

  storedVolume(): number {
    const d = this.world.waterDepthM;
    let v = 0;
    for (let i = 0; i < d.length; i++) v += d[i];
    return v * this.cellArea;
  }

  resetLedger() {
    this.ledger = emptyLedger(this.storedVolume());
  }

  refreshStats() {
    const d = this.world.waterDepthM;
    let md = 0;
    let ms = 0;
    for (let i = 0; i < d.length; i++) {
      if (d[i] > md) md = d[i];
      const s = this.vx[i] * this.vx[i] + this.vy[i] * this.vy[i];
      if (s > ms) ms = s;
    }
    this.maxDepth = md;
    this.maxSpeed = Math.sqrt(ms);
  }

  /** CFL-limited step, quantised to maxDt / 2^k so it is a deterministic function of state. */
  stableDt(): number {
    const cs = this.world.cellSizeM;
    const c = Math.sqrt(G * Math.max(this.maxDepth, 0.05)) + this.maxSpeed;
    const limit = (0.45 * cs) / c;
    let dt = this.maxDt;
    for (let k = 0; k < 16 && dt > limit; k++) dt *= 0.5;
    return dt;
  }

  step(dt: number): void {
    this.applyForcing(dt);
    this.route(dt);
    this.refreshStats();
  }

  /** Rain, sources, infiltration and evaporation for one step. */
  applyForcing(dt: number): void {
    const w = this.world;
    const d = w.waterDepthM;
    const p = w.water;
    const A = this.cellArea;
    const n = d.length;
    const sea = this.sea;
    if (p.rainMPerS > 0) {
      const add = p.rainMPerS * dt;
      let cells = 0;
      for (let i = 0; i < n; i++) {
        if (sea[i]) continue;
        d[i] += add;
        cells++;
      }
      this.ledger.rainIn += cells * add * A;
    }
    for (const s of p.sources) {
      if (s.x < 0 || s.y < 0 || s.x >= w.width || s.y >= w.height || s.rateM3PerS <= 0) continue;
      const i = s.y * w.width + s.x;
      const vol = s.rateM3PerS * dt;
      this.ledger.sourceIn += vol;
      if (sea[i]) this.ledger.seaOut += vol;
      else d[i] += vol / A;
    }
    const lossRate = p.infiltrationMPerS + p.evaporationMPerS;
    if (lossRate > 0) {
      const fInf = p.infiltrationMPerS / lossRate;
      let lost = 0;
      for (let i = 0; i < n; i++) {
        const di = d[i];
        if (di <= 0) continue;
        const l = Math.min(di, lossRate * dt);
        d[i] = di - l;
        lost += l;
      }
      this.ledger.infiltrated += lost * A * fInf;
      this.ledger.evaporated += lost * A * (1 - fInf);
    }
  }

  /** Lateral routing; filled in by M02-C02. */
  route(_dt: number): void {
    void _dt;
  }

  /** Add (or with negative amount remove) water depth in a disc — rain/drain brush. Returns m³ moved. */
  addWaterDisc(cx: number, cy: number, radiusCells: number, depthM: number): number {
    const w = this.world;
    const d = w.waterDepthM;
    const A = this.cellArea;
    let moved = 0;
    const r = Math.ceil(radiusCells);
    for (let y = Math.max(0, Math.floor(cy) - r); y <= Math.min(w.height - 1, Math.ceil(cy) + r); y++) {
      for (let x = Math.max(0, Math.floor(cx) - r); x <= Math.min(w.width - 1, Math.ceil(cx) + r); x++) {
        const dist = Math.hypot(x - cx, y - cy) / Math.max(radiusCells, 1e-6);
        if (dist >= 1) continue;
        const i = y * w.width + x;
        if (this.sea[i]) continue;
        const wgt = 0.5 * (1 + Math.cos(Math.PI * dist));
        const delta = depthM * wgt;
        const next = Math.max(0, d[i] + delta);
        moved += (next - d[i]) * A;
        d[i] = next;
      }
    }
    if (moved >= 0) this.ledger.toolIn += moved;
    else this.ledger.toolOut += -moved;
    this.refreshStats();
    return moved;
  }

  clearWater() {
    const v = this.storedVolume();
    this.world.waterDepthM.fill(0);
    this.world.waterFluxM3PerS.fill(0);
    this.vx.fill(0);
    this.vy.fill(0);
    this.ledger.toolOut += v;
    this.refreshStats();
  }
}
