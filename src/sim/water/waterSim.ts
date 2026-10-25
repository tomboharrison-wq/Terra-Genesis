import type { WorldState } from '../../engine/world';
import type { Stepper } from '../../engine/clock';
import { emptyLedger, type WaterLedger } from './ledger';
import type { ClimateField } from '../climate/climate';
import { updateLow, updatePeak } from '../events/hazards';

const G = 9.81;

/**
 * Surface hydrology on the heightfield (spec E1).
 * Forcing (rain, sources, infiltration, evaporation) with an exact volume ledger, then lateral
 * routing by a local-inertial shallow-water scheme (Bates et al. 2010) in "virtual pipe" form:
 * each cell keeps a non-negative outflow discharge to each of its 4 neighbours, accelerated by
 * g·h_f·ΔH (h_f = flow depth at the face, ΔH = head difference), damped semi-implicitly by
 * Manning friction, then scaled so a cell can never send more than it holds (d ≥ 0 by
 * construction, volume conserved to float precision). Stable for dt ≤ α·cs/√(g·h_max).
 * Limits: depth-averaged, no inertia across cells beyond pipe flux memory, no sub-cell channels;
 * meanders/hydraulic jumps are not resolved at heightfield resolution.
 *
 * Conventions: water depth d ≥ 0 over the ground surface z (bedrock + loose sediment).
 * Cells whose ground is below sea level are sea: a fixed-head sink (depth kept 0; the sea plane
 * represents them). Volumes in m³, cell area A = cellSizeM².
 */
export class WaterSim implements Stepper {
  ledger: WaterLedger;
  /**
   * Float64 mirror of world.snowSweM: tiny per-step snowfall/melt on a deep pack would be lost to
   * float32 round-off. Re-seeded from the world field wherever that was changed externally.
   */
  private snow64: Float64Array;
  /** Spatial rain / evaporation factors (climate); null = uniform forcing. */
  climate: ClimateField | null = null;
  /** Cell-centred velocity components (m/s), x east, y north. Derived, not saved. */
  vx: Float32Array;
  vy: Float32Array;
  /** 1 where cell is sea (ground below sea level). Refreshed each step. */
  sea: Uint8Array;
  /** Depth at the start of the last routing pass (after forcing), for sediment advection. */
  prevDepth: Float32Array;
  maxDepth = 0;
  maxSpeed = 0;
  /** Largest step allowed regardless of CFL (s). */
  maxDt = 10;
  /** CFL safety factor. */
  cfl = 0.5;
  /**
   * Sea surge (m above sea level; hazards.ts): while > 0 the sea's fixed head is raised by this much
   * and sea cells send water onto the land next to them (ledgered as surgeIn).
   */
  surgeM = 0;
  /**
   * Event depth record: deepest water reached on each cell since recording began (floods), or the
   * shallowest when `recordLow` (droughts); null when not recording.
   */
  peakDepth: Float32Array | null = null;
  recordLow = false;

  constructor(
    private world: WorldState,
    private surface: Float32Array,
  ) {
    const n = world.width * world.height;
    this.vx = new Float32Array(n);
    this.vy = new Float32Array(n);
    this.sea = new Uint8Array(n);
    this.prevDepth = new Float32Array(n);
    this.snow64 = Float64Array.from(world.snowSweM);
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
    if (this.snow64) this.syncSnow();
    const snow = this.world.snowSweM;
    for (let i = 0; i < z.length; i++) {
      const s = z[i] < sl ? 1 : 0;
      this.sea[i] = s;
      if (s && d[i] > 0) {
        this.ledger && (this.ledger.seaOut += d[i] * this.cellArea);
        d[i] = 0;
      }
      if (s && snow[i] > 0) {
        this.ledger && (this.ledger.seaOut += (this.snow64 ? this.snow64[i] : snow[i]) * this.cellArea);
        snow[i] = 0;
        if (this.snow64) this.snow64[i] = 0;
      }
    }
  }

  /** All water held on the map: surface water + snowpack (m³). */
  storedVolume(): number {
    return this.surfaceVolume() + this.snowVolume();
  }

  surfaceVolume(): number {
    const d = this.world.waterDepthM;
    let v = 0;
    for (let i = 0; i < d.length; i++) v += d[i];
    return v * this.cellArea;
  }

  snowVolume(): number {
    this.syncSnow();
    const s = this.snow64;
    let v = 0;
    for (let i = 0; i < s.length; i++) v += s[i];
    return v * this.cellArea;
  }

  /** Adopt external changes to world.snowSweM (load, GPU sync, edits) into the float64 mirror. */
  private syncSnow() {
    const f = this.world.snowSweM;
    const s = this.snow64;
    for (let i = 0; i < f.length; i++) if (Math.fround(s[i]) !== f[i]) s[i] = f[i];
  }

  /** Set a cell's snowpack exactly (GPU sync folds deltas in float64 through this). */
  setSnow(i: number, v: number) {
    this.snow64[i] = v;
    this.world.snowSweM[i] = v;
  }

  snowAt(i: number): number {
    return Math.fround(this.snow64[i]) === this.world.snowSweM[i] ? this.snow64[i] : this.world.snowSweM[i];
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
      if (d[i] < 0.05) continue;
      const s = this.vx[i] * this.vx[i] + this.vy[i] * this.vy[i];
      if (s > ms) ms = s;
    }
    this.maxDepth = md;
    this.maxSpeed = Math.sqrt(ms);
  }

  /** CFL-limited step, quantised to maxDt / 2^k so it is a deterministic function of state. */
  stableDt(): number {
    const cs = this.world.cellSizeM;
    const c = Math.sqrt(G * Math.max(this.maxDepth, 0.05, this.surgeM)) + 0.5 * this.maxSpeed;
    const limit = (this.cfl * cs) / c;
    let dt = this.maxDt;
    for (let k = 0; k < 16 && dt > limit; k++) dt *= 0.5;
    return dt;
  }

  step(dt: number): void {
    this.applyForcing(dt);
    this.route(dt);
    if (this.peakDepth) (this.recordLow ? updateLow : updatePeak)(this.peakDepth, this.world.waterDepthM);
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
    const rf = this.climate?.rainFactor;
    const ef = this.climate?.evapFactor;
    const cl = this.climate;
    const snowOn = !!cl && w.climate.enabled;
    const snow = this.snow64;
    const snow32 = w.snowSweM;
    if (snowOn) this.syncSnow();
    if (p.rainMPerS > 0) {
      const add = p.rainMPerS * dt;
      let total = 0;
      let fell = 0;
      for (let i = 0; i < n; i++) {
        if (sea[i]) continue;
        const a = rf ? add * rf[i] : add;
        if (snowOn && cl.temperatureC[i] < 0) {
          snow[i] += a;
          snow32[i] = snow[i];
          fell += a;
        } else d[i] += a;
        total += a;
      }
      this.ledger.rainIn += total * A;
      this.ledger.snowfall += fell * A;
    }
    if (snowOn) {
      // Degree-day melt into surface water.
      const k = (w.climate.meltMmPerDegDay / 1000 / 86400) * dt;
      let melted = 0;
      for (let i = 0; i < n; i++) {
        const s = snow[i];
        const t = cl.temperatureC[i];
        if (s <= 0 || t <= 0) continue;
        const m = Math.min(s, k * t);
        snow[i] = s - m;
        snow32[i] = snow[i];
        d[i] += m;
        melted += m;
      }
      this.ledger.snowmelt += melted * A;
    }
    for (const s of p.sources) {
      if (s.x < 0 || s.y < 0 || s.x >= w.width || s.y >= w.height || s.rateM3PerS <= 0) continue;
      const i = s.y * w.width + s.x;
      const vol = s.rateM3PerS * dt;
      this.ledger.sourceIn += vol;
      if (sea[i]) this.ledger.seaOut += vol;
      else d[i] += vol / A;
    }
    if (p.infiltrationMPerS + p.evaporationMPerS > 0) {
      let inf = 0;
      let evap = 0;
      for (let i = 0; i < n; i++) {
        const di = d[i];
        if (di <= 0) continue;
        const ev = ef ? p.evaporationMPerS * ef[i] : p.evaporationMPerS;
        const rate = p.infiltrationMPerS + ev;
        if (rate <= 0) continue;
        const l = Math.min(di, rate * dt);
        d[i] = di - l;
        inf += l * (p.infiltrationMPerS / rate);
        evap += l * (ev / rate);
      }
      this.ledger.infiltrated += inf * A;
      this.ledger.evaporated += evap * A;
    }
  }

  /** Pipe-model lateral routing for one step (see class comment). */
  route(dt: number): void {
    const w = this.world;
    this.prevDepth.set(w.waterDepthM);
    const W = w.width;
    const H = w.height;
    const z = this.surface;
    const d = w.waterDepthM;
    const F = w.waterFluxM3PerS;
    const sea = this.sea;
    const vx = this.vx;
    const vy = this.vy;
    const cs = w.cellSizeM;
    const A = cs * cs;
    const sl = w.seaLevelM;
    const surge = this.surgeM;
    const slH = sl + surge; // head of the sea (raised during a surge)
    const open = w.water.boundary === 'open';
    const gdt = G * dt;
    const fr = (gdt * w.water.manningN * w.water.manningN) / cs;

    /** New outflow discharge (m³/s) through one face, local-inertial update. */
    const face = (fOld: number, Hi: number, zi: number, Hj: number, zj: number): number => {
      const hf = Math.max(Hi, Hj) - Math.max(zi, zj);
      if (hf <= 1e-6) return 0;
      const f = (fOld + gdt * hf * (Hi - Hj)) / (1 + (fr * fOld) / Math.pow(hf, 7 / 3));
      return f > 0 ? f : 0;
    };

    // Pass 1: update outflow fluxes from the current heads.
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        const o = i * 4;
        const di = d[i];
        if (sea[i] && surge > 0) {
          // Raised sea: an unlimited fixed-head source facing each land neighbour.
          const zs = Math.min(z[i], sl);
          F[o] = x > 0 && !sea[i - 1] ? face(F[o], slH, zs, z[i - 1] + d[i - 1], z[i - 1]) : 0;
          F[o + 1] = x < W - 1 && !sea[i + 1] ? face(F[o + 1], slH, zs, z[i + 1] + d[i + 1], z[i + 1]) : 0;
          F[o + 2] = y > 0 && !sea[i - W] ? face(F[o + 2], slH, zs, z[i - W] + d[i - W], z[i - W]) : 0;
          F[o + 3] = y < H - 1 && !sea[i + W] ? face(F[o + 3], slH, zs, z[i + W] + d[i + W], z[i + W]) : 0;
          continue;
        }
        if (sea[i] || di <= 0) {
          F[o] = F[o + 1] = F[o + 2] = F[o + 3] = 0;
          continue;
        }
        const zi = z[i];
        const Hi = zi + di;
        let f0 = 0;
        let f1 = 0;
        let f2 = 0;
        let f3 = 0;
        // Neighbour head/bed: sea cells are a fixed head at sea level (+ surge); open edges a free outfall.
        if (x > 0) {
          const j = i - 1;
          f0 = face(F[o], Hi, zi, sea[j] ? slH : z[j] + d[j], sea[j] ? Math.min(z[j], sl) : z[j]);
        } else if (open) f0 = face(F[o], Hi, zi, zi, zi);
        if (x < W - 1) {
          const j = i + 1;
          f1 = face(F[o + 1], Hi, zi, sea[j] ? slH : z[j] + d[j], sea[j] ? Math.min(z[j], sl) : z[j]);
        } else if (open) f1 = face(F[o + 1], Hi, zi, zi, zi);
        if (y > 0) {
          const j = i - W;
          f2 = face(F[o + 2], Hi, zi, sea[j] ? slH : z[j] + d[j], sea[j] ? Math.min(z[j], sl) : z[j]);
        } else if (open) f2 = face(F[o + 2], Hi, zi, zi, zi);
        if (y < H - 1) {
          const j = i + W;
          f3 = face(F[o + 3], Hi, zi, sea[j] ? slH : z[j] + d[j], sea[j] ? Math.min(z[j], sl) : z[j]);
        } else if (open) f3 = face(F[o + 3], Hi, zi, zi, zi);
        const outVol = (f0 + f1 + f2 + f3) * dt;
        const avail = di * A;
        if (outVol > avail) {
          const sc = avail / outVol;
          f0 *= sc;
          f1 *= sc;
          f2 *= sc;
          f3 *= sc;
        }
        F[o] = f0;
        F[o + 1] = f1;
        F[o + 2] = f2;
        F[o + 3] = f3;
      }
    }

    // Pass 2: apply net volume change, account sea/edge exits, derive velocities.
    let seaIn = 0;
    let surgeOut = 0;
    let edgeOut = 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        const o = i * 4;
        const inW = x > 0 ? F[(i - 1) * 4 + 1] : 0;
        const inE = x < W - 1 ? F[(i + 1) * 4] : 0;
        const inS = y > 0 ? F[(i - W) * 4 + 3] : 0;
        const inN = y < H - 1 ? F[(i + W) * 4 + 2] : 0;
        const inflow = inW + inE + inS + inN;
        if (sea[i]) {
          seaIn += inflow * dt;
          surgeOut += (F[o] + F[o + 1] + F[o + 2] + F[o + 3]) * dt;
          vx[i] = vy[i] = 0;
          continue;
        }
        const f0 = F[o];
        const f1 = F[o + 1];
        const f2 = F[o + 2];
        const f3 = F[o + 3];
        if (x === 0) edgeOut += f0 * dt;
        if (x === W - 1) edgeOut += f1 * dt;
        if (y === 0) edgeOut += f2 * dt;
        if (y === H - 1) edgeOut += f3 * dt;
        const dOld = d[i];
        let dNew = dOld + ((inflow - (f0 + f1 + f2 + f3)) * dt) / A;
        if (dNew < 0) dNew = 0; // only float round-off can reach here
        d[i] = dNew;
        const dm = 0.5 * (dOld + dNew);
        if (dm > 1e-3) {
          // Mean discharge through the cell (m³/s) → depth-averaged velocity.
          let u = (inW - f0 + f1 - inE) / (2 * cs * dm);
          let v = (inS - f2 + f3 - inN) / (2 * cs * dm);
          const s2 = u * u + v * v;
          if (s2 > 400) {
            const c = 20 / Math.sqrt(s2);
            u *= c;
            v *= c;
          }
          vx[i] = u;
          vy[i] = v;
        } else {
          vx[i] = vy[i] = 0;
        }
      }
    }
    this.ledger.seaOut += seaIn;
    this.ledger.surgeIn += surgeOut;
    this.ledger.edgeOut += edgeOut;
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
    const v = this.surfaceVolume();
    this.world.waterDepthM.fill(0);
    this.world.waterFluxM3PerS.fill(0);
    this.vx.fill(0);
    this.vy.fill(0);
    this.ledger.toolOut += v;
    this.refreshStats();
  }
}
