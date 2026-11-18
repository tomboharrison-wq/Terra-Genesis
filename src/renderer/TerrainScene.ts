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
  ArrowHelper,
  Group,
  CanvasTexture,
  Sprite,
  SpriteMaterial,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Engine } from '../engine/engine';
import { raycastHeightfield, sampleBilinear, type RayHit } from '../terrain/heightfield';
import { expandRect, clampRect, type CellRect } from '../utils/rect';
import { terrainColour } from './palette';
import { addTerrainDetail, createSeaMaterial, createSkyMaterial, createStrataUniforms, type StrataUniforms } from './shaders';
import { MATERIALS } from '../terrain/materials';
import { STRATA_BOUNDS, STRATA_LAYERS } from '../engine/world';
import { WaterLayer, type WaterView } from './waterLayer';
import { overlayById, prepareOverlay, type OverlayData, type OverlayId } from './overlays';
import { TreeLayer } from './treeLayer';
import { CloudLayer } from './cloudLayer';
import { PLATE_COLOURS } from '../sim/tectonics/plates';
import { BIOME_COLOURS } from '../sim/vegetation/vegetationSim';
import { automaticCameraPose, type CameraMode } from './cameraPaths';

export type Quality = 'performance' | 'balanced' | 'high';
/** Terrain colouring: natural, or surface change since the engine's reference snapshot. */
export type TerrainOverlay = OverlayId;

const ERODE_RGB = new Color(0xed3f23);
const DEPOSIT_RGB = new Color(0x006ddf);
// Temperature (diverging about 0 °C, −20 … +30) and rainfall (sequential blue, 0 … 3× map mean).
const TEMP_COLD = new Color(0x2a5fa8);
const TEMP_ZERO = new Color(0xdedbd2);
const TEMP_WARM = new Color(0xc8402a);
const RAIN_LO = new Color(0xb4c6d3);
const RAIN_HI = new Color(0x0a3a6b);
const SNOW = new Color(0xf2f4f7);
/** Geological time: rivers and lakes drawn from the drainage (water time draws real water instead). */
const GEO_RIVER = new Color(0x2f6fb3);
const GEO_LAKE = new Color(0x3d7fc0);
const GEO_LAKE_DEEP = new Color(0x1d4f8a);
const GEO_WET = new Color(0x4f6b4a);
/** Hollows shallower than this are drawn as wet ground, deeper ones as lakes (m). */
export const GEO_LAKE_MIN_M = 0.5;
/** A channel starts where this much ground drains through a cell (m²; channel heads are typically 0.01–0.1 km²). */
export const GEO_CHANNEL_AREA_M2 = 5e4;
const ICE = new Color(0xcfe2ee);
const CMP_MORE = new Color(0x25b755);
const B_CONV = new Color(0xed3f23);
const B_DIV = new Color(0x006ddf);
const B_TRANS = new Color(0xffe627);
const CMP_LESS = new Color(0xa0522d);
const ICE_DIRTY = new Color(0x8d8f8c);
// Lava by temperature: cooled crust → dull red → orange → yellow-orange (eruption heat).
const LAVA_CRUST = new Color(0x2a2422);
const ASH = new Color(0x6f6c6a); // grey volcanic ash / dark cinder
const LAVA_RED = new Color(0x8e1d0c);
const LAVA_ORANGE = new Color(0xe8551a);
const LAVA_HOT = new Color(0xffb13b);
/** Snow water equivalent giving full white cover (≈ 20–30 cm of settled snow). */
const SNOW_FULL_M = 0.03;
const WAVE_LO = new Color(0xffe627);
const WAVE_MID = new Color(0xff912a);
const WAVE_HI = new Color(0xed3f23);

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
  private strB = new Float32Array(0);
  private strM = new Float32Array(0);
  private glow = new Float32Array(0);
  private strataUniforms: StrataUniforms = createStrataUniforms(Array.from({ length: 8 }, (_, k) => new Color().setHex(MATERIALS[k]?.colour ?? 0x808080)));
  private sea: Mesh<PlaneGeometry, ReturnType<typeof createSeaMaterial>> | null = null;
  private skirt: Mesh<BufferGeometry, MeshStandardMaterial> | null = null;
  private waterSkirt: Mesh<BufferGeometry, MeshStandardMaterial> | null = null;
  private baseM = 0;
  private waterLayer: WaterLayer | null = null;
  private waterView: WaterView = 'water';
  private terrainOverlay: TerrainOverlay = 'none';
  /** Derived data for the current overlay (flow accumulation, elevation range), refreshed ≤ 1 Hz. */
  private overlayData: OverlayData | null = null;
  private overlayTimer = 0;
  private overlayWaterRev = -1;
  /** Derived data of the current generic overlay (for the inspector), or null. */
  get currentOverlayData(): OverlayData | null {
    return this.overlayData;
  }
  private snowTimer = 0;
  private trees: TreeLayer | null = null;
  private clouds: CloudLayer | null = null;
  private cloudsOn = false;
  private plateArrows = new Group();
  private treeRev = -1;
  private treesStale = false;
  private treeTimer = 0;
  private displayZ = new Float32Array(0);
  private snowRev = -1;
  private hadSnow = false;
  private heightTex: DataTexture | null = null;
  private heightHalf = new Uint16Array(0);
  private sky: Mesh<SphereGeometry, ReturnType<typeof createSkyMaterial>>;
  private sun: DirectionalLight;
  private sunAzimuthDeg = 220;
  private sunElevationDeg = 38;
  private verticalExaggeration = 1;
  private brushRing: Line;
  private brushVisible = false;
  private profileLine: Line;
  private profileEnds: [number, number, number, number] | null = null;
  /** Measurement pins: a stick and a lettered marker each (world metres). */
  private pinGroup = new Group();
  private pins: {
    label: string;
    xM: number;
    yM: number;
    stick: Line;
    sprite: Sprite;
  }[] = [];
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
  private cameraMode: CameraMode = 'orbit';
  private cameraPathTime = 0;
  /** Called every frame with clamped dt (s), before rendering. */
  onFrame: ((dt: number) => void) | null = null;
  private frameListeners = new Set<() => void>();
  /** Called after every rendered frame (e.g. to move HTML labels); returns a remover. */
  addFrameListener(fn: () => void): () => void {
    this.frameListeners.add(fn);
    return () => this.frameListeners.delete(fn);
  }

  /** Screen position (CSS px, relative to the canvas) of a point on the ground; null if behind the camera or off screen. */
  project(xM: number, yM: number, liftM = 0): { x: number; y: number } | null {
    const z = (sampleBilinear(this.engine.heightfield, xM, yM) + liftM) * this.verticalExaggeration;
    const v = new Vector3(xM, z, -yM).project(this.camera);
    if (v.z > 1 || v.z < -1 || Math.abs(v.x) > 1.05 || Math.abs(v.y) > 1.05) return null;
    const el = this.renderer.domElement;
    return {
      x: ((v.x + 1) / 2) * el.clientWidth,
      y: ((1 - v.y) / 2) * el.clientHeight,
    };
  }
  onStats: ((s: FrameStats) => void) | null = null;
  /** Called after frames in which simulated time advanced. */
  onSim: (() => void) | null = null;
  private statsTimer = 0;

  constructor(
    private container: HTMLElement,
    private engine: Engine,
    quality: Quality = 'balanced',
  ) {
    this.renderer = new WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
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

    this.terrainMat = new MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.9,
      metalness: 0,
    });
    addTerrainDetail(this.terrainMat, 30, this.strataUniforms);

    const ringGeo = new BufferGeometry();
    ringGeo.setAttribute('position', new BufferAttribute(new Float32Array(129 * 3), 3));
    this.brushRing = new Line(
      ringGeo,
      new LineBasicMaterial({
        color: 0xffe627,
        depthTest: false,
        transparent: true,
        opacity: 0.95,
      }),
    );
    this.brushRing.renderOrder = 10;
    this.brushRing.frustumCulled = false;
    this.brushRing.visible = false;
    this.scene.add(this.brushRing);
    const profGeo = new BufferGeometry();
    profGeo.setAttribute('position', new BufferAttribute(new Float32Array(129 * 3), 3));
    this.profileLine = new Line(
      profGeo,
      new LineBasicMaterial({
        color: 0xffe627,
        depthTest: false,
        transparent: true,
      }),
    );
    this.profileLine.renderOrder = 11;
    this.profileLine.frustumCulled = false;
    this.profileLine.visible = false;
    this.scene.add(this.profileLine);
    this.scene.add(this.pinGroup);

    this.resizeObs = new ResizeObserver(() => this.resize());
    this.resizeObs.observe(container);
    this.resize();

    this.unsub = engine.on((e) => {
      if (e.type === 'world-replaced') {
        if (this.overlayData) this.overlayData = prepareOverlay(this.terrainOverlay, this.engine);
        this.buildWorld(!e.keepCamera);
      }
      if (e.type === 'sea-level-changed') this.applySeaLevel();
      if (e.type === 'water-params-changed' || e.type === 'climate-changed') this.updatePlateArrows();
      if (
        (e.type === 'climate-changed' || e.type === 'water-params-changed') &&
        (this.terrainOverlay === 'temperature' ||
          this.terrainOverlay === 'rainfall' ||
          this.terrainOverlay === 'compare' ||
          this.terrainOverlay === 'plates' ||
          this.terrainOverlay === 'shaking' ||
          this.terrainOverlay.startsWith('cp-'))
      ) {
        const w = engine.world;
        this.updateVertices({ x0: 0, y0: 0, x1: w.width, y1: w.height }, true);
      }
    });
    // GPU water solver shares this WebGL2 context; falls back to CPU if float targets are missing.
    engine.attachGpu(this.renderer.getContext() as WebGL2RenderingContext);
    this.buildWorld(true);
    this.loop();
  }

  // ---------- world → GPU ----------

  private buildWorld(resetCamera: boolean) {
    this.displayZ = new Float32Array(this.engine.world.width * this.engine.world.height);
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
    this.strB = new Float32Array(n * 3);
    this.strM = new Float32Array(n * 4);
    this.glow = new Float32Array(n);
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
          idx[k++] = a;
          idx[k++] = b;
          idx[k++] = d;
          idx[k++] = a;
          idx[k++] = d;
          idx[k++] = c;
        } else {
          idx[k++] = a;
          idx[k++] = b;
          idx[k++] = c;
          idx[k++] = b;
          idx[k++] = d;
          idx[k++] = c;
        }
      }
    }
    const geo = new BufferGeometry();
    geo.setIndex(new BufferAttribute(idx, 1));
    geo.setAttribute('position', new BufferAttribute(this.pos, 3));
    geo.setAttribute('normal', new BufferAttribute(this.nrm, 3));
    geo.setAttribute('color', new BufferAttribute(this.col, 3));
    geo.setAttribute('strataB', new BufferAttribute(this.strB, 3));
    geo.setAttribute('strataM', new BufferAttribute(this.strM, 4));
    geo.setAttribute('lavaGlow', new BufferAttribute(this.glow, 1));
    this.updateVertices({ x0: 0, y0: 0, x1: W, y1: H }, false);
    const ex = (W - 1) * cs;
    const ey = (H - 1) * cs;
    geo.boundingSphere = new Sphere(new Vector3(ex / 2, (zmin + zmax) / 2, -ey / 2), Math.hypot(ex, ey, zmax - zmin) / 2 + this.reliefM);
    this.strataUniforms.uLineW.value = Math.max(0.3, this.reliefM * 0.0015);
    this.strataUniforms.uDetailScale.value = 1 / Math.max(cs * 1.5, 6);
    this.strataUniforms.uSeaLevel.value = w.seaLevelM;
    this.terrain = new Mesh(geo, this.terrainMat);
    this.terrain.castShadow = true;
    this.terrain.receiveShadow = true;
    this.scene.add(this.terrain);
    if (!this.plateArrows.parent) this.scene.add(this.plateArrows);
    if (!this.trees) {
      this.trees = new TreeLayer(this.engine);
      this.scene.add(this.trees.group);
    }
    this.trees.rebuild();
    this.treeRev = this.engine.vegetationRevision;
    if (!this.clouds) {
      this.clouds = new CloudLayer(this.engine);
      this.scene.add(this.clouds.group);
    }
    this.clouds.setEnabled(this.cloudsOn);
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
    const s = this.displayZ.length === this.engine.surface.length ? this.displayZ : this.engine.surface;
    for (let i = 0; i < s.length; i++) this.heightHalf[i] = DataUtils.toHalfFloat(s[i]);
    if (this.heightTex) this.heightTex.needsUpdate = true;
  }

  /** Move the sea surface and refresh depth-dependent shading after a sea-level change. */
  private applySeaLevel() {
    const w = this.engine.world;
    this.strataUniforms.uSeaLevel.value = w.seaLevelM;
    if (this.sea) {
      this.sea.position.y = w.seaLevelM * this.verticalExaggeration;
      this.sea.material.uniforms.uSeaLevel.value = w.seaLevelM;
    }
    let zmin = Infinity;
    for (const z of this.engine.surface) zmin = Math.min(zmin, z);
    if (w.seaLevelM - Math.max(20, this.reliefM * 0.12) < this.baseM || zmin < this.baseM) {
      this.baseM = Math.min(zmin, w.seaLevelM) - Math.max(20, this.reliefM * 0.12);
    }
    this.updateSkirts();
  }

  /** Perimeter segments split by wall so corners have crisp 90° normals. */
  private perimeterWalls(): { cells: number[]; normal: [number, number, number] }[] {
    const { width: W, height: H } = this.engine.world;
    const south: number[] = [];
    for (let x = 0; x < W; x++) south.push(x);
    const east: number[] = [];
    for (let y = 0; y < H; y++) east.push(y * W + W - 1);
    const north: number[] = [];
    for (let x = W - 1; x >= 0; x--) north.push((H - 1) * W + x);
    const west: number[] = [];
    for (let y = H - 1; y >= 0; y--) west.push(y * W);
    return [
      { cells: south, normal: [0, 0, 1] },
      { cells: east, normal: [1, 0, 0] },
      { cells: north, normal: [0, 0, -1] },
      { cells: west, normal: [-1, 0, 0] },
    ];
  }

  /** Diorama side walls: true geological cross-section skirt from surface to base, translucent water wall where sea > ground. */
  private buildSkirts() {
    for (const m of [this.skirt, this.waterSkirt]) {
      if (m) {
        this.scene.remove(m);
        m.geometry.dispose();
        m.material.dispose();
      }
    }
    const walls = this.perimeterWalls();
    const totalCols = walls.reduce((acc, w) => acc + w.cells.length, 0);
    const mk = (withStrata: boolean) => {
      const g = new BufferGeometry();
      g.setAttribute('position', new BufferAttribute(new Float32Array(totalCols * 2 * 3), 3));
      g.setAttribute('normal', new BufferAttribute(new Float32Array(totalCols * 2 * 3), 3));
      if (withStrata) {
        g.setAttribute('color', new BufferAttribute(new Float32Array(totalCols * 2 * 3), 3));
        g.setAttribute('bedrockZ', new BufferAttribute(new Float32Array(totalCols * 2), 1));
        g.setAttribute('strataB', new BufferAttribute(new Float32Array(totalCols * 2 * 3), 3));
        g.setAttribute('strataM', new BufferAttribute(new Float32Array(totalCols * 2 * 4), 4));
      }
      const idx: number[] = [];
      let offset = 0;
      for (const wall of walls) {
        const len = wall.cells.length;
        for (let k = 0; k < len - 1; k++) {
          const a = (offset + k) * 2;
          idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
        }
        offset += len;
      }
      g.setIndex(idx);
      return g;
    };
    const skirtMat = new MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.92,
      side: DoubleSide,
    });
    const strataUniforms = this.strataUniforms;
    skirtMat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, strataUniforms);
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
attribute float bedrockZ;
attribute vec3 strataB;
attribute vec4 strataM;
varying float vSkirtY;
varying float vBedrockZ;
varying vec3 vSkirtStrataB;
flat varying vec4 vSkirtStrataM;`,
        )
        .replace(
          '#include <project_vertex>',
          `#include <project_vertex>
vSkirtY = (modelMatrix * vec4(transformed, 1.0)).y;
vBedrockZ = bedrockZ;
float baseFloor = -1e5;
vSkirtStrataB = vec3(
  strataB.x < -1e6 ? baseFloor : strataB.x,
  strataB.y < -1e6 ? baseFloor : strataB.y,
  strataB.z < -1e6 ? baseFloor : strataB.z
);
vSkirtStrataM = strataM;`,
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
varying float vSkirtY;
varying float vBedrockZ;
varying vec3 vSkirtStrataB;
flat varying vec4 vSkirtStrataM;
uniform vec3 uMatCol[8];
uniform float uLineW;`,
        )
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
{
  if (vSkirtY <= vBedrockZ && vSkirtStrataM.x < 200.0) {
    float y = vSkirtY;
    float m = vSkirtStrataM.x;
    if (y < vSkirtStrataB.x) { m = vSkirtStrataM.y; if (y < vSkirtStrataB.y) { m = vSkirtStrataM.z; if (y < vSkirtStrataB.z) m = vSkirtStrataM.w; } }
    vec3 rock = uMatCol[ clamp(int(m + 0.5), 0, 7) ] * 0.78;
    diffuseColor.rgb = mix(diffuseColor.rgb, rock, 0.85);
    float dl = min(abs(y - vBedrockZ), min(abs(y - vSkirtStrataB.x), min(abs(y - vSkirtStrataB.y), abs(y - vSkirtStrataB.z))));
    diffuseColor.rgb *= 1.0 - 0.35 * (1.0 - smoothstep(0.0, uLineW * 1.4, dl));
  }
}`,
        );
    };
    this.skirt = new Mesh(mk(true), skirtMat);
    this.waterSkirt = new Mesh(
      mk(false),
      new MeshStandardMaterial({
        color: 0x16537e,
        transparent: true,
        opacity: 0.76,
        roughness: 0.18,
        side: DoubleSide,
        depthWrite: false,
      }),
    );
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
    const bed = w.bedrockElevationM;
    const cs = w.cellSizeM;
    const walls = this.perimeterWalls();
    const sp = this.skirt.geometry.getAttribute('position') as BufferAttribute;
    const sn = this.skirt.geometry.getAttribute('normal') as BufferAttribute;
    const sc = this.skirt.geometry.getAttribute('color') as BufferAttribute;
    const sbz = this.skirt.geometry.getAttribute('bedrockZ') as BufferAttribute;
    const ssb = this.skirt.geometry.getAttribute('strataB') as BufferAttribute;
    const ssm = this.skirt.geometry.getAttribute('strataM') as BufferAttribute;
    const wp = this.waterSkirt.geometry.getAttribute('position') as BufferAttribute;
    const wn = this.waterSkirt.geometry.getAttribute('normal') as BufferAttribute;
    const top = new Color(0x6e5a42);
    const bottom = new Color(0x332a21);
    let k = 0;
    for (const wall of walls) {
      const [nx, ny, nz] = wall.normal;
      for (const i of wall.cells) {
        const x = (i % w.width) * cs;
        const y = Math.floor(i / w.width) * cs;
        const g = Math.max(z[i], this.baseM);
        const bz = Math.max(bed[i], this.baseM);
        const v0 = k * 2;
        const v1 = v0 + 1;
        sp.setXYZ(v0, x, g, -y);
        sp.setXYZ(v1, x, this.baseM, -y);
        sn.setXYZ(v0, nx, ny, nz);
        sn.setXYZ(v1, nx, ny, nz);
        sc.setXYZ(v0, top.r, top.g, top.b);
        sc.setXYZ(v1, bottom.r, bottom.g, bottom.b);
        sbz.setX(v0, bz);
        sbz.setX(v1, bz);
        const b0 = STRATA_BOUNDS > 0 ? w.strataBoundsM[i * STRATA_BOUNDS] : -1e9;
        const b1 = STRATA_BOUNDS > 1 ? w.strataBoundsM[i * STRATA_BOUNDS + 1] : -1e9;
        const b2 = STRATA_BOUNDS > 2 ? w.strataBoundsM[i * STRATA_BOUNDS + 2] : -1e9;
        ssb.setXYZ(v0, b0, b1, b2);
        ssb.setXYZ(v1, b0, b1, b2);
        const m0 = w.strataMaterial[i * STRATA_LAYERS];
        const m1 = w.strataMaterial[i * STRATA_LAYERS + Math.min(1, STRATA_LAYERS - 1)];
        const m2 = w.strataMaterial[i * STRATA_LAYERS + Math.min(2, STRATA_LAYERS - 1)];
        const m3 = w.strataMaterial[i * STRATA_LAYERS + Math.min(3, STRATA_LAYERS - 1)];
        ssm.setXYZW(v0, m0, m1, m2, m3);
        ssm.setXYZW(v1, m0, m1, m2, m3);
        const waterTop = Math.max(w.seaLevelM, g);
        wp.setXYZ(v0, x, waterTop, -y);
        wp.setXYZ(v1, x, g, -y);
        wn.setXYZ(v0, nx, ny, nz);
        wn.setXYZ(v1, nx, ny, nz);
        k++;
      }
    }
    sp.needsUpdate = sn.needsUpdate = sc.needsUpdate = sbz.needsUpdate = ssb.needsUpdate = ssm.needsUpdate = wp.needsUpdate = wn.needsUpdate = true;
  }

  private sunDirectionVector(): Vector3 {
    const az = (this.sunAzimuthDeg * Math.PI) / 180;
    const el = (this.sunElevationDeg * Math.PI) / 180;
    const cosEl = Math.cos(el);
    return new Vector3(Math.sin(az) * cosEl, Math.sin(el), Math.cos(az) * cosEl).normalize();
  }

  private configureLightsAndFog(ex: number, ey: number) {
    const size = Math.max(ex, ey);
    const c = new Vector3(ex / 2, 0, -ey / 2);
    const sunDir = this.sunDirectionVector();
    this.sun.position.copy(c).addScaledVector(sunDir, size * 1.5);
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
    this.scene.fog = new Fog(SKY_HORIZON, size * 0.85, size * 4.2);
    this.camera.near = Math.max(0.5, size / 4000);
    this.camera.far = size * 20;
    this.camera.updateProjectionMatrix();
    this.controls.minDistance = Math.max(20, this.engine.world.cellSizeM * 3);
    this.controls.maxDistance = size * 4;
    this.sky.scale.setScalar(size * 9);
    const dirArr = sunDir.toArray() as [number, number, number];
    this.strataUniforms.uSunDir.value = dirArr;
    this.sky.material.uniforms.uSunDir.value = dirArr;
    if (this.sea) {
      const u = this.sea.material.uniforms;
      u.uFogNear.value = size * 0.85;
      u.uFogFar.value = size * 4.2;
      u.uSunDir.value = dirArr;
    }
    this.waterLayer?.setFog(size * 0.85, size * 4.2, dirArr, Math.max(0.2, this.reliefM * 0.0008));
  }

  /** Set sun azimuth (degrees clockwise from north/south) and elevation (5°..85°). */
  setSun(azimuthDeg: number, elevationDeg: number) {
    this.sunAzimuthDeg = azimuthDeg;
    this.sunElevationDeg = Math.max(5, Math.min(85, elevationDeg));
    const w = this.engine.world;
    this.configureLightsAndFog((w.width - 1) * w.cellSizeM, (w.height - 1) * w.cellSizeM);
  }

  getSun(): { azimuthDeg: number; elevationDeg: number } {
    return { azimuthDeg: this.sunAzimuthDeg, elevationDeg: this.sunElevationDeg };
  }

  /** Set 3D vertical exaggeration (1.0 .. 3.0) without mutating underlying physical elevations. */
  setVerticalExaggeration(ve: number) {
    const clamped = Math.max(1, Math.min(3, ve));
    if (Math.abs(clamped - this.verticalExaggeration) < 1e-3) return;
    this.verticalExaggeration = clamped;
    for (const m of [this.terrain, this.skirt, this.waterSkirt, this.waterLayer?.mesh, this.trees?.group]) {
      if (m) m.scale.y = clamped;
    }
    if (this.sea) this.sea.position.y = this.engine.world.seaLevelM * clamped;
  }

  getVerticalExaggeration(): number {
    return this.verticalExaggeration;
  }

  /** Toggle 3D cumulus clouds and rain shafts. */
  setClouds(on: boolean) {
    this.cloudsOn = on;
    this.clouds?.setEnabled(on);
  }

  /** Toggle anti-aliased topographic contour lines (20 m minor, 100 m major). */
  setContours(on: boolean) {
    this.strataUniforms.uContoursOn.value = on ? 1 : 0;
  }

  /** Update rendering quality in-place without destroying the WebGL2 context or losing camera pose. */
  setQuality(quality: Quality) {
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, quality === 'high' ? 2 : quality === 'balanced' ? 1.5 : 1));
    const wantShadows = quality !== 'performance';
    if (this.renderer.shadowMap.enabled !== wantShadows) {
      this.renderer.shadowMap.enabled = wantShadows;
      this.terrainMat.needsUpdate = true;
    }
    const mapSz = quality === 'high' ? 4096 : 2048;
    if (this.sun.shadow.mapSize.x !== mapSz) {
      this.sun.shadow.mapSize.set(mapSz, mapSz);
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
    }
    this.resize();
  }

  /** Recompute positions, normals and colours for cells in rect (plus 1-cell normal halo). */
  private updateVertices(rect: CellRect, upload: boolean) {
    const w = this.engine.world;
    const W = w.width;
    const H = w.height;
    const cs = w.cellSizeM;
    // Displayed surface = ground + glacier ice + molten lava.
    const ground = this.engine.surface;
    const iceT = w.iceThicknessM;
    const lavaH = w.lavaDepthM;
    const z = this.displayZ;
    for (let y = Math.max(0, rect.y0 - 2); y < Math.min(H, rect.y1 + 2); y++)
      for (let x = Math.max(0, rect.x0 - 2); x < Math.min(W, rect.x1 + 2); x++) {
        const k = y * W + x;
        z[k] = ground[k] + iceT[k] + lavaH[k];
      }
    const r = clampRect(expandRect(rect, 1), W, H);
    if (!r) return;
    const sea = w.seaLevelM;
    const relief = this.reliefM;
    const overlay = this.terrainOverlay === 'change';
    const wavesOverlay = this.terrainOverlay === 'waves';
    const tempOverlay = this.terrainOverlay === 'temperature';
    const rainOverlay = this.terrainOverlay === 'rainfall';
    const clim = this.engine.climate;
    const tmp = new Color();
    const expo = this.engine.coast.exposure;
    const ref = this.engine.referenceSurface;
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
        for (let k = 0; k < 3; k++) this.strB[o + k] = k < STRATA_BOUNDS ? w.strataBoundsM[i * STRATA_BOUNDS + k] : -1e9;
        for (let k = 0; k < 4; k++) this.strM[i * 4 + k] = w.strataMaterial[i * STRATA_LAYERS + Math.min(k, STRATA_LAYERS - 1)];
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
        if (this.terrainOverlay === 'none') {
          // Topographic cavity / curvature ambient occlusion: concave gullies & cliff bases darken, convex ridges brighten slightly
          const lap = (z[y * W + xl] + z[y * W + xr] + z[yd * W + x] + z[yu * W + x]) * 0.25 - z[i];
          const ao = lap > 0 ? 1 - 0.22 * Math.tanh(lap / (cs * 0.22)) : 1 + 0.06 * Math.tanh(-lap / (cs * 0.35));
          this.col[o] *= ao;
          this.col[o + 1] *= ao;
          this.col[o + 2] *= ao;
        }
        const ash = Math.min(w.tephraM[i], w.looseSedimentThicknessM[i]);
        if (ash > 0.005) {
          // Ash / cinder cover from the tephra share of the loose sediment (thin ash lets ground show).
          const a = Math.min(1, ash / 0.2);
          this.col[o] += (ASH.r - this.col[o]) * a;
          this.col[o + 1] += (ASH.g - this.col[o + 1]) * a;
          this.col[o + 2] += (ASH.b - this.col[o + 2]) * a;
        }
        const vc = w.vegCover[i];
        if (vc > 0.02 && this.terrainOverlay === 'none' && z[i] >= sea) {
          // Climate-derived biome colour, blended by the physically simulated cover fraction.
          tmp.setHex(BIOME_COLOURS[this.engine.vegetation.biome[i]] ?? BIOME_COLOURS[0]);
          const a = 0.8 * Math.min(1, vc * 1.5);
          this.col[o] += (tmp.r - this.col[o]) * a;
          this.col[o + 1] += (tmp.g - this.col[o + 1]) * a;
          this.col[o + 2] += (tmp.b - this.col[o + 2]) * a;
        }
        const ic = iceT[i];
        if (ic > 0.5) {
          // Glacier ice: blue-white, greyer where it carries rock debris; no rock strata drawn on it.
          const debris = Math.min(1, w.iceDebrisM[i] / Math.max(0.5, ic * 0.02));
          const a = Math.min(1, ic / 5);
          tmp.copy(ICE).lerp(ICE_DIRTY, debris);
          this.col[o] += (tmp.r - this.col[o]) * a;
          this.col[o + 1] += (tmp.g - this.col[o + 1]) * a;
          this.col[o + 2] += (tmp.b - this.col[o + 2]) * a;
          if (ic > 2) for (let k = 0; k < 4; k++) this.strM[i * 4 + k] = 255;
        }
        const lh = lavaH[i];
        this.glow[i] = 0;
        if (lh > 0.01) {
          // Lava coloured by its simulated temperature; hotter than ~700 °C it glows.
          const T = w.lavaTempC[i];
          if (T < 700) tmp.copy(LAVA_CRUST);
          else if (T < 900) tmp.copy(LAVA_CRUST).lerp(LAVA_RED, (T - 700) / 200);
          else if (T < 1050) tmp.copy(LAVA_RED).lerp(LAVA_ORANGE, (T - 900) / 150);
          else tmp.copy(LAVA_ORANGE).lerp(LAVA_HOT, Math.min(1, (T - 1050) / 100));
          const a = Math.min(1, lh / 0.3);
          this.col[o] += (tmp.r - this.col[o]) * a;
          this.col[o + 1] += (tmp.g - this.col[o + 1]) * a;
          this.col[o + 2] += (tmp.b - this.col[o + 2]) * a;
          this.glow[i] = a * Math.max(0, Math.min(1, (T - 700) / 450)) ** 2;
          for (let k = 0; k < 4; k++) this.strM[i * 4 + k] = 255;
        }
        const swe = w.snowSweM[i];
        if (swe > 0 && this.terrainOverlay === 'none' && lh <= 0.01) {
          // Snow cover from the simulated snowpack (thin cover lets the ground show through).
          const a = Math.min(1, Math.sqrt(swe / SNOW_FULL_M));
          this.col[o] += (SNOW.r - this.col[o]) * a;
          this.col[o + 1] += (SNOW.g - this.col[o + 1]) * a;
          this.col[o + 2] += (SNOW.b - this.col[o + 2]) * a;
        }
        const gr = this.engine.geoRivers;
        if (gr && this.terrainOverlay === 'none' && ground[i] >= sea) {
          const lakeD = gr.lake[i] - ground[i];
          if (gr.channel?.[i]) {
            // The meandering river's channel (geological time): specular rippled water
            this.col[o] = GEO_RIVER.r;
            this.col[o + 1] = GEO_RIVER.g;
            this.col[o + 2] = GEO_RIVER.b;
            this.glow[i] = -1.0;
          } else if (lakeD > GEO_LAKE_MIN_M) {
            tmp.copy(GEO_LAKE).lerp(GEO_LAKE_DEEP, Math.min(1, lakeD / 30));
            this.col[o] = tmp.r;
            this.col[o + 1] = tmp.g;
            this.col[o + 2] = tmp.b;
            this.glow[i] = -1.0;
          } else if (lakeD > 0.05) {
            // A shallow hollow: wet ground, not open water (the model fills every hollow; in a humid
            // climate shallow ones are marsh or wet meadow, drained by small streams and evaporation).
            this.col[o] += (GEO_WET.r - this.col[o]) * 0.45;
            this.col[o + 1] += (GEO_WET.g - this.col[o + 1]) * 0.45;
            this.col[o + 2] += (GEO_WET.b - this.col[o + 2]) * 0.45;
            this.glow[i] = -0.35;
          } else if (gr.area[i] >= GEO_CHANNEL_AREA_M2) {
            // Bigger rivers (more ground upstream) are drawn stronger: log scale over 3 decades.
            const t = Math.min(1, Math.log10(gr.area[i] / GEO_CHANNEL_AREA_M2) / 3);
            const a = 0.45 + 0.55 * t;
            this.col[o] += (GEO_RIVER.r - this.col[o]) * a;
            this.col[o + 1] += (GEO_RIVER.g - this.col[o + 1]) * a;
            this.col[o + 2] += (GEO_RIVER.b - this.col[o + 2]) * a;
            this.glow[i] = -a;
          }
        }
        const gen = this.overlayData ? overlayById(this.terrainOverlay)?.colour : undefined;
        if (gen) {
          // Generic scientific overlay (overlays.ts), relief-shaded so landforms stay readable.
          gen(this.engine, i, this.overlayData!, this.col, o);
          const shade = 0.62 + 0.38 * inv;
          this.col[o] *= shade;
          this.col[o + 1] *= shade;
          this.col[o + 2] *= shade;
        } else if (this.terrainOverlay === 'shaking') {
          // Shaking intensity of the last earthquake: sequential yellow → orange → red (I 3 … 10).
          const I = this.engine.lastQuake?.shaking[i] ?? 0;
          const t = Math.min(1, Math.max(0, (I - 3) / 7));
          const grey = (this.col[o] + this.col[o + 1] + this.col[o + 2]) / 3;
          if (I >= 3) tmp.copy(t < 0.5 ? WAVE_LO.clone().lerp(WAVE_MID, t * 2) : WAVE_MID.clone().lerp(WAVE_HI, t * 2 - 1));
          else tmp.setRGB(grey, grey, grey);
          this.col[o] = tmp.r;
          this.col[o + 1] = tmp.g;
          this.col[o + 2] = tmp.b;
        } else if (this.terrainOverlay === 'plates') {
          // Plate colour over shaded terrain; boundary cells by type (collide / pull apart / slide past).
          const shade = 0.55 + 0.45 * inv;
          const bt = this.engine.tectonics.boundary[i];
          if (bt) tmp.copy(bt === 1 ? B_CONV : bt === 2 ? B_DIV : B_TRANS);
          else tmp.setHex(PLATE_COLOURS[w.plateId[i] % PLATE_COLOURS.length]);
          this.col[o] = tmp.r * shade;
          this.col[o + 1] = tmp.g * shade;
          this.col[o + 2] = tmp.b * shade;
        } else if (this.terrainOverlay === 'compare') {
          // What-if minus now plant cover: brown = fewer plants, green = more, grey = no change.
          const d = this.engine.compareResult?.coverDiff[i] ?? 0;
          const grey = (this.col[o] + this.col[o + 1] + this.col[o + 2]) / 3;
          tmp.setRGB(grey, grey, grey);
          if (Math.abs(d) > 0.02) tmp.lerp(d > 0 ? CMP_MORE : CMP_LESS, Math.min(1, 0.3 + Math.abs(d)));
          this.col[o] = tmp.r;
          this.col[o + 1] = tmp.g;
          this.col[o + 2] = tmp.b;
        } else if (tempOverlay) {
          const t = clim.temperatureC[i];
          if (t < 0) tmp.copy(TEMP_ZERO).lerp(TEMP_COLD, Math.min(1, -t / 20));
          else tmp.copy(TEMP_ZERO).lerp(TEMP_WARM, Math.min(1, t / 30));
          const shade = 0.75 + 0.25 * inv; // keep relief readable
          this.col[o] = tmp.r * shade;
          this.col[o + 1] = tmp.g * shade;
          this.col[o + 2] = tmp.b * shade;
        } else if (rainOverlay) {
          tmp.copy(RAIN_LO).lerp(RAIN_HI, Math.min(1, clim.rainFactor[i] / 3));
          const shade = 0.75 + 0.25 * inv;
          this.col[o] = tmp.r * shade;
          this.col[o + 1] = tmp.g * shade;
          this.col[o + 2] = tmp.b * shade;
        } else if (wavesOverlay) {
          // Sequential: grey land, coastal cells yellow → orange → red by wave power (0 … 30 kW/m).
          const grey = (this.col[o] + this.col[o + 1] + this.col[o + 2]) / 3;
          const pw = expo[i];
          if (pw > 0) {
            const t = Math.min(1, pw / 30000);
            const c = t < 0.5 ? WAVE_LO.clone().lerp(WAVE_MID, t * 2) : WAVE_MID.clone().lerp(WAVE_HI, t * 2 - 1);
            this.col[o] = c.r;
            this.col[o + 1] = c.g;
            this.col[o + 2] = c.b;
          } else this.col[o] = this.col[o + 1] = this.col[o + 2] = grey;
        } else if (overlay) {
          // Diverging change map: red = lowered (eroded), blue = raised (deposited);
          // neutral within ±5 cm, log scale 5 cm … 10 m.
          const dz = ground[i] - ref[i];
          const t = Math.min(1, Math.max(0, Math.log10(Math.abs(dz) / 0.05) / Math.log10(200)));
          if (Math.abs(dz) >= 0.05) {
            const c = dz < 0 ? ERODE_RGB : DEPOSIT_RGB;
            const a = 0.35 + 0.65 * t;
            const grey = (this.col[o] + this.col[o + 1] + this.col[o + 2]) / 3;
            this.col[o] = grey * (1 - a) + c.r * a;
            this.col[o + 1] = grey * (1 - a) + c.g * a;
            this.col[o + 2] = grey * (1 - a) + c.b * a;
          } else {
            const grey = (this.col[o] + this.col[o + 1] + this.col[o + 2]) / 3;
            this.col[o] = this.col[o + 1] = this.col[o + 2] = grey;
          }
        }
      }
    }
    if (upload && this.terrain) {
      const g = this.terrain.geometry;
      const start = r.y0 * W * 3;
      const count = (r.y1 - r.y0) * W * 3;
      for (const name of ['position', 'normal', 'color', 'strataB'] as const) {
        const a = g.getAttribute(name) as BufferAttribute;
        a.clearUpdateRanges();
        a.addUpdateRange(start, count);
        a.needsUpdate = true;
      }
      const sm = g.getAttribute('strataM') as BufferAttribute;
      sm.clearUpdateRanges();
      sm.addUpdateRange((start / 3) * 4, (count / 3) * 4);
      sm.needsUpdate = true;
      const ga = g.getAttribute('lavaGlow') as BufferAttribute;
      ga.clearUpdateRanges();
      ga.addUpdateRange(start / 3, count / 3);
      ga.needsUpdate = true;
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
    let dirty = this.engine.takeDirty();
    this.overlayTimer += dt;
    const waterMoved =
      (this.terrainOverlay === 'cp-water' || this.terrainOverlay === 'flood' || this.terrainOverlay === 'drought') &&
      this.engine.waterRevision !== this.overlayWaterRev;
    if ((dirty || waterMoved) && this.overlayData && this.overlayTimer > 1) {
      this.overlayWaterRev = this.engine.waterRevision;
      // Derived overlay fields (upstream area, elevation range) change with the terrain: refresh, redraw all.
      this.overlayTimer = 0;
      this.overlayData = prepareOverlay(this.terrainOverlay, this.engine);
      dirty = {
        x0: 0,
        y0: 0,
        x1: this.engine.world.width,
        y1: this.engine.world.height,
      };
    }
    if (dirty) {
      this.treesStale = true;
      this.updateVertices(dirty, true);
      this.updateHeightTexture();
      this.waterLayer?.updateGround();
      if (dirty.x0 <= 1 || dirty.y0 <= 1 || dirty.x1 >= this.engine.world.width - 1 || dirty.y1 >= this.engine.world.height - 1) this.updateSkirts();
    }
    // Snow changes with the simulation, not with terrain edits: recolour twice a second while it does.
    this.snowTimer += rawDt;
    if (this.snowTimer > 0.5) {
      this.snowTimer = 0;
      const w = this.engine.world;
      const rev = this.engine.waterRevision;
      if (rev !== this.snowRev) {
        this.snowRev = rev;
        let any = false;
        for (let i = 0; i < w.snowSweM.length && !any; i++) any = w.snowSweM[i] > 0;
        if (any || this.hadSnow) this.updateVertices({ x0: 0, y0: 0, x1: w.width, y1: w.height }, true);
        this.hadSnow = any;
      }
    }
    this.treeTimer += rawDt;
    if (this.trees && this.treeTimer > 1 && (this.engine.vegetationRevision !== this.treeRev || (this.treesStale && this.trees.count > 0))) {
      this.treeTimer = 0;
      this.treesStale = false;
      this.treeRev = this.engine.vegetationRevision;
      this.trees.rebuild();
    }
    if (this.brushVisible) this.updateBrushRing();
    if (this.profileEnds) this.updateProfileLine();
    if (this.pins.length) this.updatePins();
    this.updateCameraPath(rawDt);
    this.controls.update();
    let shook: Vector3 | null = null;
    if (this.shakeT < 1.6) {
      this.shakeT += rawDt;
      const a = this.shakeAmp * Math.exp(-3 * this.shakeT);
      shook = new Vector3((Math.random() - 0.5) * a, (Math.random() - 0.5) * a, (Math.random() - 0.5) * a);
      this.camera.position.add(shook);
    }
    this.sky.position.copy(this.camera.position);
    this.strataUniforms.uTime.value = now / 1000;
    if (this.sea) this.sea.material.uniforms.uTime.value = now / 1000;
    this.waterLayer?.update(now / 1000);
    this.clouds?.update(dt);
    const t0 = performance.now();
    this.renderer.render(this.scene, this.camera);
    for (const fn of this.frameListeners) fn();
    if (shook) this.camera.position.sub(shook);
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
    // A panel covering the left of the view (classroom lesson panel): shift the view centre right so
    // the landscape sits in the visible part. Picking and label projection use the same matrix.
    if (this.viewInsetLeft > 0) this.camera.setViewOffset(wPx, hPx, -this.viewInsetLeft / 2, 0, wPx, hPx);
    else this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();
  }

  private viewInsetLeft = 0;
  /** PNG of the current view: render now and read the canvas in the same task (no preserved buffer needed). */
  captureView(): Promise<Blob> {
    this.renderer.render(this.scene, this.camera);
    return new Promise((resolve, reject) => this.renderer.domElement.toBlob((b) => (b ? resolve(b) : reject(new Error('Canvas capture failed'))), 'image/png'));
  }

  /** Record the live rendered canvas as a browser-native WebM video. */
  recordVideo(seconds = 10, fps = 30): Promise<Blob> {
    if (typeof MediaRecorder === 'undefined' || !this.renderer.domElement.captureStream) throw new Error('Video recording is not supported by this browser');
    const stream = this.renderer.domElement.captureStream(fps);
    const mimeType = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find((m) => MediaRecorder.isTypeSupported(m)) ?? '';
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType, videoBitsPerSecond: 8_000_000 } : { videoBitsPerSecond: 8_000_000 });
    const chunks: BlobPart[] = [];
    return new Promise((resolve, reject) => {
      recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      recorder.onerror = () => reject(new Error('Video recording failed'));
      recorder.onstop = () => {
        for (const track of stream.getTracks()) track.stop();
        resolve(new Blob(chunks, { type: recorder.mimeType || 'video/webm' }));
      };
      recorder.start(250);
      setTimeout(() => recorder.state === 'recording' && recorder.stop(), Math.max(1, seconds) * 1000);
    });
  }

  /** Reserve `px` CSS pixels on the left for an overlay panel (0 = none). */
  setViewInsetLeft(px: number) {
    if (px === this.viewInsetLeft) return;
    this.viewInsetLeft = px;
    this.resize();
  }

  // ---------- picking & brush ring ----------

  /** Pick the terrain under a client (CSS px) position. Returns world coordinates. */
  pick(clientX: number, clientY: number): RayHit | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    const o = new Vector3().setFromMatrixPosition(this.camera.matrixWorld);
    const d = new Vector3(ndc.x, ndc.y, 0.5).unproject(this.camera).sub(o).normalize();
    const ve = this.verticalExaggeration;
    // three → world: (x, -z, y / ve)
    const dir = new Vector3(d.x, -d.z, d.y / ve).normalize();
    return raycastHeightfield(this.engine.heightfield, [o.x, -o.z, o.y / ve], [dir.x, dir.y, dir.z], this.camera.far);
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
    const ve = this.verticalExaggeration;
    for (let k = 0; k <= 128; k++) {
      const th = (k / 128) * Math.PI * 2;
      const x = this.brushCentre.x + Math.cos(th) * this.brushRadius;
      const y = this.brushCentre.y + Math.sin(th) * this.brushRadius;
      a.setXYZ(k, x, (sampleBilinear(hf, x, y) + lift) * ve, -y);
    }
    a.needsUpdate = true;
  }

  /** Show a transect draped on the terrain (world metres), or hide with null. */
  setProfileLine(ends: [number, number, number, number] | null) {
    this.profileEnds = ends;
    this.profileLine.visible = !!ends;
  }

  /** Show measurement pins (labelled sticks) at world positions; [] hides them. */
  setPins(pins: { label: string; xM: number; yM: number }[]) {
    for (const p of this.pins) {
      p.stick.geometry.dispose();
      (p.stick.material as LineBasicMaterial).dispose();
      p.sprite.material.map?.dispose();
      p.sprite.material.dispose();
    }
    this.pinGroup.clear();
    this.pins = pins.map((p) => {
      const g = new BufferGeometry();
      g.setAttribute('position', new BufferAttribute(new Float32Array(6), 3));
      const stick = new Line(
        g,
        new LineBasicMaterial({
          color: 0xffe627,
          depthTest: false,
          transparent: true,
        }),
      );
      stick.renderOrder = 12;
      stick.frustumCulled = false;
      const c = document.createElement('canvas');
      c.width = c.height = 64;
      const ctx = c.getContext('2d')!;
      ctx.fillStyle = '#ffe627';
      ctx.beginPath();
      ctx.arc(32, 32, 28, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#1d1a16';
      ctx.stroke();
      ctx.fillStyle = '#1d1a16';
      ctx.font = 'bold 36px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(p.label, 32, 34);
      const sprite = new Sprite(
        new SpriteMaterial({
          map: new CanvasTexture(c),
          depthTest: false,
          transparent: true,
        }),
      );
      sprite.renderOrder = 13;
      sprite.frustumCulled = false;
      this.pinGroup.add(stick, sprite);
      return { ...p, stick, sprite };
    });
    this.updatePins();
  }

  private updatePins() {
    const hf = this.engine.heightfield;
    const h = Math.max(4, this.reliefM * 0.06);
    const size = Math.max(this.engine.world.cellSizeM * 3, this.camera.position.distanceTo(this.controls.target) * 0.035);
    const ve = this.verticalExaggeration;
    for (const p of this.pins) {
      const z = sampleBilinear(hf, p.xM, p.yM) * ve;
      const a = p.stick.geometry.getAttribute('position') as BufferAttribute;
      a.setXYZ(0, p.xM, z, -p.yM);
      a.setXYZ(1, p.xM, z + h, -p.yM);
      a.needsUpdate = true;
      p.sprite.position.set(p.xM, z + h + size * 0.5, -p.yM);
      p.sprite.scale.setScalar(size);
    }
  }

  private updateProfileLine() {
    const [ax, ay, bx, by] = this.profileEnds!;
    const a = this.profileLine.geometry.getAttribute('position') as BufferAttribute;
    const hf = this.engine.heightfield;
    const lift = Math.max(0.5, this.reliefM * 0.004);
    const ve = this.verticalExaggeration;
    for (let k = 0; k <= 128; k++) {
      const t = k / 128;
      const x = ax + (bx - ax) * t;
      const y = ay + (by - ay) * t;
      a.setXYZ(k, x, (sampleBilinear(hf, x, y) + lift) * ve, -y);
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
    this.cameraMode = 'orbit';
    this.controls.enabled = true;
    const c = this.worldCentre();
    const s = this.worldSize();
    c.y = Math.max(c.y, this.engine.world.seaLevelM);
    this.controls.target.copy(c);
    this.camera.position.set(c.x + s * 0.55, c.y + s * 0.62, c.z + s * 0.72);
    this.controls.update();
  }

  setCameraMode(mode: CameraMode) {
    this.cameraMode = mode;
    this.cameraPathTime = 0;
    this.controls.enabled = mode === 'orbit' || mode === 'first-person';
    if (mode === 'orbit') return;
    if (mode === 'first-person') {
      const c = this.controls.target.clone();
      const w = this.engine.world;
      c.x = Math.max(0, Math.min((w.width - 1) * w.cellSizeM, c.x));
      const north = Math.max(0, Math.min((w.height - 1) * w.cellSizeM, -c.z));
      c.z = -north;
      const eye = Math.max(2, w.cellSizeM * 0.08);
      const ground = this.engine.sampleSurface(c.x, north) * this.verticalExaggeration;
      const fwd = new Vector3().subVectors(this.controls.target, this.camera.position).setY(0).normalize();
      if (fwd.lengthSq() < 0.1) fwd.set(0, 0, -1);
      this.camera.position.set(c.x, ground + eye, c.z);
      this.controls.target.copy(this.camera.position).add(fwd.multiplyScalar(Math.max(12, w.cellSizeM)));
      this.controls.target.y = this.camera.position.y;
      this.controls.update();
    }
  }

  private updateCameraPath(dt: number) {
    if (this.cameraMode !== 'flyover' && this.cameraMode !== 'cinematic') return;
    this.cameraPathTime += dt;
    const w = this.engine.world;
    const ex = (w.width - 1) * w.cellSizeM;
    const ey = (w.height - 1) * w.cellSizeM;
    const p = automaticCameraPose(this.cameraMode, this.cameraPathTime, ex, ey, this.reliefM, (x, y) => this.engine.sampleSurface(x, y) * this.verticalExaggeration);
    this.camera.position.fromArray(p.position);
    this.controls.target.fromArray(p.target);
  }

  focusPoint(xM: number, yM: number) {
    const w = this.engine.world;
    const x = Math.max(0, Math.min((w.width - 1) * w.cellSizeM, xM));
    const y = Math.max(0, Math.min((w.height - 1) * w.cellSizeM, yM));
    const z = this.engine.sampleSurface(x, y) * this.verticalExaggeration;
    const distance = Math.max(w.cellSizeM * 8, this.worldSize() * 0.14);
    this.cameraMode = 'orbit';
    this.controls.enabled = true;
    this.controls.target.set(x, z, -y);
    this.camera.position.set(x + distance * 0.72, z + distance * 0.55, -y + distance * 0.72);
    this.controls.update();
  }

  /** Look straight down at the whole map; `height` × map size above it (larger = more margin). */
  topDown(height = 1.25) {
    this.cameraMode = 'orbit';
    this.controls.enabled = true;
    const c = this.worldCentre();
    const s = this.worldSize();
    this.controls.target.copy(c);
    this.camera.position.set(c.x, c.y + s * height, c.z + s * 0.001);
    this.controls.update();
  }

  oblique() {
    this.cameraMode = 'orbit';
    this.controls.enabled = true;
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
    if (this.cameraMode === 'first-person') {
      const w = this.engine.world;
      const maxX = (w.width - 1) * w.cellSizeM;
      const maxY = (w.height - 1) * w.cellSizeM;
      this.camera.position.x = Math.max(0, Math.min(maxX, this.camera.position.x));
      this.camera.position.z = Math.max(-maxY, Math.min(0, this.camera.position.z));
      const eye = Math.max(2, w.cellSizeM * 0.08);
      this.camera.position.y = this.engine.sampleSurface(this.camera.position.x, -this.camera.position.z) * this.verticalExaggeration + eye;
      this.controls.target.y = this.camera.position.y;
    }
  }

  getPose(): CameraPose {
    return {
      position: this.camera.position.toArray() as CameraPose['position'],
      target: this.controls.target.toArray() as CameraPose['target'],
    };
  }

  setPose(p: CameraPose) {
    this.camera.position.fromArray(p.position);
    this.controls.target.fromArray(p.target);
    this.controls.update();
  }

  setTerrainOverlay(o: TerrainOverlay) {
    if (o === this.terrainOverlay) return;
    this.terrainOverlay = o;
    this.overlayData = overlayById(o)?.colour ? prepareOverlay(o, this.engine) : null;
    this.overlayTimer = 0;
    this.strataUniforms.uStrataOn.value = o === 'none' ? 1 : 0;
    const w = this.engine.world;
    this.updateVertices({ x0: 0, y0: 0, x1: w.width, y1: w.height }, true);
    this.updatePlateArrows();
  }

  /** Short decaying camera shake for an earthquake (feel only — the deformation is the mechanism). */
  shake(mw: number) {
    this.shakeAmp = Math.min(1, Math.max(0, (mw - 4.5) / 4)) * this.reliefM * 0.02 + 1;
    this.shakeT = 0;
  }
  private shakeAmp = 0;
  private shakeT = 10;

  /** One arrow per plate at its centre, along its motion (length ∝ speed), while 'plates' is shown. */
  private updatePlateArrows() {
    for (const c of [...this.plateArrows.children]) {
      this.plateArrows.remove(c);
      (c as ArrowHelper).dispose();
    }
    if (this.terrainOverlay !== 'plates') return;
    const w = this.engine.world;
    const plates = w.tectonics.plates;
    if (plates.length < 2) return;
    const W = w.width;
    const cs = w.cellSizeM;
    const sx = new Float64Array(plates.length);
    const sy = new Float64Array(plates.length);
    const n = new Float64Array(plates.length);
    let zmax = -Infinity;
    for (let i = 0; i < w.plateId.length; i++) {
      const k = w.plateId[i];
      if (k >= plates.length) continue;
      sx[k] += i % W;
      sy[k] += Math.floor(i / W);
      n[k]++;
      zmax = Math.max(zmax, this.engine.surface[i]);
    }
    const size = (Math.max(W, w.height) - 1) * cs;
    for (const p of plates) {
      if (!n[p.id]) continue;
      const speed = Math.hypot(p.vxMmYr, p.vyMmYr);
      if (speed < 0.5) continue;
      const len = size * 0.12 * Math.min(2, speed / 30);
      const dir = new Vector3(p.vxMmYr, 0, -p.vyMmYr).normalize();
      const origin = new Vector3((sx[p.id] / n[p.id]) * cs, zmax + size * 0.03, -(sy[p.id] / n[p.id]) * cs).addScaledVector(dir, -len / 2);
      const a = new ArrowHelper(dir, origin, len, PLATE_COLOURS[p.id % PLATE_COLOURS.length], len * 0.3, len * 0.18);
      this.plateArrows.add(a);
    }
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
    this.trees?.dispose();
    this.clouds?.dispose();
    this.resizeObs.disconnect();
    this.controls.dispose();
    this.terrain?.geometry.dispose();
    this.terrainMat.dispose();
    this.heightTex?.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
