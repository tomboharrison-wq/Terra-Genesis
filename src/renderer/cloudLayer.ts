import {
  BufferAttribute,
  BufferGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
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
import { MM_PER_H } from '../engine/world';

const MAX_CLOUDS = 96;

function hash(i: number, k: number): number {
  let h = (i * 374761393 + k * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function mergeGeoms(parts: BufferGeometry[]): BufferGeometry {
  const nonIdx = parts.map((p) => (p.index ? p.toNonIndexed() : p));
  let count = 0;
  for (const g of nonIdx) count += g.getAttribute('position').count;
  const pos = new Float32Array(count * 3);
  const nrm = new Float32Array(count * 3);
  let off = 0;
  for (const g of nonIdx) {
    pos.set(g.getAttribute('position').array as Float32Array, off);
    nrm.set(g.getAttribute('normal').array as Float32Array, off);
    off += g.getAttribute('position').count * 3;
    g.dispose();
  }
  const out = new BufferGeometry();
  out.setAttribute('position', new BufferAttribute(pos, 3));
  out.setAttribute('normal', new BufferAttribute(nrm, 3));
  return out;
}

/** Build a multi-puffed cumulus cloud geometry with a flat condensation base. */
function createCumulusGeometry(): BufferGeometry {
  const puffs: [number, number, number, number, number][] = [
    [0, 0.08, 0, 0.52, 0.36],
    [-0.36, 0.02, 0.08, 0.38, 0.28],
    [0.38, 0.04, -0.06, 0.4, 0.3],
    [0.08, 0.18, 0.24, 0.36, 0.28],
    [-0.14, 0.16, -0.24, 0.35, 0.26],
    [-0.58, -0.04, -0.05, 0.26, 0.2],
    [0.6, -0.03, 0.1, 0.28, 0.2],
  ];
  const parts: BufferGeometry[] = [];
  for (const [x, y, z, rx, ry] of puffs) {
    const g = new IcosahedronGeometry(1, 2);
    const p = g.getAttribute('position') as BufferAttribute;
    for (let k = 0; k < p.count; k++) {
      let py = p.getY(k);
      if (py < -0.2) py = -0.2 + (py + 0.2) * 0.25; // flatten cloud base at condensation level
      p.setXYZ(k, p.getX(k) * rx + x, py * ry + y, p.getZ(k) * rx + z);
    }
    g.computeVertexNormals();
    parts.push(g);
  }
  return mergeGeoms(parts);
}

/**
 * Dynamic 3D Cumulus Cloud & Rain-Shaft Layer (Terra Firma 2 style).
 * Clouds form preferentially over windward / high-rainfall orographic zones (`climate.rainFactor`)
 * and drift across the map with the prevailing wind (`climate.windFromDeg`), casting soft shadows
 * onto the terrain and dropping translucent rain shafts when rainfall is active.
 */
export class CloudLayer {
  readonly group = new Group();
  private clouds: InstancedMesh;
  private rainShafts: InstancedMesh;
  private cloudGeo = createCumulusGeometry();
  private shaftGeo = new CylinderGeometry(0.45, 0.58, 1, 8, 1, true);
  private cloudMat = new MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.96,
    metalness: 0,
    transparent: true,
    opacity: 0.88,
  });
  private shaftMat = new MeshStandardMaterial({
    color: 0x8faec7,
    roughness: 1,
    metalness: 0,
    transparent: true,
    opacity: 0.18,
    side: DoubleSide,
    depthWrite: false,
  });
  private enabled = false;
  private timeS = 0;

  constructor(private engine: Engine) {
    this.shaftGeo.translate(0, -0.5, 0);
    this.clouds = new InstancedMesh(this.cloudGeo, this.cloudMat, MAX_CLOUDS);
    this.rainShafts = new InstancedMesh(this.shaftGeo, this.shaftMat, MAX_CLOUDS);
    this.clouds.castShadow = true;
    this.clouds.receiveShadow = false;
    this.clouds.frustumCulled = false;
    this.rainShafts.frustumCulled = false;
    this.rainShafts.renderOrder = 4;
    this.group.add(this.clouds, this.rainShafts);
    this.group.visible = false;
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    this.group.visible = on;
    if (on) this.update(0);
  }

  update(dt: number) {
    if (!this.enabled) return;
    this.timeS += dt;
    const w = this.engine.world;
    const W = w.width;
    const H = w.height;
    const cs = w.cellSizeM;
    const ex = (W - 1) * cs;
    const ey = (H - 1) * cs;
    const size = Math.max(ex, ey);
    const zMax = Math.max(w.seaLevelM + 200, (w.meta.reliefM || 400) * 1.15);
    const baseAlt = zMax + size * 0.08;
    const rainMmH = w.water.rainMPerS / MM_PER_H;
    const isRaining = rainMmH > 1;
    const stormDark = Math.min(1, rainMmH / 80);

    // Wind direction (windFromDeg is direction wind blows FROM, clockwise from North)
    const windFromRad = ((w.climate.windFromDeg ?? 240) * Math.PI) / 180;
    const windVx = -Math.sin(windFromRad) * size * 0.025;
    const windVy = -Math.cos(windFromRad) * size * 0.025;

    const rf = this.engine.climate.rainFactor;
    const m4 = new Matrix4();
    const q = new Quaternion();
    const euler = new Euler();
    const pos = new Vector3();
    const scl = new Vector3();
    const col = new Color();

    const cloudCount = Math.min(MAX_CLOUDS, isRaining ? 64 : 36);
    let nShafts = 0;

    for (let k = 0; k < cloudCount; k++) {
      // Deterministic base position + wind advection wrapped smoothly across map bounds
      const u0 = hash(k + 1, 11);
      const v0 = hash(k + 1, 23);
      const wx = (((u0 * ex + windVx * this.timeS * (0.75 + 0.5 * hash(k, 31))) % ex) + ex) % ex;
      const wy = (((v0 * ey + windVy * this.timeS * (0.75 + 0.5 * hash(k, 37))) % ey) + ey) % ey;

      // Fade opacity/scale near map perimeter so clouds appear and vanish smoothly at boundaries
      const edgeDist = Math.min(wx, ex - wx, wy, ey - wy) / (size * 0.12);
      const edgeScale = Math.min(1, Math.max(0.01, edgeDist));

      const cx = Math.min(W - 1, Math.max(0, Math.round(wx / cs)));
      const cy = Math.min(H - 1, Math.max(0, Math.round(wy / cs)));
      const cellIdx = cy * W + cx;
      const localRainF = w.climate.enabled ? rf[cellIdx] : 1;
      const groundZ = Math.max(w.seaLevelM, this.engine.surface[cellIdx]);

      // Clouds swell over orographic uplift zones and shrink in rain shadows
      const oroScale = Math.min(1.6, Math.max(0.35, 0.55 + 0.55 * localRainF));
      const cSize = size * (0.065 + 0.055 * hash(k, 43)) * oroScale * edgeScale;
      const alt = baseAlt + hash(k, 59) * size * 0.04;

      pos.set(wx, alt, -wy);
      euler.set(0, hash(k, 67) * Math.PI * 2, 0);
      q.setFromEuler(euler);
      scl.set(cSize, cSize * (0.65 + 0.25 * stormDark), cSize);
      m4.compose(pos, q, scl);
      this.clouds.setMatrixAt(k, m4);

      const grey = (0.96 - 0.32 * stormDark * Math.min(1.4, localRainF)) * (0.9 + 0.1 * hash(k, 73));
      col.setRGB(grey, grey * 1.01, grey * 1.04);
      this.clouds.setColorAt(k, col);

      // Rain shafts beneath heavy rain / storm clouds
      if (isRaining && localRainF > 0.65 && edgeScale > 0.35 && k % 2 === 0) {
        const shaftH = Math.max(10, alt - groundZ);
        pos.set(wx, alt - cSize * 0.08, -wy);
        q.identity();
        scl.set(cSize * 0.65, shaftH, cSize * 0.65);
        m4.compose(pos, q, scl);
        this.rainShafts.setMatrixAt(nShafts++, m4);
      }
    }

    this.clouds.count = cloudCount;
    this.rainShafts.count = nShafts;
    this.clouds.instanceMatrix.needsUpdate = true;
    if (this.clouds.instanceColor) this.clouds.instanceColor.needsUpdate = true;
    this.rainShafts.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    this.cloudGeo.dispose();
    this.shaftGeo.dispose();
    this.cloudMat.dispose();
    this.shaftMat.dispose();
    this.clouds.dispose();
    this.rainShafts.dispose();
  }
}
