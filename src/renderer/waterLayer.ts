import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DataTexture,
  DoubleSide,
  FloatType,
  Mesh,
  NearestFilter,
  RGBAFormat,
  ShaderMaterial,
  Texture,
  type WebGLRenderer,
} from 'three';
import type { Engine } from '../engine/engine';

export type WaterView = 'water' | 'depth' | 'speed' | 'off';

/**
 * Renders simulated surface water. Geometry is a grid with one vertex per cell; the vertex
 * shader reads ground (z, sea flag) and water state (depth, vx, vy) textures, so the surface
 * height, colour, foam and flow streaks all come from the solver's fields:
 *   - GPU backend: the solver's own state texture is bound directly (no readback);
 *   - CPU backend: a DataTexture mirrored from world.waterDepthM / sim.vx / sim.vy.
 * Sea cells are not drawn here (the sea-level surface covers them).
 */
export class WaterLayer {
  readonly mesh: Mesh<BufferGeometry, ShaderMaterial>;
  private ground: DataTexture;
  private groundData: Float32Array;
  private cpuState: DataTexture;
  private cpuData: Float32Array;
  private gpuState = new Texture();
  private lastRevision = -1;

  constructor(private engine: Engine, private renderer: WebGLRenderer, index: BufferAttribute, positions: Float32Array) {
    const w = engine.world;
    const n = w.width * w.height;
    this.groundData = new Float32Array(n * 4);
    this.ground = this.dataTex(this.groundData);
    this.cpuData = new Float32Array(n * 4);
    this.cpuState = this.dataTex(this.cpuData);
    const geo = new BufferGeometry();
    geo.setIndex(index);
    geo.setAttribute('position', new BufferAttribute(positions, 3));
    const mat = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
      uniforms: {
        uGround: { value: this.ground },
        uState: { value: this.cpuState },
        uCs: { value: w.cellSizeM },
        uSize: { value: [w.width, w.height] },
        uTime: { value: 0 },
        uMode: { value: 0 },
        uSunDir: { value: [0.5, 0.7, 0.3] },
        uShallow: { value: new Color(0x5aa7a0) },
        uDeep: { value: new Color(0x0f4a7a) },
        uFogColor: { value: new Color(0xd2e2ee) },
        uFogNear: { value: 1e4 },
        uFogFar: { value: 1e5 },
        uLift: { value: 0.3 },
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
    });
    this.mesh = new Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 3;
    this.updateGround();
  }

  private dataTex(data: Float32Array): DataTexture {
    const w = this.engine.world;
    const t = new DataTexture(data, w.width, w.height, RGBAFormat, FloatType);
    t.minFilter = t.magFilter = NearestFilter;
    t.generateMipmaps = false;
    t.needsUpdate = true;
    return t;
  }

  setView(v: WaterView) {
    const u = this.mesh.material.uniforms;
    this.mesh.visible = v !== 'off';
    u.uMode.value = v === 'depth' ? 1 : v === 'speed' ? 2 : 0;
  }

  setFog(near: number, far: number, sunDir: number[], lift: number) {
    const u = this.mesh.material.uniforms;
    u.uFogNear.value = near;
    u.uFogFar.value = far;
    u.uSunDir.value = sunDir;
    u.uLift.value = lift;
  }

  /** Refresh surface elevation + sea flags (after terrain edits). */
  updateGround() {
    const z = this.engine.surface;
    const sea = this.engine.water.sea;
    const g = this.groundData;
    for (let i = 0; i < z.length; i++) {
      g[i * 4] = z[i];
      g[i * 4 + 1] = sea[i];
    }
    this.ground.needsUpdate = true;
  }

  /** Bind the current water state texture (call every frame before rendering). */
  update(timeS: number) {
    const u = this.mesh.material.uniforms;
    u.uTime.value = timeS;
    const gpu = this.engine.gpu;
    if (gpu) {
      // Bind the solver's raw ping-pong texture into three without re-uploading.
      (this.renderer.properties.get(this.gpuState) as { __webglTexture?: WebGLTexture }).__webglTexture = gpu.stateTexture;
      u.uState.value = this.gpuState;
      return;
    }
    u.uState.value = this.cpuState;
    if (this.engine.waterRevision === this.lastRevision) return;
    this.lastRevision = this.engine.waterRevision;
    const d = this.engine.world.waterDepthM;
    const vx = this.engine.water.vx;
    const vy = this.engine.water.vy;
    const s = this.cpuData;
    for (let i = 0; i < d.length; i++) {
      s[i * 4] = d[i];
      s[i * 4 + 1] = vx[i];
      s[i * 4 + 2] = vy[i];
    }
    this.cpuState.needsUpdate = true;
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.ground.dispose();
    this.cpuState.dispose();
  }
}

const VERT = /* glsl */ `
uniform sampler2D uGround;
uniform sampler2D uState;
uniform float uCs;
uniform ivec2 uSize;
uniform int uMode;
uniform float uLift;
varying float vDepth;
varying vec2 vVel;
varying vec3 vNormal2;
varying vec3 vWorld;
varying float vHide;

float headAt(ivec2 c, float fallback) {
  c = clamp(c, ivec2(0), uSize - 1);
  vec4 g = texelFetch(uGround, c, 0);
  float d = texelFetch(uState, c, 0).r;
  return d > 0.01 && g.g < 0.5 ? g.r + d : fallback;
}

void main() {
  ivec2 c = ivec2(int(round(position.x / uCs)), int(round(-position.z / uCs)));
  vec4 g = texelFetch(uGround, c, 0);
  vec4 s = texelFetch(uState, c, 0);
  float d = s.r;
  float z = g.r;
  bool wet = d > 0.01 && g.g < 0.5;
  float h;
  if (uMode == 0) h = wet ? z + d : z - max(0.3, uLift);
  else h = z + max(d, 0.0) + uLift; // overlays drape over the ground
  vDepth = g.g > 0.5 ? -1.0 : d;
  vHide = g.g;
  vVel = s.gb;
  float H = wet ? z + d : h;
  float hx = headAt(c + ivec2(1, 0), H) - headAt(c - ivec2(1, 0), H);
  float hy = headAt(c + ivec2(0, 1), H) - headAt(c - ivec2(0, 1), H);
  // world (x east, y north, z up) → three (x, z, -y)
  vNormal2 = normalize(vec3(-hx / (2.0 * uCs), 1.0, hy / (2.0 * uCs)));
  vec4 wp = modelMatrix * vec4(position.x, h, position.z, 1.0);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const FRAG = /* glsl */ `
uniform float uTime;
uniform int uMode;
uniform vec3 uSunDir, uShallow, uDeep, uFogColor;
uniform float uFogNear, uFogFar;
varying float vDepth;
varying vec2 vVel;
varying vec3 vNormal2;
varying vec3 vWorld;
varying float vHide;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
vec3 ramp(float t, vec3 a, vec3 b, vec3 c) { return t < 0.5 ? mix(a, b, t * 2.0) : mix(b, c, t * 2.0 - 1.0); }

void main() {
  if (vHide > 0.5) discard;
  float d = vDepth;
  float speed = length(vVel);
  if (uMode == 1) {
    if (d < 0.005) discard;
    // log depth 1 cm … 10 m
    float t = clamp(log(d / 0.01) / log(1e3), 0.0, 1.0);
    gl_FragColor = vec4(ramp(t, vec3(0.80, 0.93, 1.0), vec3(0.20, 0.55, 0.95), vec3(0.04, 0.12, 0.45)), 0.85);
    #include <colorspace_fragment>
    return;
  }
  if (uMode == 2) {
    if (d < 0.005) discard;
    float t = clamp(speed / 3.0, 0.0, 1.0);
    gl_FragColor = vec4(ramp(t, vec3(1.0, 0.95, 0.55), vec3(1.0, 0.57, 0.16), vec3(0.78, 0.10, 0.10)), 0.85);
    #include <colorspace_fragment>
    return;
  }
  if (d < 0.01) discard;
  vec3 n = normalize(vNormal2);
  // Flow streaks advected by the simulated velocity (world x east, y north → three x, -z).
  vec2 flow = vec2(vVel.x, -vVel.y);
  vec2 p = vWorld.xz * 0.08;
  float ph0 = fract(uTime * 0.25);
  float ph1 = fract(uTime * 0.25 + 0.5);
  vec2 dir = speed > 1e-4 ? flow / speed : vec2(1.0, 0.0);
  mat2 rot = mat2(dir.x, -dir.y, dir.y, dir.x);
  vec2 q0 = rot * (p - flow * ph0 * 1.2) * vec2(0.35, 2.5);
  vec2 q1 = rot * (p - flow * ph1 * 1.2) * vec2(0.35, 2.5);
  float w0 = abs(ph0 - 0.5) * 2.0;
  float streak = mix(vnoise(q0), vnoise(q1), w0);
  float moving = smoothstep(0.05, 0.6, speed);
  n = normalize(n + vec3((streak - 0.5) * 0.25 * moving, 0.0, (vnoise(q0.yx) - 0.5) * 0.25 * moving));

  float depthT = smoothstep(0.0, 4.0, d);
  vec3 col = mix(uShallow, uDeep, depthT);
  vec3 v = normalize(cameraPosition - vWorld);
  vec3 l = normalize(uSunDir);
  float diff = 0.55 + 0.45 * max(dot(n, l), 0.0);
  float spec = pow(max(dot(reflect(-l, n), v), 0.0), 90.0) * 0.7;
  float fres = pow(1.0 - max(dot(n, v), 0.0), 4.0);
  col = col * diff + vec3(spec) + fres * vec3(0.55, 0.68, 0.8) * 0.3;
  // Foam/whitewater where flow is fast relative to depth (Froude-like proxy).
  float froude = speed / sqrt(9.81 * max(d, 0.01));
  float foam = smoothstep(0.8, 1.8, froude) * smoothstep(0.45, 0.85, streak) * smoothstep(0.5, 1.5, speed) * smoothstep(0.05, 0.3, d);
  col = mix(col, vec3(0.93, 0.96, 0.97), foam * 0.8);
  float alpha = mix(0.12, 0.92, smoothstep(0.01, 1.0, d));
  alpha = max(alpha, foam * 0.9);
  float fogF = smoothstep(uFogNear, uFogFar, length(cameraPosition - vWorld));
  col = mix(col, uFogColor, fogF);
  gl_FragColor = vec4(col, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
