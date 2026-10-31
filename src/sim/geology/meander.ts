import { refreshExposed, type WorldState } from '../../engine/world';
import { MATERIALS } from '../../terrain/materials';

/**
 * Meandering lowland river (geological time). The channel is a centreline that migrates sideways
 * by bank erosion on the outside of bends and deposition (point bars) on the inside — the
 * Howard & Knutson (1984) model, Water Resources Research 20(11):
 *
 *   migration rate M(s) = E · R1(s),  R1 = Ω·C'(s) + Γ · ∫ C'(s − ξ) e^(−αξ) dξ / ∫ e^(−αξ) dξ
 *
 * with C' = W·curvature (W channel width), Ω = −1, Γ = 2.5 and the upstream weighting decaying
 * over 1/α = H / (2 Cf) (H depth, Cf friction). The upstream term makes bends grow and travel
 * downstream; when a bend's neck closes to under one channel width the river cuts through it (a
 * neck cut-off) and the abandoned loop is left as an oxbow lake. Banks of bedrock or valley-side
 * hills resist (erosion × rock erodibility × 0.05), so meanders stay in the floodplain.
 *
 * The channel is carved into the heightfield (bed = floodplain level − depth; cells it leaves on the
 * inside of a bend are filled to near the floodplain as point bars; cut and fill volumes are
 * conserved, the surplus goes downstream). Floods spread fine sediment over the floodplain, thickest
 * beside the channel and decaying exponentially with distance (overbank deposition, Pizzuto 1987;
 * Asselman & Middelkoop 1995), up to the flood level — so levees build beside the channel, the
 * floodplain rises and oxbow lakes slowly fill.
 */
export interface MeanderParams {
  widthM: number;
  depthM: number;
  /** Bank erosion coefficient E (m/yr per unit R1). */
  erosionMYr: number;
  omega: number;
  gamma: number;
  /** Friction coefficient Cf for the upstream weighting length H / (2 Cf). */
  friction: number;
  /** Sediment brought in by the river from upstream of the map (m³/yr). */
  supplyM3Yr: number;
  /** Share of the passing load spread over the floodplain by floods. */
  overbankFraction: number;
  /** Overbank deposits decay with distance from the channel over this length (m). */
  overbankDecayM: number;
  /** Floods reach this high above the floodplain (m): no deposition above. */
  floodHeightM: number;
}

export function defaultMeanderParams(): MeanderParams {
  return {
    widthM: 50,
    depthM: 3,
    erosionMYr: 0.6, // peak migration ≈ 0.35 m/yr (≈ 0.7 % of the width a year: a moderately active lowland river)
    omega: -1,
    gamma: 2.5,
    friction: 0.01,
    supplyM3Yr: 2e4,
    overbankFraction: 0.4,
    overbankDecayM: 100,
    floodHeightM: 2.5,
  };
}

export interface Oxbow {
  xs: number[];
  ys: number[];
  /** Geological year of the cut-off. */
  year: number;
}

/** Plain data (copied to and from the worker, kept in replay frames). */
export interface MeanderState {
  xs: number[];
  ys: number[];
  /** Floodplain level: zOut + (zIn − zOut) × position along the valley axis (m). */
  zIn: number;
  zOut: number;
  /** Valley axis end points (m): inlet and outlet. */
  ax: number;
  ay: number;
  bx: number;
  by: number;
  params: MeanderParams;
  oxbows: Oxbow[];
  cutoffs: number;
  /** Total bank erosion and point-bar / overbank deposition (m³). */
  cutM3: number;
  barM3: number;
  overbankM3: number;
  /** Channel cells carved at the last update (indices). */
  mask: number[];
  years: number;
  /** Years since the channel was last carved into the terrain. */
  sinceCarve: number;
  /**
   * A river picked on any world (findMeanderReach): the valley centreline with its floodplain level
   * (m) at each vertex, from inlet to mouth. Without it the valley is the straight inlet–mouth axis.
   */
  vx?: number[];
  vy?: number[];
  vz?: number[];
  /** The river's load comes from the landscape upstream on this map (captured as it reaches the channel), not from beyond the map. */
  onMap?: boolean;
  /** Load captured from upstream since the last carve (m³; onMap rivers). */
  pendingM3?: number;
}

export function createMeander(xs: number[], ys: number[], zIn: number, zOut: number, params: MeanderParams = defaultMeanderParams()): MeanderState {
  return {
    xs: xs.slice(),
    ys: ys.slice(),
    zIn,
    zOut,
    ax: xs[0],
    ay: ys[0],
    bx: xs[xs.length - 1],
    by: ys[ys.length - 1],
    params,
    oxbows: [],
    cutoffs: 0,
    cutM3: 0,
    barM3: 0,
    overbankM3: 0,
    mask: [],
    years: 0,
    sinceCarve: 0,
  };
}

export const cloneMeander = (m: MeanderState): MeanderState => ({
  ...m,
  xs: m.xs.slice(),
  ys: m.ys.slice(),
  params: { ...m.params },
  oxbows: m.oxbows.map((o) => ({ ...o, xs: o.xs.slice(), ys: o.ys.slice() })),
  mask: m.mask.slice(),
  ...(m.vx ? { vx: m.vx.slice(), vy: m.vy!.slice(), vz: m.vz!.slice() } : {}),
});

/** Floodplain level at (x, y): interpolated along the valley centreline (or linear down the straight valley axis). */
export function floodplainZ(m: MeanderState, x: number, y: number): number {
  if (m.vx && m.vy && m.vz) {
    let best = Infinity;
    let z = m.vz[0];
    for (let k = 1; k < m.vx.length; k++) {
      const ax = m.vx[k - 1];
      const ay = m.vy[k - 1];
      const dx = m.vx[k] - ax;
      const dy = m.vy[k] - ay;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
      const d = (x - ax - t * dx) ** 2 + (y - ay - t * dy) ** 2;
      if (d < best) {
        best = d;
        z = m.vz[k - 1] + (m.vz[k] - m.vz[k - 1]) * t;
      }
    }
    return z;
  }
  const dx = m.bx - m.ax;
  const dy = m.by - m.ay;
  const t = Math.max(0, Math.min(1, ((x - m.ax) * dx + (y - m.ay) * dy) / (dx * dx + dy * dy)));
  return m.zIn + (m.zOut - m.zIn) * t;
}

/** Channel length along the centreline (m). */
export function channelLength(m: MeanderState): number {
  let L = 0;
  for (let k = 1; k < m.xs.length; k++) L += Math.hypot(m.xs[k] - m.xs[k - 1], m.ys[k] - m.ys[k - 1]);
  return L;
}

/** Valley length (m): along the valley centreline, or the straight inlet–mouth distance. */
export function valleyLength(m: MeanderState): number {
  if (!m.vx || !m.vy) return Math.hypot(m.bx - m.ax, m.by - m.ay);
  let L = 0;
  for (let k = 1; k < m.vx.length; k++) L += Math.hypot(m.vx[k] - m.vx[k - 1], m.vy[k] - m.vy[k - 1]);
  return L;
}

/** Sinuosity: channel length / valley length (1 = straight; > 1.5 = meandering). */
export function sinuosity(m: MeanderState): number {
  return channelLength(m) / Math.max(1, valleyLength(m));
}

/** Bank resistance at (x, y): 1 on alluvium in the floodplain, rock erodibility × 0.05 on bedrock or valley sides. */
function bankFactor(w: WorldState, m: MeanderState, x: number, y: number): number {
  const W = w.width;
  const H = w.height;
  const cx = Math.round(x / w.cellSizeM);
  const cy = Math.round(y / w.cellSizeM);
  if (cx < 0 || cy < 0 || cx >= W || cy >= H) return 0;
  const i = cy * W + cx;
  const z = w.bedrockElevationM[i] + w.looseSedimentThicknessM[i];
  if (z < w.seaLevelM) return 0; // no banks in the sea
  const alluvium = w.looseSedimentThicknessM[i] >= m.params.depthM && z <= floodplainZ(m, x, y) + m.params.floodHeightM + 1;
  return alluvium ? 1 : (MATERIALS[w.materialId[i]]?.erodibility ?? 1) * 0.05;
}

/** Keep node spacing between 0.5 and 1.5 × target (insert midpoints / drop nodes). */
function resample(m: MeanderState, target: number) {
  const xs = [m.xs[0]];
  const ys = [m.ys[0]];
  for (let k = 1; k < m.xs.length; k++) {
    const px = xs[xs.length - 1];
    const py = ys[ys.length - 1];
    const d = Math.hypot(m.xs[k] - px, m.ys[k] - py);
    if (d < 0.5 * target && k < m.xs.length - 1) continue;
    const parts = Math.max(1, Math.round(d / target));
    for (let q = 1; q <= parts; q++) {
      xs.push(px + ((m.xs[k] - px) * q) / parts);
      ys.push(py + ((m.ys[k] - py) * q) / parts);
    }
  }
  m.xs = xs;
  m.ys = ys;
}

/** One migration sub-step of `dt` years. Returns the largest node displacement (m). */
export function migrate(w: WorldState, m: MeanderState, dt: number): number {
  const p = m.params;
  const N = m.xs.length;
  if (N < 5) return 0;
  const alpha = (2 * p.friction) / p.depthM;
  const C = new Float64Array(N);
  const nx = new Float64Array(N);
  const ny = new Float64Array(N);
  for (let k = 1; k < N - 1; k++) {
    const t1 = Math.atan2(m.ys[k] - m.ys[k - 1], m.xs[k] - m.xs[k - 1]);
    const t2 = Math.atan2(m.ys[k + 1] - m.ys[k], m.xs[k + 1] - m.xs[k]);
    let dth = t2 - t1;
    if (dth > Math.PI) dth -= 2 * Math.PI;
    if (dth < -Math.PI) dth += 2 * Math.PI;
    const ds = 0.5 * (Math.hypot(m.xs[k] - m.xs[k - 1], m.ys[k] - m.ys[k - 1]) + Math.hypot(m.xs[k + 1] - m.xs[k], m.ys[k + 1] - m.ys[k]));
    // Dimensionless curvature, + = turning left; bends tighter than a radius of 1.25 widths do not
    // occur in natural rivers (Rc/W is rarely < 1.5), so the curvature is capped there.
    C[k] = Math.max(-0.8, Math.min(0.8, (dth / ds) * p.widthM));
    const tx = m.xs[k + 1] - m.xs[k - 1];
    const ty = m.ys[k + 1] - m.ys[k - 1];
    const L = Math.hypot(tx, ty) || 1;
    nx[k] = -ty / L; // left normal
    ny[k] = tx / L;
  }
  // Upstream-weighted curvature (exponential kernel, recursive).
  let num = 0;
  let den = 0;
  const R = new Float64Array(N);
  for (let k = 1; k < N - 1; k++) {
    const ds = Math.hypot(m.xs[k] - m.xs[k - 1], m.ys[k] - m.ys[k - 1]);
    const decay = Math.exp(-alpha * ds);
    num = num * decay + C[k] * ds;
    den = den * decay + ds;
    R[k] = p.omega * C[k] + p.gamma * (num / den);
  }
  // Light smoothing of the rate suppresses node-scale noise (a numerical filter, not physics).
  const Rs = new Float64Array(N);
  for (let k = 2; k < N - 2; k++) Rs[k] = 0.25 * R[k - 1] + 0.5 * R[k] + 0.25 * R[k + 1];
  let maxMove = 0;
  // Positive curvature (turning left): the outside of the bend is on the right (−normal).
  // Near the fixed ends (inlet, mouth) migration tapers to zero over 8 widths (the boundary conditions).
  const arc = new Float64Array(N);
  for (let k = 1; k < N; k++) arc[k] = arc[k - 1] + Math.hypot(m.xs[k] - m.xs[k - 1], m.ys[k] - m.ys[k - 1]);
  const taperL = 8 * p.widthM;
  for (let k = 2; k < N - 2; k++) {
    const dx = -nx[k] * Rs[k];
    const dy = -ny[k] * Rs[k];
    const sgn = Math.sign(Rs[k]);
    // Resistance of the bank being eroded: half a width plus one cell out on the outside of the bend.
    const reach = p.widthM * 0.5 + w.cellSizeM;
    const bf = bankFactor(w, m, m.xs[k] - nx[k] * sgn * reach, m.ys[k] - ny[k] * sgn * reach);
    const taper = Math.min(1, arc[k] / taperL, (arc[N - 1] - arc[k]) / taperL);
    const move = p.erosionMYr * bf * taper * dt;
    // Stay on the map, a channel width in from the edge.
    const ext = (n: number) => (n - 1) * w.cellSizeM - p.widthM;
    m.xs[k] = Math.max(p.widthM, Math.min(ext(w.width), m.xs[k] + dx * move));
    m.ys[k] = Math.max(p.widthM, Math.min(ext(w.height), m.ys[k] + dy * move));
    maxMove = Math.max(maxMove, Math.abs(Rs[k]) * move);
  }
  resample(m, p.widthM * 0.4);
  cutoff(m);
  m.years += dt;
  return maxMove;
}

/**
 * Neck cut-off: two points more than 2π widths apart along the river come within 1.5 widths (centre
 * to centre: the banks of the neck are half a width apart and a flood breaks through) — the loop is abandoned.
 */
function cutoff(m: MeanderState) {
  const W = m.params.widthM;
  const reach = 1.5 * W;
  const cell = reach;
  const grid = new Map<number, number[]>();
  const key = (x: number, y: number) => Math.floor(x / cell) * 100003 + Math.floor(y / cell);
  const N = m.xs.length;
  const arc = new Float64Array(N);
  for (let k = 1; k < N; k++) arc[k] = arc[k - 1] + Math.hypot(m.xs[k] - m.xs[k - 1], m.ys[k] - m.ys[k - 1]);
  for (let k = 0; k < N; k++) {
    const kk = key(m.xs[k], m.ys[k]);
    const list = grid.get(kk);
    if (list) list.push(k);
    else grid.set(kk, [k]);
  }
  for (let k = 0; k < N; k++) {
    const gx = Math.floor(m.xs[k] / cell);
    const gy = Math.floor(m.ys[k] / cell);
    let hit = -1;
    for (let dx = -1; dx <= 1 && hit < 0; dx++)
      for (let dy = -1; dy <= 1 && hit < 0; dy++) {
        const list = grid.get((gx + dx) * 100003 + (gy + dy));
        if (!list) continue;
        for (const j of list)
          if (j > k && arc[j] - arc[k] > 2 * W * Math.PI && Math.hypot(m.xs[j] - m.xs[k], m.ys[j] - m.ys[k]) < reach) {
            hit = j;
            break;
          }
      }
    if (hit > 0) {
      m.oxbows.push({ xs: m.xs.slice(k, hit + 1), ys: m.ys.slice(k, hit + 1), year: m.years });
      if (m.oxbows.length > 24) m.oxbows.shift(); // older ones are filled scars by now
      m.xs.splice(k + 1, hit - k - 1);
      m.ys.splice(k + 1, hit - k - 1);
      m.cutoffs++;
      return; // one per sub-step; the next sub-step rebuilds the grid
    }
  }
}

/** Distance from (x, y) to segment a–b (m). */
function segDist(x: number, y: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax;
  const dy = by - ay;
  const L2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L2));
  return Math.hypot(x - ax - t * dx, y - ay - t * dy);
}

/**
 * Distance (m) from every cell to the centreline: exact within `nearM` (segment distances), then a
 * two-pass chamfer distance transform outwards (accurate to a few % — used for flood-deposit decay).
 */
export function channelDistance(w: WorldState, xs: number[], ys: number[], nearM: number, chamfer = true): Float32Array {
  const W = w.width;
  const H = w.height;
  const cs = w.cellSizeM;
  const d = new Float32Array(W * H).fill(Infinity);
  for (let k = 1; k < xs.length; k++) {
    const x0 = Math.max(0, Math.floor((Math.min(xs[k - 1], xs[k]) - nearM) / cs));
    const x1 = Math.min(W - 1, Math.ceil((Math.max(xs[k - 1], xs[k]) + nearM) / cs));
    const y0 = Math.max(0, Math.floor((Math.min(ys[k - 1], ys[k]) - nearM) / cs));
    const y1 = Math.min(H - 1, Math.ceil((Math.max(ys[k - 1], ys[k]) + nearM) / cs));
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const v = segDist(x * cs, y * cs, xs[k - 1], ys[k - 1], xs[k], ys[k]);
        const i = y * W + x;
        if (v < d[i]) d[i] = v;
      }
  }
  if (!chamfer) return d;
  const a = cs;
  const b = cs * Math.SQRT2;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      let v = d[i];
      if (x > 0) v = Math.min(v, d[i - 1] + a);
      if (y > 0) {
        v = Math.min(v, d[i - W] + a);
        if (x > 0) v = Math.min(v, d[i - W - 1] + b);
        if (x < W - 1) v = Math.min(v, d[i - W + 1] + b);
      }
      d[i] = v;
    }
  for (let y = H - 1; y >= 0; y--)
    for (let x = W - 1; x >= 0; x--) {
      const i = y * W + x;
      let v = d[i];
      if (x < W - 1) v = Math.min(v, d[i + 1] + a);
      if (y < H - 1) {
        v = Math.min(v, d[i + W] + a);
        if (x < W - 1) v = Math.min(v, d[i + W + 1] + b);
        if (x > 0) v = Math.min(v, d[i + W - 1] + b);
      }
      d[i] = v;
    }
  return d;
}

export interface CarveStats {
  /** Sediment brought in from upstream of the map during these years (m³). */
  suppliedM3: number;
  cutM3: number;
  barM3: number;
  overbankM3: number;
  /** Sediment passed on downstream (m³). */
  exportM3: number;
}

/**
 * Carve the channel into the terrain and spread flood deposits (call every few decades of migration).
 * `years` since the last carve sets the overbank volume.
 */
export function carve(w: WorldState, m: MeanderState, years: number): CarveStats {
  const p = m.params;
  const W = w.width;
  const cs = w.cellSizeM;
  const A = cs * cs;
  const bed = w.bedrockElevationM;
  const soil = w.looseSedimentThicknessM;
  const half = Math.max(p.widthM / 2, cs * 0.75);
  const reach = 6 * p.overbankDecayM;
  const dist = channelDistance(w, m.xs, m.ys, half + 2 * cs);
  const was = new Set(m.mask);
  const now: number[] = [];
  const oxbowCells = new Set<number>();
  for (const o of m.oxbows) {
    const od = channelDistance(w, o.xs, o.ys, half, false);
    for (let i = 0; i < od.length; i++) if (od[i] <= half) oxbowCells.add(i);
  }
  let cut = 0;
  let fill = 0;
  for (let i = 0; i < dist.length; i++) {
    if (dist[i] > half) continue;
    now.push(i);
    const x = (i % W) * cs;
    const y = ((i / W) | 0) * cs;
    const target = floodplainZ(m, x, y) - p.depthM;
    const z = bed[i] + soil[i];
    if (z > target) {
      let e = z - target;
      const fromSoil = Math.min(soil[i], e);
      soil[i] -= fromSoil;
      e -= fromSoil;
      bed[i] -= e;
      if (e > 0) refreshExposed(w, i);
      cut += (z - target) * A;
    }
  }
  const nowSet = new Set(now);
  // Point bars: cells the channel has left (not abandoned loops) fill to 0.5 m below the floodplain.
  let budget = cut;
  for (const i of was) {
    if (nowSet.has(i) || oxbowCells.has(i)) continue;
    const x = (i % W) * cs;
    const y = ((i / W) | 0) * cs;
    const top = floodplainZ(m, x, y) - 0.5;
    const z = bed[i] + soil[i];
    if (z < top && budget > 0) {
      const d = Math.min(top - z, budget / A);
      soil[i] += d;
      fill += d * A;
      budget -= d * A;
    }
  }
  // Plugs: where an abandoned loop meets the river, deposition seals its ends (to 0.5 m below the
  // floodplain), so the loop becomes a closed oxbow lake rather than a backwater.
  let plug = 0;
  for (const i of oxbowCells) {
    if (nowSet.has(i) || dist[i] > half + p.widthM) continue;
    const x = (i % W) * cs;
    const y = ((i / W) | 0) * cs;
    const top = floodplainZ(m, x, y) - 0.5;
    const z = bed[i] + soil[i];
    if (z < top) {
      soil[i] += top - z;
      plug += (top - z) * A;
    }
  }
  fill += plug;
  budget -= plug; // may go negative: then the plugs took some of the incoming supply
  // Overbank flood deposits: a share of the load passing through, decaying with distance from the channel.
  // The load: sediment from beyond the map (lesson river) or captured from the landscape upstream (onMap).
  const captured = m.pendingM3 ?? 0;
  m.pendingM3 = 0;
  const load = p.supplyM3Yr * years + captured + budget;
  const ob = p.overbankFraction * load;
  // Shares are fixed by distance over the whole reach and scaled by the depth of flooding there; what
  // is not laid stays in the river and goes downstream, so deposits never pile up above the floods.
  let wsum = 0;
  for (let i = 0; i < dist.length; i++) if (dist[i] > half && dist[i] <= reach) wsum += Math.exp(-(dist[i] - half) / p.overbankDecayM);
  let laid = 0;
  if (wsum > 0)
    for (let i = 0; i < dist.length; i++) {
      if (dist[i] <= half || dist[i] > reach) continue;
      const x = (i % W) * cs;
      const y = ((i / W) | 0) * cs;
      const room = floodplainZ(m, x, y) + p.floodHeightM - (bed[i] + soil[i]);
      if (room <= 0) continue;
      // Deposition falls as the ground rises towards the flood level (shallower, rarer floods).
      const share = (ob * Math.exp(-(dist[i] - half) / p.overbankDecayM)) / wsum / A;
      const d = Math.min(room, share * Math.min(1, room / p.floodHeightM));
      soil[i] += d;
      laid += d * A;
    }
  m.mask = now;
  m.cutM3 += cut;
  m.barM3 += fill;
  m.overbankM3 += laid;
  // Bank erosion beyond what the bars took, plus the supply not laid on the floodplain, goes downstream.
  return { suppliedM3: p.supplyM3Yr * years, cutM3: cut, barM3: fill, overbankM3: laid, exportM3: load - laid };
}
