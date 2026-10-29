import { refreshExposed, type WorldState } from '../../engine/world';
import { MATERIALS } from '../../terrain/materials';

/**
 * Geological time: a long-timescale landscape evolution model (years to millions of years), used
 * instead of the hydraulic solver when water time is far too slow (a 30 m grid needs ~1 s water
 * steps; a valley needs thousands of years). This is the standard reduced model of research
 * landscape evolution codes (e.g. FastScape, Landlab):
 *
 * - Rivers: detachment-limited stream power incision E = K·A^m·S^n with n = 1, solved implicitly
 *   along the drainage network (Braun & Willett 2013, Geomorphology 180–181) so any step length is
 *   stable and a cell never cuts below the cell it drains to. K is per-lithology (MATERIALS
 *   erodibility × kRef); loose soil erodes at kRef × soilFactor.
 * - Drainage: steepest descent (D8) over the depression-filled surface (priority-flood, Barnes et al.
 *   2014), so water crosses lakes and spills over saddles; drainage area A accumulates downstream.
 * - Sediment: everything eroded is routed downstream and deposited where flow stops — in closed
 *   hollows (up to their spill level: lake infill) and in the sea (up to 1 m below sea level, then
 *   onward to deeper water: deltas). Sediment reaching an open map edge, or the sea at any map edge
 *   (the sea continues beyond the map), leaves the map. Channels do
 *   not deposit on the way (no floodplain aggradation in this model — stated in the UI).
 * - Hillslopes: soil production from bare rock P = P0·erodibility·exp(−h/h0) (Heimsath et al. 1997)
 *   and linear soil creep q = −D·∇z, limited to the soil present (bare rock cliffs do not creep).
 * - Threshold hillslopes: over thousands of years slopes steeper than a critical angle fail by
 *   landslides and rockfall (Burbank et al. 1996, Nature 379; Montgomery 2001), so river incision
 *   makes V-shaped valleys rather than canyons. Critical angle per rock: criticalSlopeDeg(); the
 *   failed rock/soil lands at the slope foot as loose debris (mass conserved).
 * - Uplift: optional uniform rock uplift U of all land (base-level cells — sea and open edges — stay).
 *
 * Volumes are conserved exactly: Δ(rock + soil) = uplift − exported (rock and soil share one bulk
 * density, as in the water-time sediment model). Glaciers, waves, lava and plants do not act in
 * geological time.
 */
export interface GeoParams {
  /** Stream-power erodibility for weak sedimentary rock (erodibility 1), m^(1−2m)/yr. */
  kRef: number;
  /** Drainage-area exponent m (n = 1). */
  m: number;
  /** Channel erodibility multiplier where soil covers the rock (≥ soilCoverM thick). */
  soilFactor: number;
  /** Soil thinner than this lets the channel cut the rock beneath (m). */
  soilCoverM: number;
  /** Hillslope diffusivity D (m²/yr). */
  diffusivity: number;
  /** Maximum soil production on bare weak rock P0 (m/yr). */
  soilProduction: number;
  /** Soil production depth scale h0 (m). */
  soilDepthScaleM: number;
  /** Uniform rock uplift of land (mm/yr). */
  upliftMmYr: number;
  /** Threshold hillslope failure on (off only to test the river solver alone). */
  slopeFailure: boolean;
}

export function defaultGeoParams(): GeoParams {
  return { kRef: 1e-5, m: 0.5, soilFactor: 2, soilCoverM: 0.5, diffusivity: 0.01, soilProduction: 1e-4, soilDepthScaleM: 0.5, upliftMmYr: 0, slopeFailure: true };
}

/** Volumes moved by one step (m³). */
export interface GeoStepStats {
  years: number;
  erodedRock: number;
  erodedSoil: number;
  weathered: number;
  depositedLakes: number;
  depositedSea: number;
  exported: number;
  uplifted: number;
  /** Rock and soil moved down over-steep slopes by landslides / rockfall. */
  failed: number;
}

export const emptyGeoStats = (): GeoStepStats => ({ years: 0, erodedRock: 0, erodedSoil: 0, weathered: 0, depositedLakes: 0, depositedSea: 0, exported: 0, uplifted: 0, failed: 0 });

export function addGeoStats(a: GeoStepStats, b: GeoStepStats): void {
  for (const k of Object.keys(a) as (keyof GeoStepStats)[]) a[k] += b[k];
}

/**
 * Long-term stable hillslope angle (°) for a rock of relative erodibility e: 30° for weak mudstone,
 * steeper for strong rock (granite ≈ 52°), never steeper than the rock's cliff angle, never below 25°.
 */
export function criticalSlopeDeg(erodibility: number, cliffDeg: number): number {
  return Math.min(cliffDeg, Math.max(25, Math.min(55, 30 + 25 * (1 - erodibility))));
}

/** Sediment comes to rest this far below sea level before moving offshore (m). */
export const SEA_FILL_DEPTH_M = 1;
/** Filled-surface gradient across flats and lakes so every cell drains (m per cell). */
const EPS = 1e-4;

const DX = [1, -1, 0, 0, 1, 1, -1, -1];
const DY = [0, 0, 1, -1, 1, -1, 1, -1];
const DD = [1, 1, 1, 1, Math.SQRT2, Math.SQRT2, Math.SQRT2, Math.SQRT2];

export class LandscapeEvolution {
  readonly n: number;
  /** Drainage area (m², including the cell) from the last step. */
  readonly area: Float64Array;
  /** Receiver (cell drained to) or −1 for base level (sea, open edge, closed-map outlet). */
  readonly receiver: Int32Array;
  /** Cells in drainage order: every cell comes after its receiver. */
  readonly order: Int32Array;
  /** Depression-filled surface (m): lake level where the surface is a hollow. */
  readonly filled: Float64Array;
  /** Water level (m): lake surface in hollows, sea level at sea, else the ground (no epsilon). */
  readonly lake: Float64Array;
  private readonly dist: Float64Array;
  private readonly z: Float64Array;
  private readonly heapKey: Float64Array;
  private readonly heapIdx: Int32Array;
  private readonly done: Uint8Array;
  private readonly qs: Float64Array;
  private readonly flux: Float64Array;
  /** tan(critical slope) per material id. */
  private readonly tanCrit = MATERIALS.map((m) => Math.tan((criticalSlopeDeg(m.erodibility, m.cliffDeg) * Math.PI) / 180));

  constructor(readonly w: WorldState) {
    const n = (this.n = w.width * w.height);
    this.area = new Float64Array(n);
    this.receiver = new Int32Array(n);
    this.order = new Int32Array(n);
    this.filled = new Float64Array(n);
    this.lake = new Float64Array(n);
    this.dist = new Float64Array(n);
    this.z = new Float64Array(n);
    this.heapKey = new Float64Array(n);
    this.heapIdx = new Int32Array(n);
    this.done = new Uint8Array(n);
    this.qs = new Float64Array(n);
    this.flux = new Float64Array(n);
  }

  private isSea(i: number): boolean {
    return this.z[i] < this.w.seaLevelM;
  }

  /** Base level: sea cells, plus map-edge cells when the edges are open. */
  private isOutlet(i: number): boolean {
    if (this.isSea(i)) return true;
    if (this.w.water.boundary !== 'open') return false;
    const W = this.w.width;
    const x = i % W;
    const y = (i / W) | 0;
    return x === 0 || y === 0 || x === W - 1 || y === this.w.height - 1;
  }

  /** Recompute drainage (filled surface, receivers, order, area) from the current terrain. */
  route(): void {
    this.routed = true;
    const { w, n, z, filled, lake, receiver, order, done, area, dist } = this;
    const W = w.width;
    const H = w.height;
    const cs = w.cellSizeM;
    for (let i = 0; i < n; i++) z[i] = w.bedrockElevationM[i] + w.looseSedimentThicknessM[i];
    done.fill(0);
    let size = 0;
    const push = (i: number, k: number) => {
      let c = size++;
      while (c > 0) {
        const p = (c - 1) >> 1;
        if (this.heapKey[p] < k || (this.heapKey[p] === k && this.heapIdx[p] < i)) break;
        this.heapKey[c] = this.heapKey[p];
        this.heapIdx[c] = this.heapIdx[p];
        c = p;
      }
      this.heapKey[c] = k;
      this.heapIdx[c] = i;
    };
    const pop = (): number => {
      const top = this.heapIdx[0];
      const k = this.heapKey[--size];
      const i = this.heapIdx[size];
      let c = 0;
      for (;;) {
        let ch = 2 * c + 1;
        if (ch >= size) break;
        if (ch + 1 < size && (this.heapKey[ch + 1] < this.heapKey[ch] || (this.heapKey[ch + 1] === this.heapKey[ch] && this.heapIdx[ch + 1] < this.heapIdx[ch]))) ch++;
        if (this.heapKey[ch] > k || (this.heapKey[ch] === k && this.heapIdx[ch] > i)) break;
        this.heapKey[c] = this.heapKey[ch];
        this.heapIdx[c] = this.heapIdx[ch];
        c = ch;
      }
      this.heapKey[c] = k;
      this.heapIdx[c] = i;
      return top;
    };
    let seeded = 0;
    for (let i = 0; i < n; i++)
      if (this.isOutlet(i)) {
        filled[i] = z[i];
        lake[i] = this.isSea(i) ? w.seaLevelM : z[i];
        done[i] = 1;
        push(i, z[i]);
        seeded++;
      }
    if (seeded === 0) {
      // Closed map without sea: the lowest cell is the outlet (a terminal lake).
      let lo = 0;
      for (let i = 1; i < n; i++) if (z[i] < z[lo]) lo = i;
      filled[lo] = z[lo];
      lake[lo] = z[lo];
      done[lo] = 1;
      push(lo, z[lo]);
    }
    // Priority-flood with an epsilon gradient: pop order is a drainage order.
    let k = 0;
    while (size > 0) {
      const i = pop();
      order[k++] = i;
      const x = i % W;
      const y = (i / W) | 0;
      for (let d = 0; d < 8; d++) {
        const xn = x + DX[d];
        const yn = y + DY[d];
        if (xn < 0 || yn < 0 || xn >= W || yn >= H) continue;
        const j = yn * W + xn;
        if (done[j]) continue;
        done[j] = 1;
        filled[j] = Math.max(z[j], filled[i] + EPS * DD[d]);
        lake[j] = Math.max(z[j], lake[i]);
        push(j, filled[j]);
      }
    }
    // Receivers: steepest descent on the filled surface (always exists: the cell that flooded it is lower).
    for (let i = 0; i < n; i++) {
      receiver[i] = -1;
      if (this.isOutlet(i)) continue;
      const x = i % W;
      const y = (i / W) | 0;
      let best = 0;
      for (let d = 0; d < 8; d++) {
        const xn = x + DX[d];
        const yn = y + DY[d];
        if (xn < 0 || yn < 0 || xn >= W || yn >= H) continue;
        const j = yn * W + xn;
        const s = (filled[i] - filled[j]) / DD[d];
        if (s > best) {
          best = s;
          receiver[i] = j;
          dist[i] = DD[d] * cs;
        }
      }
    }
    area.fill(cs * cs);
    for (let q = n - 1; q >= 0; q--) {
      const i = order[q];
      const r = receiver[i];
      if (r >= 0) area[r] += area[i];
    }
  }

  private routed = false;

  /**
   * Longest accurate step (years): a knickpoint travels at c = K·A^m (n = 1), and the implicit
   * scheme stays stable for any step but smears a waterfall out when it would move more than
   * `courant` cells in one step. Uses the drainage of the last step.
   */
  accurateYears(p: GeoParams, courant = 2): number {
    if (!this.routed) this.route();
    const w = this.w;
    let cMax = 0;
    for (let i = 0; i < this.n; i++) {
      if (this.receiver[i] < 0) continue;
      const k = p.kRef * (w.looseSedimentThicknessM[i] >= p.soilCoverM ? p.soilFactor : MATERIALS[w.materialId[i]].erodibility);
      const c = (k * Math.pow(this.area[i], p.m)) / this.dist[i];
      if (c > cMax) cMax = c;
    }
    return cMax > 0 ? courant / cMax : Infinity;
  }

  /** Run `years` in steps no longer than maxStepYears or the accurate step; returns the summed volumes. */
  run(years: number, p: GeoParams, maxStepYears: number): GeoStepStats {
    const tot = emptyGeoStats();
    let left = years;
    while (left > 1e-9) {
      const dt = Math.min(left, maxStepYears, Math.max(10, this.accurateYears(p)));
      addGeoStats(tot, this.step(dt, p));
      left -= dt;
    }
    tot.years = years; // exact (the sum of steps carries round-off)
    return tot;
  }

  /** Advance the landscape by `years` (one implicit step). */
  step(years: number, p: GeoParams): GeoStepStats {
    const st = emptyGeoStats();
    st.years = years;
    const { w, n, z, receiver, order, area, dist, qs, lake } = this;
    const bed = w.bedrockElevationM;
    const soil = w.looseSedimentThicknessM;
    const cs = w.cellSizeM;
    const A = cs * cs;
    this.route();

    // 1. Uplift (land only; base level stays fixed).
    const U = (p.upliftMmYr / 1000) * years;
    if (U !== 0)
      for (let i = 0; i < n; i++)
        if (!this.isOutlet(i)) {
          const wasLake = lake[i] > z[i];
          bed[i] += U;
          z[i] += U;
          lake[i] = wasLake ? lake[i] + U : z[i];
          st.uplifted += U * A;
        }

    // 2. Stream power incision, implicit along the network from base level upwards.
    const zNew = this.flux; // reuse as scratch for the updated surface
    qs.fill(0);
    for (let q = 0; q < n; q++) {
      const i = order[q];
      const r = receiver[i];
      if (r < 0) {
        zNew[i] = z[i];
        continue;
      }
      // Rivers cut down to the water level they flow into (sea level, a lake surface), never below.
      const zr = lake[r] > z[r] ? Math.max(zNew[r], lake[r]) : zNew[r];
      if (z[i] <= zr || lake[i] > z[i]) {
        zNew[i] = z[i]; // hollow or flat below its outlet: no incision (deposition below)
        continue;
      }
      const onSoil = soil[i] >= p.soilCoverM;
      const k = p.kRef * (onSoil ? p.soilFactor : MATERIALS[w.materialId[i]].erodibility);
      const F = (k * years * Math.pow(area[i], p.m)) / dist[i];
      const zn = (z[i] + F * zr) / (1 + F);
      let e = z[i] - zn;
      // Remove soil first, then rock.
      const fromSoil = Math.min(soil[i], e);
      soil[i] -= fromSoil;
      e -= fromSoil;
      bed[i] -= e;
      st.erodedSoil += fromSoil * A;
      st.erodedRock += e * A;
      qs[i] += (fromSoil + e) * A;
      zNew[i] = bed[i] + soil[i];
    }

    // 2b. Threshold hillslopes: over-steep valley sides fail onto the slope foot.
    if (p.slopeFailure) st.failed = this.fail(4);

    // 3. Route sediment downstream; deposit in hollows (to the lake level) and in the sea.
    for (let q = n - 1; q >= 0; q--) {
      const i = order[q];
      let v = qs[i];
      if (v <= 0) continue;
      const zi = bed[i] + soil[i];
      if (this.isSea(i)) {
        qs[i] = 0;
        this.depositOffshore(i, v, st);
        continue;
      }
      const room = lake[i] > z[i] ? (lake[i] - zi) * A : 0; // a hollow: fill up to the spill level
      if (room > 0) {
        const d = Math.min(room, v);
        soil[i] += d / A;
        st.depositedLakes += d;
        v -= d;
      }
      qs[i] = 0;
      const r = receiver[i];
      if (v <= 0) continue;
      if (r >= 0) qs[r] += v;
      else if (w.water.boundary === 'open') st.exported += v; // leaves at an open map edge
      else {
        soil[i] += v / A; // terminal outlet of a closed map without sea
        st.depositedLakes += v;
      }
    }

    // 4. Soil production from rock, then soil creep (flux-limited to the soil present).
    if (p.soilProduction > 0)
      for (let i = 0; i < n; i++) {
        if (this.isSea(i)) continue;
        const e = MATERIALS[w.materialId[i]].erodibility;
        const prod = p.soilProduction * e * Math.exp(-soil[i] / p.soilDepthScaleM) * years;
        bed[i] -= prod;
        soil[i] += prod;
        st.weathered += prod * A;
      }
    if (p.diffusivity > 0) this.creep(years, p.diffusivity);

    for (let i = 0; i < n; i++) refreshExposed(w, i);
    return st;
  }

  /**
   * Over-steep slopes fail: where the drop to a neighbour exceeds the critical slope of the upper
   * cell's rock, half the excess moves down (soil first, then rock) as loose debris. `sweeps`
   * Gauss–Seidel passes in alternating directions. Returns the volume moved (m³).
   */
  private fail(sweeps: number): number {
    const w = this.w;
    const W = w.width;
    const H = w.height;
    const cs = w.cellSizeM;
    const A = cs * cs;
    const bed = w.bedrockElevationM;
    const soil = w.looseSedimentThicknessM;
    const sea = w.seaLevelM;
    let moved = 0;
    for (let s = 0; s < sweeps; s++) {
      const fwd = s % 2 === 0;
      for (let yy = 0; yy < H; yy++) {
        const y = fwd ? yy : H - 1 - yy;
        for (let xx = 0; xx < W; xx++) {
          const x = fwd ? xx : W - 1 - xx;
          const i = y * W + x;
          if (bed[i] + soil[i] <= sea) continue; // slope failure is a land process
          const tc = this.tanCrit[w.materialId[i]] ?? 1;
          for (let d = 0; d < 8; d++) {
            const xn = x + DX[d];
            const yn = y + DY[d];
            if (xn < 0 || yn < 0 || xn >= W || yn >= H) continue;
            const j = yn * W + xn;
            const dz = bed[i] + soil[i] - Math.max(sea, bed[j] + soil[j]); // a coastal cliff fails only to sea level
            const excess = dz - tc * DD[d] * cs;
            if (excess <= 0.01) continue;
            let m = excess / 2;
            const fromSoil = Math.min(soil[i], m);
            soil[i] -= fromSoil;
            m -= fromSoil;
            bed[i] -= m;
            soil[j] += fromSoil + m;
            moved += (fromSoil + m) * A;
          }
        }
      }
    }
    return moved;
  }

  /** Sediment arriving at sea cell i settles to SEA_FILL_DEPTH_M below sea level, the rest moves to deeper water. */
  private depositOffshore(start: number, v: number, st: GeoStepStats): void {
    const w = this.w;
    const W = w.width;
    const H = w.height;
    const bed = w.bedrockElevationM;
    const soil = w.looseSedimentThicknessM;
    const A = w.cellSizeM * w.cellSizeM;
    const top = w.seaLevelM - SEA_FILL_DEPTH_M;
    let i = start;
    for (let guard = 0; guard < 4 * (W + H) && v > 0; guard++) {
      const zi = bed[i] + soil[i];
      const room = (top - zi) * A;
      if (room > 0) {
        const d = Math.min(room, v);
        soil[i] += d / A;
        st.depositedSea += d;
        v -= d;
        if (v <= 0) return;
      }
      // The sea continues beyond the map edge: sediment reaching it there is carried offshore, off the map.
      const x = i % W;
      const y = (i / W) | 0;
      if (x === 0 || y === 0 || x === W - 1 || y === H - 1) {
        st.exported += v;
        return;
      }
      // Onward to the deepest lower neighbour; leave the map at an open edge.
      let next = -1;
      let low = bed[i] + soil[i];
      for (let d = 0; d < 8; d++) {
        const xn = x + DX[d];
        const yn = y + DY[d];
        if (xn < 0 || yn < 0 || xn >= W || yn >= H) {
          if (w.water.boundary === 'open') next = -2;
          continue;
        }
        const j = yn * W + xn;
        const zj = bed[j] + soil[j];
        if (zj < low && next !== -2) {
          low = zj;
          next = j;
        }
      }
      if (next === -2) {
        st.exported += v;
        return;
      }
      if (next < 0) break;
      i = next;
    }
    // A closed sea pit: the rest settles here.
    soil[i] += v / A;
    st.depositedSea += v;
  }

  /** Linear soil creep q = −D∇z between 4-neighbours, explicit with sub-steps, never moving more soil than a cell has. */
  private creep(years: number, D: number): void {
    const w = this.w;
    const W = w.width;
    const H = w.height;
    const cs = w.cellSizeM;
    const bed = w.bedrockElevationM;
    const soil = w.looseSedimentThicknessM;
    const z = this.z;
    const out = this.flux;
    const sub = Math.max(1, Math.ceil((D * years) / (0.2 * cs * cs)));
    const k = (D * (years / sub)) / (cs * cs);
    for (let s = 0; s < sub; s++) {
      for (let i = 0; i < this.n; i++) z[i] = bed[i] + soil[i];
      // Outgoing volume per cell (as thickness), then scale to the soil available.
      out.fill(0);
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          const i = y * W + x;
          if (x + 1 < W) this.edgeOut(i, i + 1, k, out);
          if (y + 1 < H) this.edgeOut(i, i + W, k, out);
        }
      const scale = this.qs; // reuse: limiter per cell
      for (let i = 0; i < this.n; i++) scale[i] = out[i] > soil[i] ? soil[i] / out[i] : 1;
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          const i = y * W + x;
          if (x + 1 < W) this.edgeMove(i, i + 1, k, scale);
          if (y + 1 < H) this.edgeMove(i, i + W, k, scale);
        }
    }
    this.qs.fill(0);
  }

  private edgeOut(i: number, j: number, k: number, out: Float64Array) {
    const d = k * (this.z[i] - this.z[j]);
    if (d > 0) out[i] += d;
    else out[j] -= d;
  }

  private edgeMove(i: number, j: number, k: number, scale: Float64Array) {
    const soil = this.w.looseSedimentThicknessM;
    let d = k * (this.z[i] - this.z[j]);
    if (d > 0) d *= scale[i];
    else d *= scale[j];
    soil[i] -= d;
    soil[j] += d;
    if (soil[i] < 0) soil[i] = 0;
    if (soil[j] < 0) soil[j] = 0;
  }
}
