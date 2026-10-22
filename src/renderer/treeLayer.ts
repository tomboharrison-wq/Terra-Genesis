import { Color, ConeGeometry, Group, IcosahedronGeometry, InstancedMesh, Matrix4, MeshStandardMaterial, Quaternion, Vector3 } from 'three';
import type { Engine } from '../engine/engine';
import { TREELINE_WARM_C } from '../sim/vegetation/vegetationSim';

const MAX_TREES = 40000;
const PER_CELL = 2;

function hash(i: number, k: number): number {
  let h = (i * 374761393 + k * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * Instanced trees drawn from the simulated plant cover (src/sim/vegetation). Each land cell holds
 * up to PER_CELL tree symbols, the count set by its cover (deterministic per cell, so trees do not
 * flicker between rebuilds). Cool cells (warmest month < 12 °C) get conifers, warm cells broadleaf
 * crowns. Trees are symbols: drawn at least 0.7 cell tall so forests stay visible on coarse maps.
 */
export class TreeLayer {
  readonly group = new Group();
  private conifers: InstancedMesh;
  private broadleaf: InstancedMesh;
  private geoms = [new ConeGeometry(0.32, 1, 6), new IcosahedronGeometry(0.42, 0)];
  private mats = [new MeshStandardMaterial({ roughness: 0.9, flatShading: true }), new MeshStandardMaterial({ roughness: 0.9, flatShading: true })];

  constructor(private engine: Engine) {
    this.geoms[0].translate(0, 0.5, 0);
    this.geoms[1].translate(0, 0.62, 0);
    this.conifers = new InstancedMesh(this.geoms[0], this.mats[0], MAX_TREES);
    this.broadleaf = new InstancedMesh(this.geoms[1], this.mats[1], MAX_TREES);
    for (const m of [this.conifers, this.broadleaf]) {
      m.castShadow = true;
      m.count = 0;
      m.frustumCulled = false;
      this.group.add(m);
    }
  }

  /** Rebuild instances from plant cover and the displayed surface (ground + ice). */
  rebuild() {
    const e = this.engine;
    const w = e.world;
    const W = w.width;
    const H = w.height;
    const cs = w.cellSizeM;
    const z = e.surface;
    const c = w.climate;
    const lapse = c.lapseRateCPerKm / 1000;
    const size = Math.max(14, 0.7 * cs);
    const m4 = new Matrix4();
    const q = new Quaternion();
    const pos = new Vector3();
    const scl = new Vector3();
    const col = new Color();
    let nc = 0;
    let nb = 0;
    for (let y = 0; y < H && nc + nb < 2 * MAX_TREES; y++)
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        const cov = w.vegCover[i];
        if (cov < 0.15 || w.iceThicknessM[i] > 0.5 || z[i] < w.seaLevelM) continue;
        const n = Math.floor(cov * PER_CELL + hash(i, 7));
        const tWarm = c.seaLevelTempC + c.seasonalAmpC - lapse * Math.max(0, z[i] - w.seaLevelM);
        const conifer = tWarm < 12;
        for (let k = 0; k < n; k++) {
          const mesh = conifer ? this.conifers : this.broadleaf;
          const idx = conifer ? nc : nb;
          if (idx >= MAX_TREES) break;
          const jx = (hash(i, 2 * k + 1) - 0.5) * cs * 0.8;
          const jy = (hash(i, 2 * k + 2) - 0.5) * cs * 0.8;
          const s = size * (0.75 + 0.5 * hash(i, 31 + k)) * (0.6 + 0.4 * Math.min(1, (tWarm - TREELINE_WARM_C) / 8));
          // three.x = east, three.z = −north (src/utils/axes.ts).
          pos.set(x * cs + jx, z[i] - 0.05 * s, -(y * cs + jy));
          scl.set(s, s * (conifer ? 1.6 : 1), s);
          m4.compose(pos, q, scl);
          mesh.setMatrixAt(idx, m4);
          const g = 0.75 + 0.35 * hash(i, 53 + k);
          col.setHex(conifer ? 0x2c4a2a : 0x3f6b2e).multiplyScalar(g);
          mesh.setColorAt(idx, col);
          if (conifer) nc++;
          else nb++;
        }
      }
    this.conifers.count = nc;
    this.broadleaf.count = nb;
    for (const m of [this.conifers, this.broadleaf]) {
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
  }
}
