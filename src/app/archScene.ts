import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { BED_Z, NX, NY, NZ, type ArchModel } from '../local/arch/model';
import { MATERIALS } from '../terrain/materials';

/** Voxels with at least one empty neighbour (only these can be seen). */
function exposed(m: ArchModel): number[] {
  const out: number[] = [];
  for (let z = 0; z < NZ; z++)
    for (let y = 0; y < NY; y++)
      for (let x = 0; x < NX; x++) {
        if (!m.isSolid(x, y, z)) continue;
        if (
          !m.isSolid(x + 1, y, z) ||
          !m.isSolid(x - 1, y, z) ||
          !m.isSolid(x, y + 1, z) ||
          !m.isSolid(x, y - 1, z) ||
          !m.isSolid(x, y, z + 1) ||
          (z > 0 && !m.isSolid(x, y, z - 1))
        )
          out.push((z * NY + y) * NX + x);
      }
  return out;
}

/**
 * Three.js scene for the cave → arch → stack → stump voxel model (shared by the lab and the lessons).
 * Draws exactly the model's solid voxels. Call rebuild() after the model changes and render() each frame.
 */
export function createArchScene(el: HTMLElement, getModel: () => ArchModel, getRock: () => string) {
  const model = {
    get current() {
      return getModel();
    },
  };
  const rockRef = {
    get current() {
      return getRock();
    },
  };
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
  el.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xcfe0ec);
  const camera = new THREE.PerspectiveCamera(40, 1, 0.5, 500);
  // Model x → three x (along the coast), z → up, y (seaward) → −z.
  camera.position.set(NX + 26, 30, -NY - 14);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(NX * 0.5, 9, -20);
  controls.update();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x6b5a48, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 1.8);
  sun.position.set(30, 60, -80);
  scene.add(sun);

  const box = new THREE.BoxGeometry(1, 1, 1);
  const mat = new THREE.MeshLambertMaterial();
  const mesh = new THREE.InstancedMesh(box, mat, NX * NY * NZ);
  scene.add(mesh);
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(NX + 20, NY + 20),
    new THREE.MeshLambertMaterial({
      color: 0x2f78b0,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(NX / 2, model.current.p.seaLevel + 0.5, -NY / 2 - 10);
  scene.add(sea);

  const mtx = new THREE.Matrix4();
  const col = new THREE.Color();
  const rockCol = new THREE.Color();
  const jointCol = new THREE.Color();
  const bed = new THREE.Color(0x7d7466);
  const build = () => {
    const m = model.current;
    const list = exposed(m);
    rockCol.setHex(MATERIALS.find((q) => q.key === rockRef.current)!.colour).multiplyScalar(1.15);
    jointCol.copy(rockCol).multiplyScalar(0.82);
    for (let k = 0; k < list.length; k++) {
      const i = list[k];
      const z = Math.floor(i / (NX * NY));
      const y = Math.floor((i % (NX * NY)) / NX);
      const x = i % NX;
      mtx.makeTranslation(x + 0.5, z + 0.5, -(y + 0.5));
      mesh.setMatrixAt(k, mtx);
      const inJoint = Math.abs(y - m.p.jointY) <= 1 && x >= m.p.headX0 && x < m.p.headX1;
      col.copy(z < BED_Z ? bed : inJoint ? jointCol : rockCol).multiplyScalar(0.82 + 0.18 * (z / NZ));
      mesh.setColorAt(k, col);
    }
    mesh.count = list.length;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  };
  const rebuild = build;
  const resize = () => {
    const w = el.clientWidth;
    const h = el.clientHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(el);
  return {
    rebuild,
    render: () => {
      controls.update();
      renderer.render(scene, camera);
    },
    dispose: () => {
      ro.disconnect();
      controls.dispose();
      box.dispose();
      mat.dispose();
      mesh.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
