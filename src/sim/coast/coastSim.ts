import { refreshExposed, type WorldState } from '../../engine/world';
import { MATERIALS } from '../../terrain/materials';

/**
 * Coastal processes (spec E6), run on a slow fixed cadence (default every 600 simulated seconds),
 * operating on the CPU world state.
 *
 * Wave forcing: deep-water energy flux P₀ = ρ g² H² T / (64 π) (W per m of crest) for wave
 * height H, period T, arriving FROM compass bearing θ.
 *
 * C02 — wave attack and cliff retreat. For each coastal land cell (land with a sea neighbour):
 *   exposure e = refraction-softened incidence (0.25 + 0.75·cos i, i = angle between the
 *   seaward coast normal and the wave source) × shelter (a ray towards the wave source that
 *   crosses land again ⇒ ×0.1, diffraction) × foreshore attenuation (max(0.2, d_min·0.78/H) when
 *   the shallowest of the next three seaward cells is shallower than the breaking depth H/0.78
 *   — a widening wave-cut platform slows retreat but does not stop it).
 *   Lowering rate = cliffK · P₀ · e · erodibility · speedup, down to a platform level of
 *   sea − 0.3 H; loose debris goes first, then the exposed lithology. Eroded material is carried
 *   seaward along the coast normal beyond the breaker zone, filling to the breaking depth below
 *   sea level, cell by cell (up to 12 cells out).
 *   Cliffs behind the lowered cell then fail through the global rockfall model (undercut →
 *   collapse → retreat); talus at the toe shields the cliff until waves remove it.
 *
 * C03 — longshore drift (CERC-like): in each surf cell (sea cell with a land neighbour) loose
 * sediment moves along the shore at Q = driftK · H^2.5 · |sin 2α| (m³/s), α = wave angle to
 * the shore-normal, towards the 8-neighbour best aligned with the alongshore wave component.
 * Transfers are computed from a snapshot then applied (order-independent, exactly
 * conservative). Where the coast turns away, drift carries on into open water and deposits —
 * the seed of a spit; deposits that rise above sea level become land.
 * Limits: no wave refraction/diffraction field, single sediment class, no tides; landforms are
 * approximate at heightfield resolution. Caves/arches need local 3D geometry (M05-C05).
 */

export type { CoastParams } from './params';
export { defaultCoastParams } from './params';
import type { CoastParams } from './params';

export interface CoastLedger {
  /** Rock and debris removed from cliffs by waves (m³). */
  cliffEroded: number;
  /** Of which bedrock (m³). */
  cliffBedrock: number;
  /** Laid down offshore / on the foreshore (m³). */
  nearshoreDeposited: number;
  /** Moved alongshore by drift (m³, summed transfers). */
  drifted: number;
}

const RHO = 1025;
const G = 9.81;

/** Deep-water wave energy flux per metre of crest (W/m). */
export function wavePower(H: number, T: number): number {
  return (RHO * G * G * H * H * T) / (64 * Math.PI);
}

export class CoastSim {
  ledger: CoastLedger = { cliffEroded: 0, cliffBedrock: 0, nearshoreDeposited: 0, drifted: 0 };
  /** Wave power reaching each coastal land cell at the last update (W/m), else 0. */
  exposure: Float32Array;
  private erod = new Float32Array(256);
  private sinceLast = 0;

  constructor(private world: WorldState, private surface: Float32Array) {
    this.exposure = new Float32Array(world.width * world.height);
    for (const m of MATERIALS) this.erod[m.id] = m.erodibility;
  }

  get params(): CoastParams {
    return this.world.coast;
  }

  /**
   * Accumulate simulated time; returns true when a coastal update is due (the caller must then
   * make the CPU mirror current, call update(), and push the result back to the GPU).
   */
  accumulate(dt: number): boolean {
    if (!this.params.wavesOn) return false;
    this.sinceLast += dt;
    return this.sinceLast >= this.params.intervalS;
  }

  /** Apply all coastal processes for the accumulated time. Returns the changed cell count. */
  update(speedup: number): number {
    const dt = this.sinceLast;
    this.sinceLast = 0;
    if (!this.params.wavesOn || dt <= 0) return 0;
    return this.run(dt, speedup);
  }

  /** Run coastal processes for exactly dt simulated seconds (tests / step button). */
  run(dt: number, speedup: number): number {
    const changed = this.waveAttack(dt, speedup);
    return changed + this.drift(dt, speedup);
  }

  private isSea(i: number) {
    return this.surface[i] < this.world.seaLevelM;
  }

  /** Unit vector pointing from land towards sea at cell (x, y), from a 5×5 sea mask. */
  private seawardNormal(x: number, y: number): [number, number] {
    const w = this.world;
    let nx = 0;
    let ny = 0;
    for (let dy = -2; dy <= 2; dy++)
      for (let dx = -2; dx <= 2; dx++) {
        if (!dx && !dy) continue;
        const xx = x + dx;
        const yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= w.width || yy >= w.height) continue;
        const s = this.isSea(yy * w.width + xx) ? 1 : -1;
        const r = Math.hypot(dx, dy);
        nx += (s * dx) / r;
        ny += (s * dy) / r;
      }
    const l = Math.hypot(nx, ny);
    return l > 1e-9 ? [nx / l, ny / l] : [0, 0];
  }

  /** Unit vector towards the wave source (x east, y north). */
  private toSource(): [number, number] {
    const t = (this.params.waveFromDeg * Math.PI) / 180;
    return [Math.sin(t), Math.cos(t)];
  }

  /** 1 if a ray from (x, y) towards the wave source reaches open water / map edge, 0.1 if land blocks it. */
  private shelter(x: number, y: number, maxCells = 120): number {
    const w = this.world;
    const [ux, uy] = this.toSource();
    let seenSea = false;
    for (let k = 1; k <= maxCells; k++) {
      const xx = Math.round(x + ux * k);
      const yy = Math.round(y + uy * k);
      if (xx < 0 || yy < 0 || xx >= w.width || yy >= w.height) return 1;
      const sea = this.isSea(yy * w.width + xx);
      if (sea) seenSea = true;
      else if (seenSea) return 0.1;
    }
    return 1;
  }

  private waveAttack(dt: number, speedup: number): number {
    const w = this.world;
    const p = this.params;
    const W = w.width;
    const H = w.height;
    const cs = w.cellSizeM;
    const A = cs * cs;
    const sl = w.seaLevelM;
    const z = this.surface;
    const b = w.bedrockElevationM;
    const loose = w.looseSedimentThicknessM;
    const P0 = wavePower(p.waveHeightM, p.wavePeriodS);
    const floor = sl - 0.3 * p.waveHeightM;
    const breakDepth = p.waveHeightM / 0.78;
    const [sx, sy] = this.toSource();
    this.exposure.fill(0);
    if (P0 <= 0) return 0;
    // Collect coastal land cells first (from the state at the start of the update).
    const coastal: number[] = [];
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (this.isSea(i)) continue;
        if ((x > 0 && this.isSea(i - 1)) || (x < W - 1 && this.isSea(i + 1)) || (y > 0 && this.isSea(i - W)) || (y < H - 1 && this.isSea(i + W))) coastal.push(i);
      }
    let changed = 0;
    for (const i of coastal) {
      const x = i % W;
      const y = (i / W) | 0;
      const [nx, ny] = this.seawardNormal(x, y);
      const cosI = nx * sx + ny * sy;
      if (cosI < -0.3) continue; // faces away from the waves
      let e = Math.max(0, 0.25 + 0.75 * cosI) * this.shelter(x, y);
      // Foreshore attenuation from the shallowest of the next three seaward cells.
      let dmin = Infinity;
      for (let k = 1; k <= 3; k++) {
        const xx = Math.round(x + nx * k);
        const yy = Math.round(y + ny * k);
        if (xx < 0 || yy < 0 || xx >= W || yy >= H) break;
        const j = yy * W + xx;
        if (this.isSea(j)) dmin = Math.min(dmin, sl - z[j]);
      }
      if (dmin < breakDepth) e *= Math.max(0.2, Math.max(0, dmin) / breakDepth);
      const P = P0 * e;
      this.exposure[i] = P;
      if (P <= 0 || z[i] <= floor) continue;
      // Lower the cell: loose debris first, then the exposed lithology.
      const rateLoose = p.cliffK * P * speedup * dt; // debris erodes at the base rate (erodibility 1)
      let removed = 0;
      const fromLoose = Math.min(loose[i], rateLoose, z[i] - floor);
      loose[i] -= fromLoose;
      removed += fromLoose;
      const remainingFrac = rateLoose > 0 ? 1 - fromLoose / rateLoose : 0;
      let fromRock = 0;
      if (remainingFrac > 0 && loose[i] <= 0) {
        const want = Math.min(remainingFrac * rateLoose * this.erod[w.materialId[i]], b[i] - floor);
        if (want > 0) {
          const nb = Math.fround(b[i] - want);
          fromRock = b[i] - nb;
          b[i] = nb;
          refreshExposed(w, i);
        }
      }
      removed += fromRock;
      if (removed <= 0) continue;
      z[i] = b[i] + loose[i];
      this.ledger.cliffEroded += removed * A;
      this.ledger.cliffBedrock += fromRock * A;
      this.layOffshore(x, y, nx, ny, removed, breakDepth);
      changed++;
    }
    return changed;
  }

  /** Lay `vol` (m of one cell) seaward along (nx, ny), filling each sea cell to the breaking depth. */
  private layOffshore(x: number, y: number, nx: number, ny: number, vol: number, breakDepth: number) {
    const w = this.world;
    const W = w.width;
    const cap = w.seaLevelM - Math.max(0.5, breakDepth);
    const loose = w.looseSedimentThicknessM;
    const b = w.bedrockElevationM;
    const z = this.surface;
    let left = vol;
    let last = -1;
    for (let k = 1; k <= 12 && left > 0; k++) {
      const xx = Math.min(W - 1, Math.max(0, Math.round(x + nx * k)));
      const yy = Math.min(w.height - 1, Math.max(0, Math.round(y + ny * k)));
      const j = yy * W + xx;
      if (j === y * W + x || !this.isSea(j)) continue;
      last = j;
      const room = cap - z[j];
      if (room <= 0) continue;
      const put = Math.min(room, left);
      loose[j] += put;
      z[j] = b[j] + loose[j];
      left -= put;
    }
    if (left > 0) {
      // Nowhere below the fill level: leave it in the nearest seaward cell (or back on the cell).
      const j = last >= 0 ? last : y * W + x;
      loose[j] += left;
      z[j] = b[j] + loose[j];
    }
    this.ledger.nearshoreDeposited += vol * w.cellSizeM * w.cellSizeM;
  }

  private drift(dt: number, speedup: number): number {
    const w = this.world;
    const p = this.params;
    const W = w.width;
    const H = w.height;
    const cs = w.cellSizeM;
    const A = cs * cs;
    const loose = w.looseSedimentThicknessM;
    const b = w.bedrockElevationM;
    const z = this.surface;
    if (p.driftK <= 0 || p.waveHeightM <= 0) return 0;
    const [sx, sy] = this.toSource();
    const px = -sx; // wave propagation direction
    const py = -sy;
    const qMax = p.driftK * Math.pow(p.waveHeightM, 2.5) * speedup * dt; // m³ for |sin 2α| = 1
    const moves: { from: number; to: number; m: number }[] = [];
    const DX = [1, 1, 0, -1, -1, -1, 0, 1];
    const DY = [0, 1, 1, 1, 0, -1, -1, -1];
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (!this.isSea(i) || loose[i] <= 0) continue;
        if (!((x > 0 && !this.isSea(i - 1)) || (x < W - 1 && !this.isSea(i + 1)) || (y > 0 && !this.isSea(i - W)) || (y < H - 1 && !this.isSea(i + W)))) continue;
        const [nx, ny] = this.seawardNormal(x, y); // points away from land
        const approach = -(px * nx + py * ny); // > 0 when waves travel towards the shore
        if (approach <= 0) continue;
        if (this.shelter(x, y) < 1) continue;
        const tx = -ny;
        const ty = nx;
        const along = px * tx + py * ty; // signed alongshore component
        const sin2a = 2 * Math.abs(along) * approach;
        const vol = Math.min(qMax * sin2a, loose[i] * A);
        if (vol <= 0) continue;
        const dx = Math.sign(along) * tx;
        const dy = Math.sign(along) * ty;
        // Neighbour best aligned with the drift direction that is not land.
        let best = -1;
        let bestDot = 0.3;
        for (let k = 0; k < 8; k++) {
          const xx = x + DX[k];
          const yy = y + DY[k];
          if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
          const j = yy * W + xx;
          if (!this.isSea(j)) continue;
          const d = (DX[k] * dx + DY[k] * dy) / Math.hypot(DX[k], DY[k]);
          if (d > bestDot) {
            bestDot = d;
            best = j;
          }
        }
        if (best < 0) continue; // blocked (e.g. against a headland): sediment accumulates here
        moves.push({ from: i, to: best, m: vol / A });
      }
    for (const mv of moves) {
      loose[mv.from] -= mv.m;
      loose[mv.to] += mv.m;
      this.ledger.drifted += mv.m * A;
    }
    for (const mv of moves) {
      if (loose[mv.from] < 0) loose[mv.from] = 0; // float round-off only
      z[mv.from] = b[mv.from] + loose[mv.from];
      z[mv.to] = b[mv.to] + loose[mv.to];
    }
    return moves.length;
  }
}
