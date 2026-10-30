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
 *   local wave field: a fan of rays (±60° in 10° steps, weight cos²δ) is cast towards the wave
 *   source; rays that reach open water carry energy. Their weighted share is the cell's wave
 *   energy and their weighted mean direction its effective wave direction — so the lee of an
 *   island or headland receives weaker waves bent around the obstacle (diffraction proxy).
 *   exposure e = fan energy × refraction-softened incidence (0.25 + 0.75·cos i, i = angle
 *   between the seaward coast normal and the effective wave source) × foreshore attenuation (max(0.2, d_min·0.78/H) when
 *   the shallowest of the next three seaward cells is shallower than the breaking depth H/0.78
 *   — a widening wave-cut platform slows retreat but does not stop it).
 *   Lowering rate = cliffK · P₀ · e · erodibility · speedup, down to a platform level of
 *   sea − 0.3 H; loose debris goes first, then the exposed lithology. Eroded material is carried
 *   seaward along the coast normal beyond the breaker zone, filling to the breaking depth below
 *   sea level, cell by cell (up to 12 cells out).
 *   Cliffs behind the lowered cell then fail through the global rockfall model (undercut →
 *   collapse → retreat); talus at the toe shields the cliff until waves remove it.
 *
 * C03 — longshore drift (CERC-like): on the beach face (shoreline cells below the berm, i.e. the
 * surf and swash zone, whether just submerged or just emerged) loose
 * sediment moves along the shore at Q = driftK · H_eff^2.5 · |sin 2α| (m³/s), with H_eff = H·√e
 * from the local wave field and α the effective wave angle to the shore-normal, towards the
 * 8-neighbour best aligned with the alongshore component. In an island's lee the bent waves
 * drive drift inward from both sides, so sand converges (salient → tombolo).
 * Onshore transport: in shallow sea cells (depth < 2× breaking depth) on the shoreface — a shore
 * within 4 cells ahead along the local wave direction, loose sand moves one cell in that direction at
 * onshoreK · H_eff^2.5 — shoaling waves feed shelf sand to beaches, salients and tombolos (in
 * open water with no shore ahead there is no net shoreward transport).
 * Nearshore reworking: in the submerged surf zone (within 2 cells of the shoreline, between
 * 0.2 m and 2× breaking depth below sea level) loose sand diffuses pairwise (min(0.1·Δz, donor/4)) so beaches and ridges stay
 * continuous rather than speckled at cell scale.
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
  /** Fine sediment carried away offshore, off the map (m³; geological time). */
  exportedFines: number;
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
  ledger: CoastLedger = { cliffEroded: 0, cliffBedrock: 0, nearshoreDeposited: 0, drifted: 0, exportedFines: 0 };
  /**
   * Share of eroded cliff material coarse enough to stay near the shore (pebbles, sand); the rest is
   * mud and silt carried away in suspension (most of what chalk and clay cliffs yield — e.g. > 80 %
   * at Holderness). 1 = everything stays (water time); geological time uses 0.2.
   */
  coarseFraction = 1;
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

  /** True if a ray from (x, y) along (ux, uy) reaches open water / the map edge without crossing land again. */
  private rayOpen(x: number, y: number, ux: number, uy: number, maxCells = 120): boolean {
    const w = this.world;
    let seenSea = false;
    for (let k = 1; k <= maxCells; k++) {
      const xx = Math.round(x + ux * k);
      const yy = Math.round(y + uy * k);
      if (xx < 0 || yy < 0 || xx >= w.width || yy >= w.height) return true;
      if (this.isSea(yy * w.width + xx)) seenSea = true;
      else if (seenSea) return false;
    }
    return true;
  }

  /**
   * Local wave field at (x, y): energy share e ∈ [0, 1] of a ±60° ray fan (weights cos²δ) that
   * reaches open water, and the unit vector towards the effective wave source.
   */
  waveField(x: number, y: number): { e: number; sx: number; sy: number } {
    const t0 = (this.params.waveFromDeg * Math.PI) / 180;
    let wSum = 0;
    let open = 0;
    let vx = 0;
    let vy = 0;
    for (let k = -6; k <= 6; k++) {
      const d = (k * 10 * Math.PI) / 180;
      const wt = Math.cos(d) ** 2;
      const ux = Math.sin(t0 + d);
      const uy = Math.cos(t0 + d);
      wSum += wt;
      if (this.rayOpen(x, y, ux, uy)) {
        open += wt;
        vx += wt * ux;
        vy += wt * uy;
      }
    }
    const l = Math.hypot(vx, vy);
    if (open <= 0 || l < 1e-9) return { e: 0, sx: 0, sy: 0 };
    return { e: open / wSum, sx: vx / l, sy: vy / l };
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
      const wf = this.waveField(x, y);
      if (wf.e <= 0) continue;
      const cosI = nx * wf.sx + ny * wf.sy;
      if (cosI < -0.3) continue; // faces away from the waves
      let e = Math.max(0, 0.25 + 0.75 * cosI) * wf.e;
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
      const coarse = removed * this.coarseFraction;
      this.ledger.exportedFines += (removed - coarse) * A;
      if (coarse > 0) this.layOffshore(x, y, nx, ny, coarse, breakDepth);
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
    let carried = 0;
    if (left > 0 && this.coarseFraction < 1) {
      // Geological time: the nearshore is full, so the rest is carried further offshore (off the map).
      carried = left;
      this.ledger.exportedFines += left * w.cellSizeM * w.cellSizeM;
      left = 0;
    }
    if (left > 0) {
      // Nowhere below the fill level: leave it in the nearest seaward cell (or back on the cell).
      const j = last >= 0 ? last : y * W + x;
      loose[j] += left;
      z[j] = b[j] + loose[j];
    }
    this.ledger.nearshoreDeposited += (vol - carried) * w.cellSizeM * w.cellSizeM;
  }

  private landNeighbours(x: number, y: number): number {
    const W = this.world.width;
    const H = this.world.height;
    let n = 0;
    if (x > 0 && !this.isSea(y * W + x - 1)) n++;
    if (x < W - 1 && !this.isSea(y * W + x + 1)) n++;
    if (y > 0 && !this.isSea((y - 1) * W + x)) n++;
    if (y < H - 1 && !this.isSea((y + 1) * W + x)) n++;
    return n;
  }

  /** Wave reworking of loose sand in the active band: pairwise diffusion from a snapshot. */
  private nearshoreSmooth(activeDepth: number, kappa = 0.1) {
    const w = this.world;
    const W = w.width;
    const H = w.height;
    const sl = w.seaLevelM;
    const z = this.surface;
    const b = w.bedrockElevationM;
    const loose = w.looseSedimentThicknessM;
    const z0 = z.slice();
    const l0 = loose.slice();
    // Distance (in cells, Chebyshev, capped at 3) to the nearest shoreline cell pair.
    const near = new Uint8Array(W * H);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        const sea = z0[i] < sl;
        let shore = false;
        for (let dy = -2; dy <= 2 && !shore; dy++)
          for (let dx = -2; dx <= 2; dx++) {
            const xx = x + dx;
            const yy = y + dy;
            if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
            if (z0[yy * W + xx] < sl !== sea) {
              shore = true;
              break;
            }
          }
        near[i] = shore ? 1 : 0;
      }
    // Only the submerged surf zone is reworked: emergent beaches, spits and bars keep their crests.
    const active = (i: number) => near[i] === 1 && z0[i] < sl - 0.2 && sl - z0[i] < activeDepth;
    const face = (i: number, j: number) => {
      const dz = z0[i] - z0[j];
      return dz > 0 ? Math.min(kappa * dz, 0.25 * l0[i]) : -Math.min(-kappa * dz, 0.25 * l0[j]);
    };
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (!active(i)) continue;
        let net = 0;
        if (x > 0 && active(i - 1)) net += face(i, i - 1);
        if (x < W - 1 && active(i + 1)) net += face(i, i + 1);
        if (y > 0 && active(i - W)) net += face(i, i - W);
        if (y < H - 1 && active(i + W)) net += face(i, i + W);
        if (net !== 0) {
          loose[i] = Math.max(0, l0[i] - net);
          z[i] = b[i] + loose[i];
        }
      }
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
    const qMax = p.driftK * Math.pow(p.waveHeightM, 2.5) * speedup * dt; // m³ for |sin 2α| = 1
    const moves: { from: number; to: number; m: number }[] = [];
    const DX = [1, 1, 0, -1, -1, -1, 0, 1];
    const DY = [0, 1, 1, 1, 0, -1, -1, -1];
    // Beach face = cells on the shoreline (a neighbour of the opposite land/sea state) below the
    // berm (wave run-up) height: the swash zone stays mobile even where sand has emerged.
    const berm = w.seaLevelM + Math.min(1, 0.5 * p.waveHeightM);
    const onShore = (xx: number, yy: number) => {
      const j = yy * W + xx;
      const sea = this.isSea(j);
      return (
        (xx > 0 && this.isSea(j - 1) !== sea) ||
        (xx < W - 1 && this.isSea(j + 1) !== sea) ||
        (yy > 0 && this.isSea(j - W) !== sea) ||
        (yy < H - 1 && this.isSea(j + W) !== sea)
      );
    };
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        // Shoreline beach cells give sand even if their crest stands above the berm (waves work the
        // sub-cell beach face); they receive only below the berm.
        if (loose[i] <= 0 || z[i] >= w.seaLevelM + 2 || !onShore(x, y)) continue;
        const [nx, ny] = this.seawardNormal(x, y); // points away from land
        const wf = this.waveField(x, y);
        if (wf.e <= 0) continue;
        const px = -wf.sx; // effective wave propagation direction
        const py = -wf.sy;
        const approach = -(px * nx + py * ny); // > 0 when waves travel towards the shore
        if (approach <= 0) continue;
        const tx = -ny;
        const ty = nx;
        const along = px * tx + py * ty; // signed alongshore component
        const sin2a = 2 * Math.abs(along) * approach;
        const vol = Math.min(qMax * Math.pow(wf.e, 1.25) * sin2a, loose[i] * A);
        if (vol <= 0) continue;
        const dx = Math.sign(along) * tx;
        const dy = Math.sign(along) * ty;
        // Beach-face neighbour best aligned with the drift; never open water (the spit tip fills
        // and emerges instead) and never above the berm.
        let best = -1;
        let bestScore = -Infinity;
        let bestD = 0;
        let ahead = -1;
        let aheadD = 0;
        for (let k = 0; k < 8; k++) {
          const xx = x + DX[k];
          const yy = y + DY[k];
          if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
          const j = yy * W + xx;
          if (z[j] >= berm) continue;
          const d = (DX[k] * dx + DY[k] * dy) / Math.hypot(DX[k], DY[k]);
          if (!onShore(xx, yy)) {
            if (this.isSea(j) && d > aheadD) {
              aheadD = d;
              ahead = j;
            }
            continue;
          }
          if (d < 0.3) continue;
          const score = d + 0.35 * this.landNeighbours(xx, yy);
          if (score > bestScore) {
            bestScore = score;
            best = j;
          }
          if (score === bestScore) bestD = d;
        }
        // Drift cannot turn a sharp corner: where the shore bends away by more than ~35° and open
        // water lies straight ahead, sand is laid ahead — the spit tip fills, emerges, advances.
        if (ahead >= 0 && aheadD > 0.9 && (best < 0 || bestD < 0.82)) best = ahead;
        if (best < 0) continue; // blocked (e.g. against a headland): sediment accumulates here
        moves.push({ from: i, to: best, m: vol / A });
      }
    // Onshore transport of shelf sand by shoaling waves (cells not already drifting).
    const qOn = p.onshoreK * Math.pow(p.waveHeightM, 2.5) * speedup * dt;
    const activeDepth = (2 * p.waveHeightM) / 0.78;
    const drifting = new Set(moves.map((m) => m.from));
    if (qOn > 0)
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          const i = y * W + x;
          if (drifting.has(i) || !this.isSea(i) || loose[i] <= 0) continue;
          const depth = w.seaLevelM - z[i];
          if (depth > activeDepth) continue;
          const wf = this.waveField(x, y);
          if (wf.e <= 0) continue;
          const px = -wf.sx;
          const py = -wf.sy;
          let shoreAhead = false;
          for (let k = 1; k <= 4 && !shoreAhead; k++) {
            const xx = Math.round(x + px * k);
            const yy = Math.round(y + py * k);
            if (xx < 0 || yy < 0 || xx >= W || yy >= H) break;
            if (!this.isSea(yy * W + xx)) shoreAhead = true;
          }
          if (!shoreAhead) continue;
          let best = -1;
          let bestDot = 0.5;
          for (let k = 0; k < 8; k++) {
            const xx = x + DX[k];
            const yy = y + DY[k];
            if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
            const j = yy * W + xx;
            if (!this.isSea(j)) continue;
            const d = (DX[k] * px + DY[k] * py) / Math.hypot(DX[k], DY[k]);
            if (d > bestDot) {
              bestDot = d;
              best = j;
            }
          }
          if (best < 0) continue;
          const vol = Math.min(qOn * Math.pow(wf.e, 1.25), 0.5 * loose[i] * A);
          if (vol > 0) moves.push({ from: i, to: best, m: vol / A });
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
    this.nearshoreSmooth(activeDepth);
    return moves.length;
  }
}
