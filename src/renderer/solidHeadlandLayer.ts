import { BoxGeometry, BufferGeometry, Color, Float32BufferAttribute, Group, Mesh, MeshStandardMaterial } from 'three';
import { BED_Z, NX, NY, NZ } from '../local/arch/model';
import { headlandModel, type SolidHeadland } from '../sim/coast/solidHeadland';
import { FALL_NX, FALL_NY, FALL_NZ, waterfallSolid, type SolidWaterfall } from '../sim/river/solidWaterfall';

/** Draws the actual surviving solid rock in the main scene. No stage-specific geometry. */
export class SolidHeadlandLayer {
  readonly group = new Group();
  private material = new MeshStandardMaterial({ vertexColors: true, roughness: 0.95, emissive: 0x928c7c, emissiveIntensity: 0.15 });
  private mesh = new Mesh(new BufferGeometry(), this.material);
  private last: SolidHeadland | SolidWaterfall | undefined;
  private lastStep = -1;

  constructor() {
    this.group.add(this.mesh);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = false; // Adjacent one-metre blocks otherwise produce shadow-map seams.
  }

  update(headland?: SolidHeadland, waterfall?: SolidWaterfall): void {
    const s = headland ?? waterfall;
    this.group.visible = !!s;
    if (!s || (s === this.last && s.step === this.lastStep)) return;
    this.last = s;
    this.lastStep = s.step;
    const m = headland ? headlandModel(headland) : null;
    const solid = (x: number, y: number, z: number) => waterfall ? waterfallSolid(waterfall, x, y, z) : m!.isSolid(x, y, z);
    const W = waterfall ? FALL_NX : NX, H = waterfall ? FALL_NY : NY, Z = waterfall ? FALL_NZ : NZ;
    const colour = new Color();
    const box = new BoxGeometry(1, 1, 1), bp = box.attributes.position, bn = box.attributes.normal;
    const positions: number[] = [], normals: number[] = [], colours: number[] = [], indices: number[] = [];
    for (let z = 0; z < Z; z++) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!solid(x, y, z)) continue;
      const joint = m && Math.abs(y - m.p.jointY) <= 1 && x >= m.p.headX0 && x < m.p.headX1;
      colour.setHex(waterfall ? z >= 26 ? 0x747a72 : 0xad9276 : z < BED_Z ? 0x81786a : joint ? 0xc3c0aa : 0xe5e0cc);
      colour.multiplyScalar(0.88 + z / NZ * 0.12);
      // Emit only exposed faces. Hidden coincident block faces cause seams at grazing angles.
      const hidden = [solid(x + 1, y, z), solid(x - 1, y, z), solid(x, y, z + 1),
        z === 0 || solid(x, y, z - 1), solid(x, y - 1, z), solid(x, y + 1, z)];
      for (let face = 0; face < 6; face++) {
        if (hidden[face]) continue;
        const offset = positions.length / 3;
        for (let k = 0; k < 4; k++) {
          const v = face * 4 + k;
          positions.push(bp.getX(v) + x + 0.5, bp.getY(v) + z + 0.5, bp.getZ(v) - y - 0.5);
          normals.push(bn.getX(v), bn.getY(v), bn.getZ(v));
          colours.push(colour.r, colour.g, colour.b);
        }
        for (let k = 0; k < 6; k++) indices.push(offset + box.index!.getX(face * 6 + k) - face * 4);
      }
    }
    box.dispose();
    this.mesh.geometry.dispose();
    this.mesh.geometry = new BufferGeometry();
    this.mesh.geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    this.mesh.geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
    this.mesh.geometry.setAttribute('color', new Float32BufferAttribute(colours, 3));
    this.mesh.geometry.setIndex(indices);
    this.mesh.geometry.computeBoundingSphere();
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
