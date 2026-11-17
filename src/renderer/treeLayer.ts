import {
  BufferAttribute,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Euler,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
} from 'three';
import type { Engine } from '../engine/engine';
import { sampleBilinear, slopeAt } from '../terrain/heightfield';
import { TREELINE_WARM_C } from '../sim/vegetation/vegetationSim';

const MAX_TREES = 40000;
const MAX_ROCKS = 16000;
const PER_CELL = 2;

function hash(i: number, k: number): number {
  let h = (i * 374761393 + k * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Combine non-indexed or indexed BufferGeometries into one single-draw-call BufferGeometry. */
function mergeParts(parts: BufferGeometry[]): BufferGeometry {
  const nonIndexed = parts.map((p) => (p.index ? p.toNonIndexed() : p));
  let totalVerts = 0;
  for (const g of nonIndexed) totalVerts += g.getAttribute('position').count;
  const pos = new Float32Array(totalVerts * 3);
  const nrm = new Float32Array(totalVerts * 3);
  let offset = 0;
  for (const g of nonIndexed) {
    const p = g.getAttribute('position').array as Float32Array;
    const n = g.getAttribute('normal').array as Float32Array;
    pos.set(p, offset);
    nrm.set(n, offset);
    offset += p.length;
    g.dispose();
  }
  const out = new BufferGeometry();
  out.setAttribute('position', new BufferAttribute(pos, 3));
  out.setAttribute('normal', new BufferAttribute(nrm, 3));
  return out;
}

function createConiferGeometry(): BufferGeometry {
  const trunk = new CylinderGeometry(0.06, 0.09, 0.28, 5);
  trunk.translate(0, 0.14, 0);
  const tier1 = new ConeGeometry(0.36, 0.52, 7);
  tier1.translate(0, 0.46, 0);
  const tier2 = new ConeGeometry(0.28, 0.46, 7);
  tier2.translate(0, 0.72, 0);
  const tier3 = new ConeGeometry(0.19, 0.38, 7);
  tier3.translate(0, 0.94, 0);
  const merged = mergeParts([trunk, tier1, tier2, tier3]);
  trunk.dispose();
  tier1.dispose();
  tier2.dispose();
  tier3.dispose();
  return merged;
}

function createBroadleafGeometry(): BufferGeometry {
  const trunk = new CylinderGeometry(0.06, 0.1, 0.34, 5);
  trunk.translate(0, 0.17, 0);
  const mainCrown = new IcosahedronGeometry(0.38, 1);
  mainCrown.scale(1.05, 0.88, 1.05);
  mainCrown.translate(0, 0.62, 0);
  const subCrown1 = new IcosahedronGeometry(0.26, 0);
  subCrown1.translate(0.16, 0.56, 0.12);
  const subCrown2 = new IcosahedronGeometry(0.24, 0);
  subCrown2.translate(-0.15, 0.68, -0.1);
  const merged = mergeParts([trunk, mainCrown, subCrown1, subCrown2]);
  trunk.dispose();
  mainCrown.dispose();
  subCrown1.dispose();
  subCrown2.dispose();
  return merged;
}

/**
 * Instanced trees and talus/moraine boulders drawn from simulated plant cover and loose sediment.
 * Uses bilinear ground clamping at each instance's exact jittered (x, y) world position so
 * trees and boulders never float in mid-air on steep valley walls.
 */
export class TreeLayer {
  readonly group = new Group();
  private conifers: InstancedMesh;
  private broadleaf: InstancedMesh;
  private rocks: InstancedMesh;
  private geoms = [createConiferGeometry(), createBroadleafGeometry(), new IcosahedronGeometry(0.45, 0)];
  private mats = [
    new MeshStandardMaterial({ roughness: 0.88, flatShading: true }),
    new MeshStandardMaterial({ roughness: 0.85, flatShading: true }),
    new MeshStandardMaterial({ roughness: 0.92, flatShading: true }),
  ];

  constructor(private engine: Engine) {
    this.geoms[2].translate(0, 0.22, 0);
    this.conifers = new InstancedMesh(this.geoms[0], this.mats[0], MAX_TREES);
    this.broadleaf = new InstancedMesh(this.geoms[1], this.mats[1], MAX_TREES);
    this.rocks = new InstancedMesh(this.geoms[2], this.mats[2], MAX_ROCKS);
    for (const m of [this.conifers, this.broadleaf, this.rocks]) {
      m.castShadow = true;
      m.receiveShadow = true;
      m.count = 0;
      m.frustumCulled = false;
      this.group.add(m);
    }
  }

  /** Rebuild instances from plant cover, talus/moraine cover, and the displayed surface. */
  rebuild() {
    const e = this.engine;
    const w = e.world;
    const W = w.width;
    const H = w.height;
    const cs = w.cellSizeM;
    const z = e.surface;
    const hf = e.heightfield;
    const c = w.climate;
    const lapse = c.lapseRateCPerKm / 1000;
    const size = Math.max(12, 0.58 * cs);
    const m4 = new Matrix4();
    const q = new Quaternion();
    const euler = new Euler();
    const pos = new Vector3();
    const scl = new Vector3();
    const col = new Color();
    let nc = 0;
    let nb = 0;
    let nr = 0;
    const maxX = (W - 1) * cs;
    const maxY = (H - 1) * cs;

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (z[i] < w.seaLevelM || w.lavaDepthM[i] > 0.05) continue;

        // 1. Trees from simulated vegetation cover
        const cov = w.vegCover[i];
        if (cov >= 0.15 && w.iceThicknessM[i] <= 0.5 && nc + nb < 2 * MAX_TREES) {
          const n = Math.floor(cov * PER_CELL + hash(i, 7));
          const tWarm = c.seaLevelTempC + c.seasonalAmpC - lapse * Math.max(0, z[i] - w.seaLevelM);
          const conifer = tWarm < 12;
          for (let k = 0; k < n; k++) {
            const mesh = conifer ? this.conifers : this.broadleaf;
            const idx = conifer ? nc : nb;
            if (idx >= MAX_TREES) break;
            const jx = (hash(i, 2 * k + 1) - 0.5) * cs * 0.8;
            const jy = (hash(i, 2 * k + 2) - 0.5) * cs * 0.8;
            const wx = Math.max(0, Math.min(maxX, x * cs + jx));
            const wy = Math.max(0, Math.min(maxY, y * cs + jy));
            const gz = sampleBilinear(hf, wx, wy);
            const s = size * (0.72 + 0.52 * hash(i, 31 + k)) * (0.62 + 0.38 * Math.min(1, (tWarm - TREELINE_WARM_C) / 8));
            pos.set(wx, gz - 0.04 * s, -wy);
            euler.set((hash(i, 71 + k) - 0.5) * 0.08, hash(i, 83 + k) * Math.PI * 2, (hash(i, 97 + k) - 0.5) * 0.08);
            q.setFromEuler(euler);
            scl.set(s, s * (conifer ? 1.45 : 1.05), s);
            m4.compose(pos, q, scl);
            mesh.setMatrixAt(idx, m4);
            const g = 0.76 + 0.34 * hash(i, 53 + k);
            col.setHex(conifer ? 0x294827 : 0x3b682b).multiplyScalar(g);
            mesh.setColorAt(idx, col);
            if (conifer) nc++;
            else nb++;
          }
        }

        // 2. Instanced boulders on steep talus aprons and glacial moraines
        if (nr < MAX_ROCKS && w.iceThicknessM[i] <= 0.3 && cov < 0.35) {
          const sed = w.looseSedimentThicknessM[i];
          const slp = slopeAt(hf, x, y);
          const isTalus = sed > 0.25 && slp > 0.42 && slp < 1.25;
          if (isTalus && hash(i, 113) < 0.28) {
            const jx = (hash(i, 131) - 0.5) * cs * 0.75;
            const jy = (hash(i, 137) - 0.5) * cs * 0.75;
            const wx = Math.max(0, Math.min(maxX, x * cs + jx));
            const wy = Math.max(0, Math.min(maxY, y * cs + jy));
            const gz = sampleBilinear(hf, wx, wy);
            const rs = Math.max(4, cs * 0.22) * (0.55 + 0.75 * hash(i, 149));
            pos.set(wx, gz - 0.08 * rs, -wy);
            euler.set(hash(i, 151) * Math.PI, hash(i, 157) * Math.PI * 2, hash(i, 163) * Math.PI);
            q.setFromEuler(euler);
            scl.set(rs * (0.8 + 0.4 * hash(i, 167)), rs * (0.55 + 0.35 * hash(i, 173)), rs * (0.8 + 0.4 * hash(i, 179)));
            m4.compose(pos, q, scl);
            this.rocks.setMatrixAt(nr, m4);
            const shade = 0.65 + 0.3 * hash(i, 181);
            col.setHex(0x6e685f).multiplyScalar(shade);
            this.rocks.setColorAt(nr, col);
            nr++;
          }
        }
      }
    }
    this.conifers.count = nc;
    this.broadleaf.count = nb;
    this.rocks.count = nr;
    for (const m of [this.conifers, this.broadleaf, this.rocks]) {
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  }

  get count() {
    return this.conifers.count + this.broadleaf.count;
  }

  dispose() {
    for (const g of this.geoms) g.dispose();
    for (const m of this.mats) m.dispose();
    this.conifers.dispose();
    this.broadleaf.dispose();
    this.rocks.dispose();
  }
}
