import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { waterfallSolidGeometry, WATERFALL_DEFAULTS } from '../local/waterfall/model';

/** Interactive solid view of the waterfall teaching model. */
export function createWaterfallScene(el: HTMLElement, getYears: () => number) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
  renderer.shadowMap.enabled = true;
  el.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xcfe0ec);
  scene.fog = new THREE.Fog(0xcfe0ec, 150, 260);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.5, 500);
  camera.position.set(42, 43, 78);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.target.set(-26, 7, 0);
  controls.update();

  scene.add(new THREE.HemisphereLight(0xffffff, 0x69523c, 1.8));
  const sun = new THREE.DirectionalLight(0xfff5db, 2.4);
  sun.position.set(-30, 80, 45);
  sun.castShadow = true;
  scene.add(sun);

  const group = new THREE.Group();
  scene.add(group);
  const disposable: (THREE.BufferGeometry | THREE.Material)[] = [];
  const material = (colour: number, options: THREE.MeshLambertMaterialParameters = {}) => {
    const m = new THREE.MeshLambertMaterial({ color: colour, ...options });
    disposable.push(m);
    return m;
  };
  const hardMat = material(0x65615d);
  const softMat = material(0xb99a6d);
  const darkSoftMat = material(0x806446);
  const bankMat = material(0x718451);
  const waterMat = material(0x327fc1, { transparent: true, opacity: 0.72, side: THREE.DoubleSide, depthWrite: false });
  const foamMat = material(0xdcefff, { transparent: true, opacity: 0.82, side: THREE.DoubleSide, depthWrite: false });

  const addBox = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, mat: THREE.Material) => {
    const geo = new THREE.BoxGeometry(Math.max(0.05, x1 - x0), Math.max(0.05, z1 - z0), Math.max(0.05, y1 - y0));
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set((x0 + x1) / 2, (z0 + z1) / 2, -(y0 + y1) / 2);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  };

  const rebuild = () => {
    group.traverse((o) => {
      if (o instanceof THREE.Mesh) o.geometry.dispose();
    });
    while (group.children.length) group.remove(group.children[0]);
    const g = waterfallSolidGeometry(getYears());
    const s = g.state;
    const half = g.widthM / 2;

    addBox(g.soft.x0, g.soft.x1, -half, half, g.soft.z0, g.soft.z1, softMat);
    addBox(g.cap.x0, g.cap.x1, -half, half, g.cap.z0, g.cap.z1, hardMat);

    // Gorge walls are solid side blocks separated by the channel carved by retreat.
    if (g.gorge) {
      const ch = g.gorge.channelWidthM / 2;
      addBox(g.gorge.x0, g.gorge.x1, -half, -ch, 0, g.gorge.wallTopM, darkSoftMat);
      addBox(g.gorge.x0, g.gorge.x1, ch, half, 0, g.gorge.wallTopM, darkSoftMat);
    }
    addBox(Math.max(g.cap.x1, 0), 62, -half, half, -3, 0, bankMat);

    // Upper river, falling curtain and the lower channel are separate water surfaces.
    addBox(-118, g.cap.x1 + 0.25, -5.5, 5.5, WATERFALL_DEFAULTS.heightM + 0.12, WATERFALL_DEFAULTS.heightM + 0.65, waterMat);
    const curtainHeight = WATERFALL_DEFAULTS.heightM + 0.4;
    addBox(g.cap.x1 - 0.1, g.cap.x1 + 0.45, -5.6, 5.6, 0.2, curtainHeight, waterMat);
    addBox(g.cap.x1 + 0.4, 62, -5.5, 5.5, 0.05, 0.48, waterMat);

    const poolGeo = new THREE.SphereGeometry(1, 36, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    const pool = new THREE.Mesh(poolGeo, waterMat);
    pool.scale.set(g.pool.lengthM / 2, Math.max(0.3, g.pool.depthM), g.pool.widthM / 2);
    pool.position.set(g.pool.x, 0.25, 0);
    pool.rotation.x = Math.PI;
    group.add(pool);

    const foamGeo = new THREE.RingGeometry(2.1, Math.max(2.4, g.pool.widthM * 0.42), 36);
    const foam = new THREE.Mesh(foamGeo, foamMat);
    foam.rotation.x = -Math.PI / 2;
    foam.scale.x = 1.5;
    foam.position.set(g.pool.x, 0.58, 0);
    group.add(foam);

    for (let k = 0; k < s.blocks.length; k++) {
      const b = s.blocks[k];
      const block = addBox(b.x - b.size / 2, b.x + b.size / 2, -b.size / 2, b.size / 2, 0, b.size, hardMat);
      block.rotation.set(0.08 * (k + 1), 0.21 * k, -0.17 + 0.09 * k);
    }
  };

  const resize = () => {
    const w = Math.max(1, el.clientWidth);
    const h = Math.max(1, el.clientHeight);
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
      for (const item of disposable) item.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
