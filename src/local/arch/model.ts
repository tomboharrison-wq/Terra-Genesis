/**
 * Guided local model (spec E6 / G3): cave → arch → stack → stump on a voxel headland.
 *
 * Grid: NX × NY × NZ voxels of 1 m (x along the coast, y seaward, z up). The mainland occupies
 * y < COAST_Y; a headland juts seaward between x0 … x1 up to HEAD_Y; a seabed layer z < BED_Z
 * underlies everything. A vertical joint (plane of weakness) crosses the headland at y = jointY.
 *
 * Each step:
 *  1. Wave field: open sea = water outside the original headland footprint (energy 1); water cut
 *     into the rock gets 0.8^d, d = distance through water from open sea (caves attenuate); the
 *     spray band up to seaLevel + 5 gets 0.2 × that. The bay shores beside the headland get
 *     BAY_FACTOR of it (refraction spreads energy; bay beaches absorb it). Inside caves and arches (within the
 *     headland footprint) surging water and compressed air attack the ceiling: energy rises up
 *     the void at ×0.6 then ×0.85 per voxel, so arches enlarge upward along their weakness.
 *  2. Erosion: every solid voxel accumulates damage = Σ over water faces (energy) × erodibility ×
 *     rate, plus a slow subaerial weathering term on faces open to air above the sea. Joint voxels
 *     (a 3-voxel fracture zone) are 5× more erodible; a seeded ±25 % variability breaks symmetry. Damage ≥ 1 removes it.
 *  3. Collapse: solid voxels not connected (6-neighbour) to the seabed layer through solid fall —
 *     an arch whose roof is breached leaves a free-standing stack; a stack whose base is notched
 *     through drops its top, leaving a stump. Fallen volume is ledgered.
 * Stages are detected from geometry (topology), not scripted; the reported stage never goes
 * backwards (the sequence is irreversible), so a later through-passage under a stack does not
 * read as a new arch.
 */

export const NX = 48;
export const NY = 40;
export const NZ = 30;
export const BED_Z = 3;
export const COAST_Y = 10;
/** Share of wave energy reaching the bay shores either side of the headland. */
export const BAY_FACTOR = 0.15;

export type Stage = 'headland' | 'cave' | 'arch' | 'stack' | 'stump' | 'gone';

export interface ArchParams {
  seaLevel: number;
  cliffTop: number;
  headX0: number;
  headX1: number;
  headY: number;
  jointY: number;
  /** Damage per unit wave energy per face per step. */
  waveRate: number;
  /** Subaerial weathering damage per exposed face per step. */
  weatherRate: number;
  jointFactor: number;
  seed: number;
}

export function defaultArchParams(): ArchParams {
  return { seaLevel: 8, cliffTop: 24, headX0: 16, headX1: 32, headY: 32, jointY: 22, waveRate: 0.06, weatherRate: 0.01, jointFactor: 5, seed: 7 };
}

const idx = (x: number, y: number, z: number) => (z * NY + y) * NX + x;

export const STAGE_ORDER: Stage[] = ['headland', 'cave', 'arch', 'stack', 'stump', 'gone'];

function hash(x: number, y: number, z: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647 + seed * 144665) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export class ArchModel {
  solid = new Uint8Array(NX * NY * NZ);
  damage = new Float32Array(NX * NY * NZ);
  erod = new Float32Array(NX * NY * NZ);
  energy = new Float32Array(NX * NY * NZ);
  step = 0;
  erodedVoxels = 0;
  collapsedVoxels = 0;
  initialVoxels = 0;
  stageHistory: { stage: Stage; step: number }[] = [];

  constructor(public p: ArchParams = defaultArchParams()) {
    this.reset();
  }

  reset() {
    const p = this.p;
    this.solid.fill(0);
    this.damage.fill(0);
    this.step = 0;
    this.erodedVoxels = 0;
    this.collapsedVoxels = 0;
    for (let z = 0; z < NZ; z++)
      for (let y = 0; y < NY; y++)
        for (let x = 0; x < NX; x++) {
          const i = idx(x, y, z);
          const mainland = y < COAST_Y && z < p.cliffTop;
          const head = x >= p.headX0 && x < p.headX1 && y < p.headY && z < p.cliffTop;
          const bed = z < BED_Z;
          this.solid[i] = mainland || head || bed ? 1 : 0;
          const joint = Math.abs(y - p.jointY) <= 1 && x >= p.headX0 && x < p.headX1;
          this.erod[i] = (joint ? p.jointFactor : 1) * (0.75 + 0.5 * hash(x, y, z, p.seed));
        }
    this.initialVoxels = this.count();
    this.stageHistory = [{ stage: 'headland', step: 0 }];
  }

  get currentStage(): Stage {
    return this.stageHistory[this.stageHistory.length - 1].stage;
  }

  count(): number {
    let n = 0;
    for (let i = 0; i < this.solid.length; i++) n += this.solid[i];
    return n;
  }

  isSolid(x: number, y: number, z: number): boolean {
    if (x < 0 || y < 0 || z < 0 || x >= NX || y >= NY || z >= NZ) return false;
    return this.solid[idx(x, y, z)] === 1;
  }

  /** Wave energy in empty voxels of the wave and spray bands (BFS from the open sea). */
  private waveField() {
    const p = this.p;
    const e = this.energy;
    e.fill(0);
    const zLo = Math.max(BED_Z, p.seaLevel - 1);
    const zHi = Math.min(NZ - 1, p.seaLevel + 2);
    const dist = new Int16Array(NX * NY * NZ).fill(-1);
    const queue: number[] = [];
    for (let z = zLo; z <= zHi; z++)
      for (let y = COAST_Y; y < NY; y++)
        for (let x = 0; x < NX; x++) {
          const open = x < p.headX0 || x >= p.headX1 || y >= p.headY;
          const i = idx(x, y, z);
          if (open && !this.solid[i]) {
            dist[i] = 0;
            queue.push(i);
          }
        }
    for (let q = 0; q < queue.length; q++) {
      const i = queue[q];
      const z = Math.floor(i / (NX * NY));
      const y = Math.floor((i % (NX * NY)) / NX);
      const x = i % NX;
      for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
        const xx = x + dx;
        const yy = y + dy;
        const zz = z + dz;
        if (xx < 0 || yy < 0 || xx >= NX || yy >= NY || zz < zLo || zz > zHi) continue;
        const j = idx(xx, yy, zz);
        if (this.solid[j] || dist[j] >= 0) continue;
        dist[j] = dist[i] + 1;
        queue.push(j);
      }
    }
    for (let i = 0; i < dist.length; i++) if (dist[i] >= 0) e[i] = Math.pow(0.8, dist[i]);
    // Bays: refraction spreads wave energy and the bay beach absorbs most of what arrives, so the
    // mainland shore outside the headland (y < COAST_Y + 3) gets only BAY_FACTOR of it.
    for (let z = zLo; z <= zHi; z++)
      for (let y = 0; y < COAST_Y + 3; y++)
        for (let x = 0; x < NX; x++) if (x < p.headX0 || x >= p.headX1) e[idx(x, y, z)] *= BAY_FACTOR;
    // Spray band outside; surge + compressed air rising inside caves/arches (headland footprint).
    for (let z = zHi + 1; z < NZ; z++)
      for (let y = 0; y < NY; y++)
        for (let x = 0; x < NX; x++) {
          const i = idx(x, y, z);
          if (this.solid[i]) continue;
          const below = e[idx(x, y, z - 1)];
          if (below <= 0) continue;
          const inside = x >= p.headX0 && x < p.headX1 && y >= COAST_Y && y < p.headY;
          if (inside) e[i] = below * (z === zHi + 1 ? 0.6 : 0.85);
          else if (z <= p.seaLevel + 5) e[i] = below * (z === zHi + 1 ? 0.2 : 0.6);
        }
  }

  /** Advance one step. Returns the current detected stage. */
  advance(): Stage {
    const p = this.p;
    this.waveField();
    const e = this.energy;
    const removed: number[] = [];
    for (let z = BED_Z; z < NZ; z++)
      for (let y = 0; y < NY; y++)
        for (let x = 0; x < NX; x++) {
          const i = idx(x, y, z);
          if (!this.solid[i]) continue;
          let wave = 0;
          let air = 0;
          for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
            const xx = x + dx;
            const yy = y + dy;
            const zz = z + dz;
            if (xx < 0 || yy < 0 || zz < 0 || xx >= NX || yy >= NY || zz >= NZ) continue;
            const j = idx(xx, yy, zz);
            if (this.solid[j]) continue;
            wave += e[j];
            if (zz > p.seaLevel) air++;
          }
          if (wave === 0 && air === 0) continue;
          this.damage[i] += (wave * p.waveRate + air * p.weatherRate) * this.erod[i];
          if (this.damage[i] >= 1) removed.push(i);
        }
    for (const i of removed) this.solid[i] = 0;
    this.erodedVoxels += removed.length;
    this.collapse();
    this.step++;
    const raw = this.stage();
    const cur = this.currentStage;
    const st = STAGE_ORDER.indexOf(raw) > STAGE_ORDER.indexOf(cur) ? raw : cur;
    if (st !== cur) this.stageHistory.push({ stage: st, step: this.step });
    return st;
  }

  /** Remove solid voxels not connected to the seabed layer (they fall). */
  private collapse() {
    const seen = new Uint8Array(this.solid.length);
    const queue: number[] = [];
    for (let y = 0; y < NY; y++)
      for (let x = 0; x < NX; x++) {
        const i = idx(x, y, 0);
        if (this.solid[i]) {
          seen[i] = 1;
          queue.push(i);
        }
      }
    for (let q = 0; q < queue.length; q++) {
      const i = queue[q];
      const z = Math.floor(i / (NX * NY));
      const y = Math.floor((i % (NX * NY)) / NX);
      const x = i % NX;
      for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
        const xx = x + dx;
        const yy = y + dy;
        const zz = z + dz;
        if (xx < 0 || yy < 0 || zz < 0 || xx >= NX || yy >= NY || zz >= NZ) continue;
        const j = idx(xx, yy, zz);
        if (this.solid[j] && !seen[j]) {
          seen[j] = 1;
          queue.push(j);
        }
      }
    }
    let fell = 0;
    for (let i = 0; i < this.solid.length; i++)
      if (this.solid[i] && !seen[i]) {
        this.solid[i] = 0;
        fell++;
      }
    this.collapsedVoxels += fell;
  }

  /** Solid voxels above the high-water mark (seaLevel + 2) connected to the mainland, from a mainland seed. */
  private aboveWaterComponents(): { mainland: Uint8Array; seaward: number; seawardTop: number } {
    const zW = this.p.seaLevel + 2;
    const comp = new Uint8Array(this.solid.length);
    const queue: number[] = [];
    for (let z = zW + 1; z < NZ; z++)
      for (let x = 0; x < NX; x++) {
        const i = idx(x, 0, z);
        if (this.solid[i]) {
          comp[i] = 1;
          queue.push(i);
        }
      }
    for (let q = 0; q < queue.length; q++) {
      const i = queue[q];
      const z = Math.floor(i / (NX * NY));
      const y = Math.floor((i % (NX * NY)) / NX);
      const x = i % NX;
      for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
        const xx = x + dx;
        const yy = y + dy;
        const zz = z + dz;
        if (xx < 0 || yy < 0 || xx >= NX || yy >= NY || zz <= zW || zz >= NZ) continue;
        const j = idx(xx, yy, zz);
        if (this.solid[j] && !comp[j]) {
          comp[j] = 1;
          queue.push(j);
        }
      }
    }
    let seaward = 0;
    let seawardTop = 0;
    for (let z = zW + 1; z < NZ; z++)
      for (let y = this.p.jointY; y < NY; y++)
        for (let x = 0; x < NX; x++) {
          const i = idx(x, y, z);
          if (this.solid[i] && !comp[i]) {
            seaward++;
            seawardTop = Math.max(seawardTop, z);
          }
        }
    return { mainland: comp, seaward, seawardTop };
  }

  /**
   * Arch: at some row y, water passes from the west side to the east side of the headland within
   * the slab y ± 1 (below seaLevel + 3), rock roofs the passage above high water at that row, and
   * an above-water seaward block of rock stands beyond it.
   */
  hasArchOpening(): boolean {
    const p = this.p;
    const zHi = p.seaLevel + 3;
    const zRoof = p.seaLevel + 3;
    const mid = (p.headX0 + p.headX1) >> 1;
    for (let y = COAST_Y + 2; y < p.headY - 3; y++) {
      let roof = false;
      for (let z = zRoof; z < NZ && !roof; z++) for (let x = p.headX0; x < p.headX1 && !roof; x++) if (this.isSolid(x, y, z) && Math.abs(x - mid) < 3) roof = true;
      if (!roof) continue;
      let seaward = false;
      for (let yy = y + 2; yy < p.headY && !seaward; yy++) for (let z = p.seaLevel + 3; z < NZ && !seaward; z++) if (this.isSolid(mid, yy, z)) seaward = true;
      if (!seaward) continue;
      // Flood across the slab from the west edge.
      const seen = new Uint8Array(NX * 3 * NZ);
      const key = (x: number, dy: number, z: number) => (z * 3 + dy) * NX + x;
      const q: [number, number, number][] = [];
      for (let dy = 0; dy < 3; dy++)
        for (let z = BED_Z; z <= zHi; z++)
          if (!this.isSolid(p.headX0 - 1, y - 1 + dy, z)) {
            seen[key(p.headX0 - 1, dy, z)] = 1;
            q.push([p.headX0 - 1, dy, z]);
          }
      for (let k = 0; k < q.length; k++) {
        const [x, dy, z] = q[k];
        if (x >= p.headX1) return true;
        for (const [ax, ay, az] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
          const xx = x + ax;
          const dd = dy + ay;
          const zz = z + az;
          if (xx < p.headX0 - 1 || xx > p.headX1 || dd < 0 || dd > 2 || zz < BED_Z || zz > zHi) continue;
          if (seen[key(xx, dd, zz)] || this.isSolid(xx, y - 1 + dd, zz)) continue;
          seen[key(xx, dd, zz)] = 1;
          q.push([xx, dd, zz]);
        }
      }
    }
    return false;
  }

  /**
   * Cave depth: the deepest localised penetration of the sea into the headland's side faces —
   * the maximum over rows of the cut depth minus the median cut depth (the general notch).
   */
  caveDepth(): number {
    const p = this.p;
    const depths: number[] = [];
    for (let y = COAST_Y + 1; y < p.headY - 2; y++) {
      let d = 0;
      for (let z = p.seaLevel - 1; z <= p.seaLevel + 2; z++) {
        let w = 0;
        for (let x = p.headX0; x < p.headX1 && !this.isSolid(x, y, z); x++) w++;
        let e = 0;
        for (let x = p.headX1 - 1; x >= p.headX0 && !this.isSolid(x, y, z); x--) e++;
        d = Math.max(d, w, e);
      }
      depths.push(d);
    }
    if (!depths.length) return 0;
    const sorted = [...depths].sort((a, b) => a - b);
    return Math.max(...depths) - sorted[sorted.length >> 1];
  }

  stage(): Stage {
    const p = this.p;
    const { seaward, seawardTop } = this.aboveWaterComponents();
    // Anything left of the seaward end of the headland at all?
    let seawardSolid = 0;
    let seawardMaxZ = 0;
    for (let z = BED_Z; z < NZ; z++)
      for (let y = p.jointY + 1; y < NY; y++)
        for (let x = p.headX0 - 2; x < p.headX1 + 2; x++)
          if (this.isSolid(x, y, z)) {
            seawardSolid++;
            seawardMaxZ = Math.max(seawardMaxZ, z);
          }
    if (seawardSolid === 0) return 'gone';
    if (seaward > 0 && seawardTop > p.seaLevel + 2) return 'stack';
    if (this.hasArchOpening()) return 'arch';
    // Seaward block no longer reaches above high water and is not joined above it → stump.
    if (seawardMaxZ <= p.seaLevel + 2) return 'stump';
    if (this.caveDepth() >= 2) return 'cave';
    return 'headland';
  }
}
