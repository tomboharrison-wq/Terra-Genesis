import {
  ACESFilmicToneMapping,
  BufferAttribute,
  BufferGeometry,
  Color,
  DataTexture,
  DataUtils,
  DirectionalLight,
  Fog,
  HalfFloatType,
  HemisphereLight,
  LinearFilter,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshStandardMaterial,
  PCFSoftShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  RedFormat,
  Scene,
  SphereGeometry,
  Sphere,
  Vector2,
  Vector3,
  WebGLRenderer,
  ClampToEdgeWrapping,
  DoubleSide,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Engine } from '../engine/engine';
import { raycastHeightfield, sampleBilinear, type RayHit } from '../terrain/heightfield';
import { expandRect, clampRect, type CellRect } from '../utils/rect';
import { terrainColour } from './palette';
import { addTerrainDetail, createSeaMaterial, createSkyMaterial } from './shaders';
import { WaterLayer, type WaterView } from './waterLayer';

export type Quality = 'performance' | 'balanced' | 'high';

export interface FrameStats {
  fps: number;
  frameMs: number;
  triangles: number;
}

export interface CameraPose {
  position: [number, number, number];
  target: [number, number, number];
}

const SKY_HORIZON = 0xd2e2ee;

/**
 * Sole owner of all Three.js objects (renderer, scene, camera, controls, meshes).
 * Reads world state from the Engine; never mutates physical fields.
 */
export class TerrainScene {
  readonly renderer: WebGLRenderer;
  readonly scene = new Scene();
  readonly camera: PerspectiveCamera;
  readonly controls: OrbitControls;
  private terrain: Mesh<BufferGeometry, MeshStandardMaterial> | null = null;
  private terrainMat: MeshStandardMaterial;
  private pos = new Float32Array(0);
  private nrm = new Float32Array(0);
  private col = new Float32Array(0);
  private sea: Mesh<PlaneGeometry, ReturnType<typeof createSeaMaterial>> | null = null;
  private skirt: Mesh<BufferGeometry, MeshStandardMaterial> | null = null;
  private waterSkirt: Mesh<BufferGeometry, MeshStandardMaterial> | null = null;
  private baseM = 0;
  private waterLayer: WaterLayer | null = null;
  private waterView: WaterView = 'water';
  private heightTex: DataTexture | null = null;
  private heightHalf = new Uint16Array(0);
  private sky: Mesh;
  private sun: DirectionalLight;
  private brushRing: Line;
  private brushVisible = false;
  private brushCentre = new Vector2();
  private brushRadius = 100;
  private raf = 0;
  private last = performance.now();
  private fpsEma = 60;
  private msEma = 16;
  private resizeObs: ResizeObserver;
  private unsub: () => void;
  private stats: FrameStats = { fps: 0, frameMs: 0, triangles: 0 };
  private reliefM = 1;
  /** Called every frame with clamped dt (s), before rendering. */
  onFrame: ((dt: number) => void) | null = null;
  onStats: ((s: FrameStats) => void) | null = null;
  /** Called after frames in which simulated time advanced. */
  onSim: (() => void) | null = null;
  private statsTimer = 0;

  constructor(private container: HTMLElement, private engine: Engine, quality: Quality = 'balanced') {
    this.renderer = new WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, quality === 'high' ? 2 : quality === 'balanced' ? 1.5 : 1));
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = quality !== 'performance';
    this.renderer.shadowMap.type = PCFSoftShadowMap;
    this.renderer.domElement.className = 'viewport-canvas';
    container.appendChild(this.renderer.domElement);

    this.camera = new PerspectiveCamera(45, 1, 1, 1e6);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.12;
    this.controls.screenSpacePanning = false;
    this.controls.maxPolarAngle = Math.PI * 0.495;
    this.controls.zoomToCursor = true;

    this.scene.background = new Color(SKY_HORIZON);
    this.scene.add(new HemisphereLight(0xcfe2ff, 0x5b4c39, 1.1));
    this.sun = new DirectionalLight(0xfff1dc, 2.6);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(quality === 'high' ? 4096 : 2048, quality === 'high' ? 4096 : 2048);
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.6;
    this.scene.add(this.sun, this.sun.target);

    this.sky = new Mesh(new SphereGeometry(1, 32, 16), createSkyMaterial());
    this.sky.frustumCulled = false;
    this.sky.renderOrder = -10;
    this.scene.add(this.sky);

    this.terrainMat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.93, metalness: 0 });

    const ringGeo = new BufferGeometry();
    ringGeo.setAttribute('position', new BufferAttribute(new Float32Array(129 * 3), 3));
    this.brushRing = new Line(ringGeo, new LineBasicMaterial({ color: 0xffe627, depthTest: false, transparent: true, opacity: 0.95 }));
    this.brushRing.renderOrder = 10;
    this.brushRing.frustumCulled = false;
    this.brushRing.visible = false;
    this.scene.add(this.brushRing);

    this.resizeObs = new ResizeObserver(() => this.resize());
    this.resizeObs.observe(container);
    this.resize();

    this.unsub = engine.on((e) => {
      if (e.type === 'world-replaced') this.buildWorld(true);
    });
    // GPU water solver shares this WebGL2 context; falls back to CPU if float targets are missing.
    engine.attachGpu(this.renderer.getContext() as WebGL2RenderingContext);
    this.buildWorld(true);
    this.loop();
  }

  // ---------- world → GPU ----------

  private buildWorld(resetCamera: boolean) {
    const w = this.engine.world;
    const W = w.width;
    const H = w.height;
    const n = W * H;
    const cs = w.cellSizeM;
    let zmin = Infinity;
    let zmax = -Infinity;
    for (const z of this.engine.surface) {
      if (z < zmin) zmin = z;
      if (z > zmax) zmax = z;
    }
    this.reliefM = Math.max(1, w.meta.reliefM || zmax - zmin);

    if (this.terrain) {
      this.scene.remove(this.terrain);
      this.terrain.geometry.dispose();
    }
    this.pos = new Float32Array(n * 3);
    this.nrm = new Float32Array(n * 3);
    this.col = new Float32Array(n * 3);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        this.pos[i * 3] = x * cs;
        this.pos[i * 3 + 2] = -y * cs;
      }
    }
    const idx = new Uint32Array((W - 1) * (H - 1) * 6);
    let k = 0;
    for (let y = 0; y < H - 1; y++) {
      for (let x = 0; x < W - 1; x++) {
        const a = y * W + x;
        const b = a + 1;
        const c = a + W;
        const d = c + 1;
        // Alternate diagonals to avoid directional grid bias.
        if ((x + y) & 1) {
          idx[k++] = a; idx[k++] = b; idx[k++] = d;
          idx[k++] = a; idx[k++] = d; idx[k++] = c;
        } else {
          idx[k++] = a; idx[k++] = b; idx[k++] = c;
          idx[k++] = b; idx[k++] = d; idx[k++] = c;
        }
      }
    }
    const geo = new BufferGeometry();
    geo.setIndex(new BufferAttribute(idx, 1));
    geo.setAttribute('position', new BufferAttribute(this.pos, 3));
    geo.setAttribute('normal', new BufferAttribute(this.nrm, 3));
    geo.setAttribute('color', new BufferAttribute(this.col, 3));
    this.updateVertices({ x0: 0, y0: 0, x1: W, y1: H }, false);
    const ex = (W - 1) * cs;
    const ey = (H - 1) * cs;
    geo.boundingSphere = new Sphere(new Vector3(ex / 2, (zmin + zmax) / 2, -ey / 2), Math.hypot(ex, ey, zmax - zmin) / 2 + this.reliefM);
    addTerrainDetail(this.terrainMat, Math.max(cs * 1.5, 6));
    this.terrainMat.needsUpdate = true;
    this.terrain = new Mesh(geo, this.terrainMat);
    this.terrain.castShadow = true;
    this.terrain.receiveShadow = true;
    this.scene.add(this.terrain);
    this.stats.triangles = idx.length / 3;

    if (this.waterLayer) {
      this.scene.remove(this.waterLayer.mesh);
      this.waterLayer.dispose();
    }
    this.waterLayer = new WaterLayer(this.engine, this.renderer, geo.getIndex()!, this.pos.slice());
    this.waterLayer.setView(this.waterView);
    this.scene.add(this.waterLayer.mesh);

    this.baseM = Math.min(zmin, w.seaLevelM) - Math.max(20, this.reliefM * 0.12);
    this.buildSea(ex, ey);
    this.buildSkirts();
    this.configureLightsAndFog(ex, ey);
    this.engine.takeDirty();
    if (resetCamera) this.fitWorld(false);
  }

  private buildSea(ex: number, ey: number) {
    const w = this.engine.world;
    if (this.sea) {
      this.scene.remove(this.sea);
      this.sea.geometry.dispose();
      this.sea.material.dispose();
    }
    this.heightTex?.dispose();
    this.heightHalf = new Uint16Array(w.width * w.height);
    this.heightTex = new DataTexture(this.heightHalf, w.width, w.height, RedFormat, HalfFloatType);
    this.heightTex.magFilter = LinearFilter;
    this.heightTex.minFilter = LinearFilter;
    this.heightTex.wrapS = this.heightTex.wrapT = ClampToEdgeWrapping;
    this.updateHeightTexture();
    const mat = createSeaMaterial(this.heightTex);
    const geo = new PlaneGeometry(ex, ey, 1, 1);
    geo.rotateX(-Math.PI / 2);
    this.sea = new Mesh(geo, mat);
    this.sea.position.set(ex / 2, w.seaLevelM, -ey / 2);
    this.sea.renderOrder = 2;
    mat.uniforms.uWorldSize.value = [ex, ey];
    mat.uniforms.uSeaLevel.value = w.seaLevelM;
    mat.uniforms.uDeepDepth.value = Math.max(8, Math.min(80, this.reliefM * 0.12));
    this.scene.add(this.sea);
  }

  private updateHeightTexture() {
    const s = this.engine.surface;
    for (let i = 0; i < s.length; i++) this.heightHalf[i] = DataUtils.toHalfFloat(s[i]);
    if (this.heightTex) this.heightTex.needsUpdate = true;
  }

  /** Perimeter cell indices, walked clockwise-agnostic as four edges. */
  private perimeter(): number[] {
    const { width: W, height: H } = this.engine.world;
    const p: number[] = [];
    for (let x = 0; x < W; x++) p.push(x); // south edge, y=0
    for (let y = 1; y < H; y++) p.push(y * W + W - 1); // east
    for (let x = W - 2; x >= 0; x--) p.push((H - 1) * W + x); // north
    for (let y = H - 2; y >= 0; y--) p.push(y * W); // west
    return p;
  }

  /** Diorama side walls: earth skirt from surface to base, translucent water wall where sea > ground. */
  private buildSkirts() {
    for (const m of [this.skirt, this.waterSkirt]) {
      if (m) {
        this.scene.remove(m);
        m.geometry.dispose();
        m.material.dispose();
      }
    }
    const per = this.perimeter();
    const n = per.length;
    const mk = (withColour: boolean) => {
      const g = new BufferGeometry();
      g.setAttribute('position', new BufferAttribute(new Float32Array(n * 2 * 3), 3));
      if (withColour) g.setAttribute('color', new BufferAttribute(new Float32Array(n * 2 * 3), 3));
      const idx: number[] = [];
      for (let k = 0; k < n - 1; k++) {
        const a = k * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
      g.setIndex(idx);
      return g;
    };
    this.skirt = new Mesh(mk(true), new MeshStandardMaterial({ vertexColors: true, roughness: 1, side: DoubleSide }));
    this.waterSkirt = new Mesh(mk(false), new MeshStandardMaterial({ color: 0x1b5a86, transparent: true, opacity: 0.72, roughness: 0.2, side: DoubleSide, depthWrite: false }));
    this.skirt.receiveShadow = true;
    this.waterSkirt.renderOrder = 3;
    this.skirt.frustumCulled = this.waterSkirt.frustumCulled = false;
    this.scene.add(this.skirt, this.waterSkirt);
    this.updateSkirts();
  }

  private updateSkirts() {
    if (!this.skirt || !this.waterSkirt) return;
    const w = this.engine.world;
    const z = this.engine.surface;
    const cs = w.cellSizeM;
    const per = this.perimeter();
    const sp = this.skirt.geometry.getAttribute('position') as BufferAttribute;
    const sc = this.skirt.geometry.getAttribute('color') as BufferAttribute;
    const wp = this.waterSkirt.geometry.getAttribute('position') as BufferAttribute;
    const top = new Color(0x5b4a37);
    const bottom = new Color(0x2c241c);
    per.forEach((i, k) => {
      const x = (i % w.width) * cs;
      const y = Math.floor(i / w.width) * cs;
      const g = Math.max(z[i], this.baseM);
      sp.setXYZ(k * 2, x, g, -y);
      sp.setXYZ(k * 2 + 1, x, this.baseM, -y);
      sc.setXYZ(k * 2, top.r, top.g, top.b);
      sc.setXYZ(k * 2 + 1, bottom.r, bottom.g, bottom.b);
      const waterTop = Math.max(w.seaLevelM, g);
      wp.setXYZ(k * 2, x, waterTop, -y);
      wp.setXYZ(k * 2 + 1, x, g, -y);
    });
    sp.needsUpdate = sc.needsUpdate = wp.needsUpdate = true;
    this.skirt.geometry.computeVertexNormals();
  }

  private configureLightsAndFog(ex: number, ey: number) {
    const size = Math.max(ex, ey);
    const c = new Vector3(ex / 2, 0, -ey / 2);
    this.sun.position.copy(c).add(new Vector3(-0.55, 0.62, 0.45).normalize().multiplyScalar(size * 1.5));
    this.sun.target.position.copy(c);
    const sc = this.sun.shadow.camera;
    const half = size * 0.75;
    sc.left = -half;
    sc.right = half;
    sc.top = half;
    sc.bottom = -half;
    sc.near = size * 0.2;
    sc.far = size * 3.5;
    sc.updateProjectionMatrix();
    this.scene.fog = new Fog(SKY_HORIZON, size * 1.2, size * 5);
    this.camera.near = Math.max(0.5, size / 4000);
    this.camera.far = size * 20;
    this.camera.updateProjectionMatrix();
    this.controls.minDistance = Math.max(20, this.engine.world.cellSizeM * 3);
    this.controls.maxDistance = size * 4;
    this.sky.scale.setScalar(size * 9);
    if (this.sea) {
      const u = this.sea.material.uniforms;
      u.uFogNear.value = size * 1.2;
      u.uFogFar.value = size * 5;
      u.uSunDir.value = this.sun.position.clone().sub(c).normalize().toArray();
    }
    this.waterLayer?.setFog(size * 1.2, size * 5, this.sun.position.clone().sub(c).normalize().toArray(), Math.max(0.2, this.reliefM * 0.0008));
  }

  /** Recompute positions, normals and colours for cells in rect (plus 1-cell normal halo). */
  private updateVertices(rect: CellRect, upload: boolean) {
    const w = this.engine.world;
    const W = w.width;
    const H = w.height;
    const cs = w.cellSizeM;
    const z = this.engine.surface;
    const r = clampRect(expandRect(rect, 1), W, H);
    if (!r) return;
    const sea = w.seaLevelM;
    const relief = this.reliefM;
    for (let y = r.y0; y < r.y1; y++) {
      const yd = y > 0 ? y - 1 : y;
      const yu = y < H - 1 ? y + 1 : y;
      for (let x = r.x0; x < r.x1; x++) {
        const i = y * W + x;
        const xl = x > 0 ? x - 1 : x;
        const xr = x < W - 1 ? x + 1 : x;
        const dzdx = (z[y * W + xr] - z[y * W + xl]) / ((xr - xl) * cs);
        const dzdy = (z[yu * W + x] - z[yd * W + x]) / ((yu - yd) * cs);
        // Normal in three space: world (−dz/dx, −dz/dy, 1) → three (−dzdx, 1, +dzdy)
        const inv = 1 / Math.sqrt(dzdx * dzdx + dzdy * dzdy + 1);
        const o = i * 3;
        this.pos[o + 1] = z[i];
        this.nrm[o] = -dzdx * inv;
        this.nrm[o + 1] = inv;
        this.nrm[o + 2] = dzdy * inv;
        terrainColour(
          {
            materialId: w.materialId[i],
            sedimentM: w.looseSedimentThicknessM[i],
            slope: Math.hypot(dzdx, dzdy),
            aboveSeaM: z[i] - sea,
            reliefM: relief,
          },
          this.col,
          o,
        );
      }
    }
    if (upload && this.terrain) {
      const g = this.terrain.geometry;
      const start = r.y0 * W * 3;
      const count = (r.y1 - r.y0) * W * 3;
      for (const name of ['position', 'normal', 'color'] as const) {
        const a = g.getAttribute(name) as BufferAttribute;
        a.clearUpdateRanges();
        a.addUpdateRange(start, count);
        a.needsUpdate = true;
      }
    }
  }

  // ---------- frame loop ----------

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    const now = performance.now();
    const rawDt = (now - this.last) / 1000;
    this.last = now;
    const dt = Math.min(rawDt, 0.05);
    this.onFrame?.(dt);
    const simDone = this.engine.tick(rawDt);
    if (this.engine.gpu) this.renderer.resetState(); // raw GL compute passes ran on this context
    if (simDone > 0) this.onSim?.();
    const dirty = this.engine.takeDirty();
    if (dirty) {
      this.updateVertices(dirty, true);
      this.updateHeightTexture();
      this.waterLayer?.updateGround();
      if (dirty.x0 <= 1 || dirty.y0 <= 1 || dirty.x1 >= this.engine.world.width - 1 || dirty.y1 >= this.engine.world.height - 1) this.updateSkirts();
    }
    if (this.brushVisible) this.updateBrushRing();
    this.controls.update();
    this.sky.position.copy(this.camera.position);
    if (this.sea) this.sea.material.uniforms.uTime.value = now / 1000;
    this.waterLayer?.update(now / 1000);
    const t0 = performance.now();
    this.renderer.render(this.scene, this.camera);
    const cpuMs = performance.now() - t0;
    this.fpsEma += ((rawDt > 0 ? 1 / rawDt : 60) - this.fpsEma) * 0.08;
    this.msEma += (cpuMs - this.msEma) * 0.08;
    this.statsTimer += rawDt;
    if (this.statsTimer > 0.5 && this.onStats) {
      this.statsTimer = 0;
      this.stats.fps = this.fpsEma;
      this.stats.frameMs = this.msEma;
      this.onStats({ ...this.stats });
    }
  };

  private resize() {
    const wPx = Math.max(1, this.container.clientWidth);
    const hPx = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(wPx, hPx, false);
    this.camera.aspect = wPx / hPx;
    this.camera.updateProjectionMatrix();
  }

  // ---------- picking & brush ring ----------

  /** Pick the terrain under a client (CSS px) position. Returns world coordinates. */
  pick(clientX: number, clientY: number): RayHit | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    const o = new Vector3().setFromMatrixPosition(this.camera.matrixWorld);
    const d = new Vector3(ndc.x, ndc.y, 0.5).unproject(this.camera).sub(o).normalize();
    // three → world: (x, -z, y)
    return raycastHeightfield(this.engine.heightfield, [o.x, -o.z, o.y], [d.x, -d.z, d.y], this.camera.far);
  }

  setBrush(visible: boolean, xM = 0, yM = 0, radiusM = this.brushRadius) {
    this.brushVisible = visible;
    this.brushRing.visible = visible;
    this.brushCentre.set(xM, yM);
    this.brushRadius = radiusM;
  }

  private updateBrushRing() {
    const a = this.brushRing.geometry.getAttribute('position') as BufferAttribute;
    const hf = this.engine.heightfield;
    const lift = Math.max(0.5, this.reliefM * 0.004);
    for (let k = 0; k <= 128; k++) {
      const th = (k / 128) * Math.PI * 2;
      const x = this.brushCentre.x + Math.cos(th) * this.brushRadius;
      const y = this.brushCentre.y + Math.sin(th) * this.brushRadius;
      a.setXYZ(k, x, sampleBilinear(hf, x, y) + lift, -y);
    }
    a.needsUpdate = true;
  }

  // ---------- camera ----------

  private worldCentre(): Vector3 {
    const w = this.engine.world;
    const ex = (w.width - 1) * w.cellSizeM;
    const ey = (w.height - 1) * w.cellSizeM;
    return new Vector3(ex / 2, this.engine.sampleSurface(ex / 2, ey / 2), -ey / 2);
  }

  private worldSize(): number {
    const w = this.engine.world;
    return Math.max(w.width - 1, w.height - 1) * w.cellSizeM;
  }

  fitWorld(_animate = true) {
    void _animate;
    const c = this.worldCentre();
    const s = this.worldSize();
    c.y = Math.max(c.y, this.engine.world.seaLevelM);
    this.controls.target.copy(c);
    this.camera.position.set(c.x + s * 0.55, c.y + s * 0.62, c.z + s * 0.72);
    this.controls.update();
  }

  topDown() {
    const c = this.worldCentre();
    const s = this.worldSize();
    this.controls.target.copy(c);
    this.camera.position.set(c.x, c.y + s * 1.25, c.z + s * 0.001);
    this.controls.update();
  }

  oblique() {
    const t = this.controls.target.clone();
    const s = this.worldSize();
    this.camera.position.set(t.x, t.y + s * 0.35, t.z + s * 0.75);
    this.controls.update();
  }

  /** Move the camera and target together along the ground plane (metres, three axes). */
  panBy(dx: number, dz: number) {
    const fwd = new Vector3().subVectors(this.controls.target, this.camera.position).setY(0).normalize();
    const right = new Vector3(-fwd.z, 0, fwd.x);
    const scale = this.camera.position.distanceTo(this.controls.target) * 0.04;
    const move = right.multiplyScalar(dx * scale).add(fwd.multiplyScalar(dz * scale));
    this.camera.position.add(move);
    this.controls.target.add(move);
  }

  getPose(): CameraPose {
    return { position: this.camera.position.toArray() as CameraPose['position'], target: this.controls.target.toArray() as CameraPose['target'] };
  }

  setPose(p: CameraPose) {
    this.camera.position.fromArray(p.position);
    this.controls.target.fromArray(p.target);
    this.controls.update();
  }

  setWaterView(v: WaterView) {
    this.waterView = v;
    this.waterLayer?.setView(v);
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.unsub();
    this.engine.detachGpu();
    this.waterLayer?.dispose();
    this.resizeObs.disconnect();
    this.controls.dispose();
    this.terrain?.geometry.dispose();
    this.terrainMat.dispose();
    this.heightTex?.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
