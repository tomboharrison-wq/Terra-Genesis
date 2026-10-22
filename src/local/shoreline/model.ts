import { mulberry32 } from '../../utils/rng';

/**
 * Guided local model (spec E6): plan-view one-line shoreline model for sandy coasts — spits,
 * bay-mouth bars, lagoons and recurved spits. In the spirit of the Coastline Evolution Model
 * (Ashton, Murray & Arnoult 2001), written from the published method.
 *
 * Grid: NX × NY cells of size CELL_M (x along the regional coast, y seaward). Each cell holds a
 * sand fill fraction f ∈ [0, 1]: 1 = land, 0 = water, between = the shoreline passes through it.
 * A fraction f stands for f · CELL_M² · DEPTH_M of sand (DEPTH_M = active shoreface depth).
 *
 * Each step (dt = 1 day):
 *  1. Trace the shoreline: the outer boundary of {f > 0} seen from the open sea, walked from the
 *     left edge to the right edge with the sea on the left (Moore-neighbour tracing). Spits, bars
 *     and recurves are just parts of this path; a lagoon's shore, cut off from the sea, is not.
 *  2. Waves: today's deep-water approach angle φ₀ is drawn from the wave climate (asymmetry A =
 *     share from the left, highness U = share of high-angle waves, |φ₀| > 45°).
 *  3. Alongshore flux on each segment (CERC): Q = K · cos(θ)^1.2 · sin(θ), θ = angle between the
 *     wave source and the local shore normal (tangent smoothed over ±2 cells); Q = 0 where the
 *     coast faces away (cos θ ≤ 0) or is shadowed (a ray towards the waves hits land first).
 *     Round a convex corner (spit tip, headland) waves diffract: the first DIFFRACT_CELLS unexposed
 *     segments downdrift of an exposed one carry DIFFRACT_SHARE of its drift, fading linearly.
 *  4. Each shoreline cell gains (Q_in − Q_out)·dt; f > 1 spills the excess seaward into the water
 *     neighbour best aligned with the local shore normal (the coast builds out there), f < 0
 *     takes the deficit from the landward neighbour (the coast retreats). Spills go to side
 *     neighbours only, along normal + ½ × the arriving drift direction (a spit grows forward). Sand is conserved
 *     exactly; the left boundary is fed at the local transport rate (an endless updrift beach)
 *     when `supply` is on and the right boundary lets drift leave. A ledger books both.
 * Not tied to the world heightfield: this is a teaching model of shoreline shape.
 */

export const NX = 120;
export const NY = 72;
export const CELL_M = 50;
export const DEPTH_M = 10;
const CELL_V = CELL_M * CELL_M * DEPTH_M;

export interface ShorelineParams {
  /** Share of waves arriving from the left (drift to the right). */
  asymmetry: number;
  /** Share of high-angle waves (|φ₀| > 45°). */
  highness: number;
  /** Peak alongshore transport (m³/day) — sets the speed. */
  qMaxM3: number;
  /** Feed the left boundary at the transport rate (updrift beach). */
  supply: boolean;
  seed: number;
  /** Starting coast. */
  layout: 'bay' | 'spit' | 'cape';
}

export function defaultShorelineParams(): ShorelineParams {
  return { asymmetry: 0.8, highness: 0.2, qMaxM3: 1500, supply: true, seed: 3, layout: 'bay' };
}

/** Clockwise 8-neighbour ring starting north (+y = seaward). */
const RING: [number, number][] = [
  [0, 1],
  [1, 1],
  [1, 0],
  [1, -1],
  [0, -1],
  [-1, -1],
  [-1, 0],
  [-1, 1],
];

/** Diffraction reach (segments) and the share of the corner's drift that carries round it. */
const DIFFRACT_CELLS = 4;
const DIFFRACT_SHARE = 0.6;

const SIDES: [number, number][] = [
  [0, 1],
  [1, 0],
  [0, -1],
  [-1, 0],
];

export const COAST_Y = 40;
export const BAY = { x0: 44, x1: 84, y0: 14 };

export class ShorelineModel {
  f = new Float64Array(NX * NY);
  /** Fill at the start (to tell new sand from the original coast). */
  f0 = new Float64Array(NX * NY);
  day = 0;
  /** Sand fed in at the left boundary / carried out at the right (m³). */
  suppliedM3 = 0;
  exportedM3 = 0;
  initialM3 = 0;
  /** Last traced shoreline (cell indices) and per-segment flux (m³/day). */
  trace: number[] = [];
  flux: number[] = [];
  /** Today's deep-water wave angle (radians, + = from the left). */
  waveAngle = 0;
  private rnd: () => number;

  constructor(public p: ShorelineParams = defaultShorelineParams()) {
    this.rnd = mulberry32(p.seed);
    this.reset();
  }

  reset() {
    const p = this.p;
    this.rnd = mulberry32(p.seed);
    this.f.fill(0);
    for (let y = 0; y < NY; y++)
      for (let x = 0; x < NX; x++) {
        let coast = COAST_Y;
        if (p.layout === 'bay' && x >= BAY.x0 && x < BAY.x1) coast = BAY.y0;
        if (p.layout === 'spit' && x >= BAY.x0) coast = BAY.y0;
        if (p.layout === 'cape') coast = COAST_Y - 14 + Math.round(16 * Math.exp(-(((x - 50) / 10) ** 2)));
        this.f[y * NX + x] = y < coast ? 1 : y === coast ? 0.5 : 0;
      }
    this.day = 0;
    this.suppliedM3 = 0;
    this.exportedM3 = 0;
    this.initialM3 = this.sandM3();
    this.f0.set(this.f);
    this.traceShore();
  }

  sandM3(): number {
    let s = 0;
    for (let i = 0; i < this.f.length; i++) s += this.f[i];
    return s * CELL_V;
  }

  fill(x: number, y: number): number {
    if (x < 0 || x >= NX || y < 0) return 1; // beyond the sides and behind: land continues
    if (y >= NY) return 0;
    return this.f[y * NX + x];
  }

  /** Outer shoreline from the left edge to the right edge, sea on the left. */
  traceShore(): number[] {
    const f = this.f;
    let y0 = NY - 1;
    while (y0 > 0 && f[y0 * NX] <= 0) y0--;
    let cx = 0;
    let cy = y0;
    let bx = 0;
    let by = y0 + 1;
    const out = [cy * NX + cx];
    for (let n = 0; n < 8 * NX * NY && cx < NX - 1; n++) {
      let k = RING.findIndex(([dx, dy]) => dx === bx - cx && dy === by - cy);
      let found = false;
      for (let s = 1; s <= 8; s++) {
        const [dx, dy] = RING[(k + s) % 8];
        const nx = cx + dx;
        const ny = cy + dy;
        const inside = nx >= 0 && nx < NX && ny >= 0 && ny < NY && f[ny * NX + nx] > 0;
        if (inside) {
          const [pdx, pdy] = RING[(k + s - 1) % 8];
          bx = cx + pdx;
          by = cy + pdy;
          cx = nx;
          cy = ny;
          found = true;
          break;
        }
      }
      if (!found) break;
      k = 0;
      out.push(cy * NX + cx);
    }
    this.trace = out;
    return out;
  }

  /** Is the straight path from (x, y) towards (sx, sy) blocked by land within the grid? */
  private shadowed(x: number, y: number, sx: number, sy: number): boolean {
    for (let d = 2; d < 2 * (NX + NY); d += 0.5) {
      const px = Math.floor(x + sx * d + 0.5);
      const py = Math.floor(y + sy * d + 0.5);
      if (px < 0 || px >= NX || py >= NY || py < 0) return false;
      if (this.f[py * NX + px] >= 0.5) return true;
    }
    return false;
  }

  private drawWaveAngle(): number {
    const p = this.p;
    const high = this.rnd() < p.highness;
    const mag = high ? Math.PI / 4 + (this.rnd() * Math.PI) / 4 : (this.rnd() * Math.PI) / 4;
    return this.rnd() < p.asymmetry ? mag : -mag;
  }

  step(days = 1) {
    for (let d = 0; d < days; d++) this.stepDay();
  }

  private stepDay() {
    const p = this.p;
    const tr = this.traceShore();
    const n = tr.length;
    const phi = (this.waveAngle = this.drawWaveAngle());
    // Unit vector pointing to where the waves come from (+y = seaward; + angle = from the left).
    const sx = -Math.sin(phi);
    const sy = Math.cos(phi);
    const X = (k: number) => tr[Math.max(0, Math.min(n - 1, k))] % NX;
    const Y = (k: number) => Math.floor(tr[Math.max(0, Math.min(n - 1, k))] / NX);
    const flux: number[] = new Array(Math.max(0, n - 1)).fill(0);
    const exposed = new Uint8Array(Math.max(0, n - 1));
    for (let k = 0; k < n - 1; k++) {
      let tx = X(k + 2) + X(k + 1) - X(k) - X(k - 1);
      let ty = Y(k + 2) + Y(k + 1) - Y(k) - Y(k - 1);
      const tl = Math.hypot(tx, ty);
      if (tl < 1e-9) continue;
      tx /= tl;
      ty /= tl;
      const nxv = -ty; // sea on the left of travel
      const nyv = tx;
      const cosT = sx * nxv + sy * nyv;
      if (cosT <= 0) continue;
      const sinT = -(sx * tx + sy * ty);
      const mx = (X(k) + X(k + 1)) / 2 + nxv * 0.5;
      const my = (Y(k) + Y(k + 1)) / 2 + nyv * 0.5;
      if (this.shadowed(mx, my, sx, sy)) continue;
      exposed[k] = 1;
      flux[k] = p.qMaxM3 * 1.7 * Math.pow(cosT, 1.2) * sinT; // 1.7 ≈ 1 / max(cos^1.2·sin)
    }
    // Diffraction round convex corners: waves bend into the first few unexposed segments past an
    // exposed one, carrying the drift on round the corner with fading strength.
    for (let k = 0; k < n - 1; k++) {
      if (exposed[k]) continue;
      for (let j = 1; j <= DIFFRACT_CELLS; j++) {
        const a = k - j;
        const b = k + j;
        const w = DIFFRACT_SHARE * (1 - (j - 1) / DIFFRACT_CELLS);
        if (a >= 0 && exposed[a] && flux[a] > 0) {
          flux[k] = w * flux[a];
          break;
        }
        if (b < n - 1 && exposed[b] && flux[b] < 0) {
          flux[k] = w * flux[b];
          break;
        }
      }
    }
    this.flux = flux;
    const dv = new Map<number, number>();
    const add = (i: number, v: number) => dv.set(i, (dv.get(i) ?? 0) + v);
    for (let k = 0; k < n - 1; k++) {
      add(tr[k], -flux[k]);
      add(tr[k + 1], flux[k]);
    }
    if (n > 1) {
      // Left boundary: the updrift beach supplies what the first segment carries (if on).
      if (p.supply && flux[0] > 0) {
        add(tr[0], flux[0]);
        this.suppliedM3 += flux[0];
      }
      // Right boundary: drift leaves at the rate of the last segment.
      const out = flux[n - 2];
      if (out > 0) {
        add(tr[n - 1], -out);
        this.exportedM3 += out;
      } else if (out < 0) {
        // Drift to the left at the right edge: fed from beyond the edge only when supply is on.
        if (p.supply) {
          add(tr[n - 1], -out);
          this.suppliedM3 += -out;
        }
      }
      if (flux[0] < 0) {
        add(tr[0], flux[0]);
        this.exportedM3 += -flux[0];
      }
    }
    // Apply; keep the local seaward normal for spilling.
    const normal = new Map<number, [number, number]>();
    for (let k = 0; k < n; k++) {
      const tx = X(k + 1) - X(k - 1);
      const ty = Y(k + 1) - Y(k - 1);
      const tl = Math.hypot(tx, ty) || 1;
      const prev = normal.get(tr[k]) ?? [0, 0];
      normal.set(tr[k], [prev[0] - ty / tl, prev[1] + tx / tl]);
    }
    // Drift direction arriving at each cell (tie-break for where overfill builds the coast out).
    const drift = new Map<number, [number, number]>();
    for (let k = 0; k < n - 1; k++) {
      const q = flux[k];
      if (q === 0) continue;
      const to = q > 0 ? k + 1 : k;
      const from = q > 0 ? k : k + 1;
      const prev = drift.get(tr[to]) ?? [0, 0];
      drift.set(tr[to], [prev[0] + (X(to) - X(from)) * Math.abs(q), prev[1] + (Y(to) - Y(from)) * Math.abs(q)]);
    }
    for (const [i, v] of dv) this.f[i] += v / CELL_V;
    for (const i of dv.keys()) {
      const nr = normal.get(i) ?? [0, 1];
      const dr = drift.get(i) ?? [0, 0];
      const nl = Math.hypot(nr[0], nr[1]) || 1;
      const dl = Math.hypot(dr[0], dr[1]) || 1;
      this.settle(i, [nr[0] / nl + (0.5 * dr[0]) / dl, nr[1] / nl + (0.5 * dr[1]) / dl], 0);
    }
    this.day++;
  }

  /** Spill overfill seaward / take underfill from landward, along the local normal. */
  private settle(i: number, nrm: [number, number], depth: number) {
    const f = this.f;
    if (depth > 6) return;
    const x = i % NX;
    const y = Math.floor(i / NX);
    const order = SIDES.map(([dx, dy]) => ({ dx, dy, a: dx * nrm[0] + dy * nrm[1] }));
    if (f[i] > 1) {
      const ex = f[i] - 1;
      f[i] = 1;
      order.sort((a, b) => b.a - a.a);
      for (const o of order) {
        const nx = x + o.dx;
        const ny = y + o.dy;
        if (nx < 0 || nx >= NX || ny < 0 || ny >= NY) continue;
        const j = ny * NX + nx;
        if (f[j] >= 1) continue;
        f[j] += ex;
        if (f[j] > 1) this.settle(j, nrm, depth + 1);
        return;
      }
      f[i] += ex; // nowhere to go (boxed in): keep it
    } else if (f[i] < 0) {
      // Take the deficit from the nearest sand, landward first (radius 1, then 2): the coast retreats.
      let de = -f[i];
      f[i] = 0;
      for (let r = 1; r <= 2 && de > 0; r++) {
        const cand: { j: number; a: number }[] = [];
        for (let dy = -r; dy <= r; dy++)
          for (let dx = -r; dx <= r; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || nx >= NX || ny < 0 || ny >= NY) continue;
            const j = ny * NX + nx;
            if (f[j] > 0) cand.push({ j, a: (dx * nrm[0] + dy * nrm[1]) / Math.hypot(dx, dy) });
          }
        cand.sort((u, v) => u.a - v.a);
        for (const c of cand) {
          const take = Math.min(de, f[c.j]);
          f[c.j] -= take;
          de -= take;
          if (de <= 0) break;
        }
      }
      f[i] -= de; // only if no sand within 2 cells (not reached in practice; caught by tests)
    }
  }

  /**
   * Spit measures for sand built out from the headland corner (land cells, f ≥ 0.5, east of
   * BAY.x0 and more than 2 cells above the bay floor): tip = furthest cell along the coast,
   * crest = most seaward row, hook = how far the last 5 columns reach landward of the crest.
   */
  spitStats(): { cells: number; tipX: number; crestY: number; hookDepth: number } {
    let cells = 0;
    let tipX = -1;
    let crestY = -1;
    for (let y = BAY.y0 + 3; y < NY; y++)
      for (let x = BAY.x0; x < NX; x++)
        if (this.f[y * NX + x] >= 0.5) {
          cells++;
          tipX = Math.max(tipX, x);
          crestY = Math.max(crestY, y);
        }
    let low = crestY;
    for (let y = BAY.y0 + 3; y < NY; y++)
      for (let x = Math.max(BAY.x0, tipX - 4); x <= tipX; x++) if (this.f[y * NX + x] >= 0.5) low = Math.min(low, y);
    return { cells, tipX, crestY, hookDepth: cells ? crestY - low : 0 };
  }

  /**
   * Lagoon: water cells (f < 0.5) the open sea (top edge) cannot reach through sand-free cells
   * (f = 0) — the same rule that decides where waves can reach the shore.
   */
  lagoonCells(): number {
    const f = this.f;
    const seen = new Uint8Array(NX * NY);
    const q: number[] = [];
    for (let x = 0; x < NX; x++) {
      const i = (NY - 1) * NX + x;
      if (f[i] <= 0) {
        seen[i] = 1;
        q.push(i);
      }
    }
    for (let k = 0; k < q.length; k++) {
      const i = q[k];
      const x = i % NX;
      const y = Math.floor(i / NX);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || nx >= NX || ny < 0 || ny >= NY) continue;
        const j = ny * NX + nx;
        if (!seen[j] && f[j] <= 0) {
          seen[j] = 1;
          q.push(j);
        }
      }
    }
    let n = 0;
    for (let i = 0; i < f.length; i++) if (f[i] < 0.5 && !seen[i]) n++;
    this.lagoonMask = seen;
    return n;
  }

  /** After lagoonCells(): 1 where water is reachable from the open sea. */
  lagoonMask = new Uint8Array(0);
}
