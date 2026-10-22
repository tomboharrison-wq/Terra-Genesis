import type { WorldState } from '../../engine/world';
import type { Stepper } from '../../engine/clock';
import type { WaterSim } from './waterSim';

/**
 * WebGL2 port of WaterSim (same local-inertial pipe scheme, see waterSim.ts) for interactive
 * speed. Textures (RGBA32F, one texel per cell, texel (x, y) = cell (x, y), y north):
 *   ground: r = surface elevation z (m), g = sea flag
 *   state:  r = depth d (m), g = vx, b = vy (m/s)
 *   flux:   outflow discharge west, east, south, north (m³/s)
 *   acc:    per-cell accumulated depth-equivalents since last sync: infiltrated, evaporated,
 *           into sea, out of open edges (m) → folded into the CPU ledger (×cell area) on sync.
 * Rain and source inputs are ledgered analytically on the CPU (they do not depend on state).
 *
 * The CPU arrays (world.waterDepthM / waterFluxM3PerS, sim.vx/vy) are a mirror refreshed by
 * syncToCpu(); while a GpuWater is attached the GPU textures are authoritative.
 */

const MAX_SOURCES = 16;
const G = 9.81;

const VS = `#version 300 es
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const HEADER = `#version 300 es
precision highp float;
precision highp int;
uniform ivec2 uSize;
uniform float uDt;
uniform float uCs;
`;

const FORCING_FS = `${HEADER}
uniform sampler2D uGround;
uniform sampler2D uState;
uniform sampler2D uAcc;
uniform float uRain;
uniform float uInf;
uniform float uEvap;
uniform vec4 uSrc[${MAX_SOURCES}];
uniform int uNSrc;
layout(location = 0) out vec4 oState;
layout(location = 1) out vec4 oAcc;
void main() {
  ivec2 c = ivec2(gl_FragCoord.xy);
  vec4 s = texelFetch(uState, c, 0);
  vec4 acc = texelFetch(uAcc, c, 0);
  float sea = texelFetch(uGround, c, 0).g;
  float d = s.r;
  if (sea > 0.5) {
    acc.b += d; // water on a cell that became sea joins the sea (ledgered)
    oState = vec4(0.0);
    oAcc = acc;
    return;
  }
  d += uRain * uDt;
  for (int k = 0; k < ${MAX_SOURCES}; k++) {
    if (k >= uNSrc) break;
    if (ivec2(uSrc[k].xy) == c) d += uSrc[k].z * uDt;
  }
  float lossRate = uInf + uEvap;
  if (lossRate > 0.0 && d > 0.0) {
    float l = min(d, lossRate * uDt);
    d -= l;
    float fInf = uInf / lossRate;
    acc.r += l * fInf;
    acc.g += l * (1.0 - fInf);
  }
  oState = vec4(d, s.g, s.b, 0.0);
  oAcc = acc;
}`;

const FLUX_FS = `${HEADER}
uniform sampler2D uGround;
uniform sampler2D uState;
uniform sampler2D uFlux;
uniform float uSea;
uniform float uManning2;
uniform int uOpen;
out vec4 oFlux;
float gdt;
float fr;
float face(float fOld, float Hi, float zi, float Hj, float zj) {
  float hf = max(Hi, Hj) - max(zi, zj);
  if (hf <= 1e-6) return 0.0;
  float f = (fOld + gdt * hf * (Hi - Hj)) / (1.0 + (fr * fOld) / pow(hf, 7.0 / 3.0));
  return max(f, 0.0);
}
float nb(ivec2 j, float Hi, float zi, float fOld, bool inside) {
  if (!inside) return uOpen == 1 ? face(fOld, Hi, zi, zi, zi) : 0.0;
  vec4 g = texelFetch(uGround, j, 0);
  float dj = texelFetch(uState, j, 0).r;
  bool sj = g.g > 0.5;
  return face(fOld, Hi, zi, sj ? uSea : g.r + dj, sj ? min(g.r, uSea) : g.r);
}
void main() {
  ivec2 c = ivec2(gl_FragCoord.xy);
  vec4 g = texelFetch(uGround, c, 0);
  float di = texelFetch(uState, c, 0).r;
  if (g.g > 0.5 || di <= 0.0) { oFlux = vec4(0.0); return; }
  gdt = ${G} * uDt;
  fr = gdt * uManning2 / uCs;
  vec4 F = texelFetch(uFlux, c, 0);
  float zi = g.r;
  float Hi = zi + di;
  float f0 = nb(c + ivec2(-1, 0), Hi, zi, F.x, c.x > 0);
  float f1 = nb(c + ivec2(1, 0), Hi, zi, F.y, c.x < uSize.x - 1);
  float f2 = nb(c + ivec2(0, -1), Hi, zi, F.z, c.y > 0);
  float f3 = nb(c + ivec2(0, 1), Hi, zi, F.w, c.y < uSize.y - 1);
  float outVol = (f0 + f1 + f2 + f3) * uDt;
  float avail = di * uCs * uCs;
  if (outVol > avail) {
    float sc = avail / outVol;
    f0 *= sc; f1 *= sc; f2 *= sc; f3 *= sc;
  }
  oFlux = vec4(f0, f1, f2, f3);
}`;

const UPDATE_FS = `${HEADER}
uniform sampler2D uGround;
uniform sampler2D uState;
uniform sampler2D uFlux;
uniform sampler2D uAcc;
layout(location = 0) out vec4 oState;
layout(location = 1) out vec4 oAcc;
void main() {
  ivec2 c = ivec2(gl_FragCoord.xy);
  float A = uCs * uCs;
  vec4 F = texelFetch(uFlux, c, 0);
  vec4 acc = texelFetch(uAcc, c, 0);
  float inW = c.x > 0 ? texelFetch(uFlux, c + ivec2(-1, 0), 0).y : 0.0;
  float inE = c.x < uSize.x - 1 ? texelFetch(uFlux, c + ivec2(1, 0), 0).x : 0.0;
  float inS = c.y > 0 ? texelFetch(uFlux, c + ivec2(0, -1), 0).w : 0.0;
  float inN = c.y < uSize.y - 1 ? texelFetch(uFlux, c + ivec2(0, 1), 0).z : 0.0;
  float inflow = inW + inE + inS + inN;
  if (texelFetch(uGround, c, 0).g > 0.5) {
    acc.b += inflow * uDt / A;
    oState = vec4(0.0);
    oAcc = acc;
    return;
  }
  float edge = 0.0;
  if (c.x == 0) edge += F.x;
  if (c.x == uSize.x - 1) edge += F.y;
  if (c.y == 0) edge += F.z;
  if (c.y == uSize.y - 1) edge += F.w;
  acc.a += edge * uDt / A;
  float dOld = texelFetch(uState, c, 0).r;
  float dNew = max(0.0, dOld + (inflow - (F.x + F.y + F.z + F.w)) * uDt / A);
  float dm = 0.5 * (dOld + dNew);
  vec2 v = vec2(0.0);
  if (dm > 1e-3) {
    v = vec2(inW - F.x + F.y - inE, inS - F.z + F.w - inN) / (2.0 * uCs * dm);
    float s = length(v);
    if (s > 20.0) v *= 20.0 / s;
  }
  oState = vec4(dNew, v, 0.0);
  oAcc = acc;
}`;

interface Prog {
  p: WebGLProgram;
  u: Map<string, WebGLUniformLocation | null>;
}

export class GpuWater implements Stepper {
  readonly kind = 'gpu';
  private gl: WebGL2RenderingContext;
  private ground: WebGLTexture;
  private state: [WebGLTexture, WebGLTexture];
  private flux: [WebGLTexture, WebGLTexture];
  private acc: [WebGLTexture, WebGLTexture];
  private fbStateAcc: [WebGLFramebuffer, WebGLFramebuffer];
  private fbFlux: [WebGLFramebuffer, WebGLFramebuffer];
  private vao: WebGLVertexArrayObject;
  private forcing: Prog;
  private fluxProg: Prog;
  private update: Prog;
  private s = 0; // index of current state/acc
  private f = 0; // index of current flux
  private W: number;
  private H: number;
  private nonSeaCells = 0;
  /** Depth assumed when choosing dt between syncs (m); grows to observed max depth. */
  assumedDepthM = 4;
  disposed = false;

  static isSupported(gl: WebGL2RenderingContext): boolean {
    return !!gl.getExtension('EXT_color_buffer_float');
  }

  constructor(gl: WebGL2RenderingContext, private world: WorldState, private surface: Float32Array, private sim: WaterSim) {
    if (!GpuWater.isSupported(gl)) throw new Error('EXT_color_buffer_float unavailable');
    this.gl = gl;
    this.W = world.width;
    this.H = world.height;
    this.ground = this.tex();
    this.state = [this.tex(), this.tex()];
    this.flux = [this.tex(), this.tex()];
    this.acc = [this.tex(), this.tex()];
    this.fbStateAcc = [this.fb([this.state[0], this.acc[0]]), this.fb([this.state[1], this.acc[1]])];
    this.fbFlux = [this.fb([this.flux[0]]), this.fb([this.flux[1]])];
    this.vao = gl.createVertexArray()!;
    this.forcing = this.program(FORCING_FS);
    this.fluxProg = this.program(FLUX_FS);
    this.update = this.program(UPDATE_FS);
    this.uploadGround();
    this.uploadWater();
  }

  // ---------- GL helpers ----------

  private tex(): WebGLTexture {
    const gl = this.gl;
    const t = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA32F, this.W, this.H);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);
    return t;
  }

  private fb(texs: WebGLTexture[]): WebGLFramebuffer {
    const gl = this.gl;
    const fb = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    texs.forEach((t, k) => gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + k, gl.TEXTURE_2D, t, 0));
    gl.drawBuffers(texs.map((_, k) => gl.COLOR_ATTACHMENT0 + k));
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (status !== gl.FRAMEBUFFER_COMPLETE) throw new Error(`Water framebuffer incomplete (0x${status.toString(16)})`);
    return fb;
  }

  private program(fs: string): Prog {
    const gl = this.gl;
    const sh = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(`Water shader: ${gl.getShaderInfoLog(s)}`);
      return s;
    };
    const p = gl.createProgram()!;
    gl.attachShader(p, sh(gl.VERTEX_SHADER, VS));
    gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(`Water program: ${gl.getProgramInfoLog(p)}`);
    return { p, u: new Map() };
  }

  private uni(pr: Prog, name: string) {
    if (!pr.u.has(name)) pr.u.set(name, this.gl.getUniformLocation(pr.p, name));
    return pr.u.get(name)!;
  }

  private bindTex(pr: Prog, name: string, unit: number, t: WebGLTexture) {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.uniform1i(this.uni(pr, name), unit);
  }

  private write(t: WebGLTexture, data: Float32Array) {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, this.W, this.H, gl.RGBA, gl.FLOAT, data);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  private read(fb: WebGLFramebuffer, attachment: number, out: Float32Array) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, fb);
    gl.readBuffer(gl.COLOR_ATTACHMENT0 + attachment);
    gl.readPixels(0, 0, this.W, this.H, gl.RGBA, gl.FLOAT, out);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
  }

  // ---------- CPU ↔ GPU ----------

  /** Upload surface elevation + sea mask (after terrain edits). */
  uploadGround(): void {
    this.sim.refreshSea();
    const n = this.W * this.H;
    const g = new Float32Array(n * 4);
    let nonSea = 0;
    for (let i = 0; i < n; i++) {
      g[i * 4] = this.surface[i];
      g[i * 4 + 1] = this.sim.sea[i];
      if (!this.sim.sea[i]) nonSea++;
    }
    this.nonSeaCells = nonSea;
    this.write(this.ground, g);
  }

  /** Upload the CPU water mirror (depth, velocity, flux) and clear accumulators. */
  uploadWater(): void {
    const n = this.W * this.H;
    const st = new Float32Array(n * 4);
    const d = this.world.waterDepthM;
    for (let i = 0; i < n; i++) {
      st[i * 4] = d[i];
      st[i * 4 + 1] = this.sim.vx[i];
      st[i * 4 + 2] = this.sim.vy[i];
    }
    this.write(this.state[this.s], st);
    this.write(this.flux[this.f], this.world.waterFluxM3PerS);
    this.write(this.acc[this.s], new Float32Array(n * 4));
  }

  /** Read GPU state back into the CPU mirror, fold accumulators into the ledger, refresh stats. */
  syncToCpu(): void {
    const n = this.W * this.H;
    const st = new Float32Array(n * 4);
    const ac = new Float32Array(n * 4);
    this.read(this.fbStateAcc[this.s], 0, st);
    this.read(this.fbStateAcc[this.s], 1, ac);
    this.read(this.fbFlux[this.f], 0, this.world.waterFluxM3PerS);
    const d = this.world.waterDepthM;
    let inf = 0;
    let evap = 0;
    let sea = 0;
    let edge = 0;
    for (let i = 0; i < n; i++) {
      const o = i * 4;
      d[i] = st[o];
      this.sim.vx[i] = st[o + 1];
      this.sim.vy[i] = st[o + 2];
      inf += ac[o];
      evap += ac[o + 1];
      sea += ac[o + 2];
      edge += ac[o + 3];
    }
    const A = this.world.cellSizeM * this.world.cellSizeM;
    const L = this.sim.ledger;
    L.infiltrated += inf * A;
    L.evaporated += evap * A;
    L.seaOut += sea * A;
    L.edgeOut += edge * A;
    this.write(this.acc[this.s], new Float32Array(n * 4));
    this.sim.refreshStats();
    this.assumedDepthM = Math.max(4, this.sim.maxDepth * 1.25);
  }

  /** Current state texture (depth, vx, vy) for rendering. */
  get stateTexture(): WebGLTexture {
    return this.state[this.s];
  }

  // ---------- stepping ----------

  stableDt(): number {
    const cs = this.world.cellSizeM;
    const c = Math.sqrt(G * this.assumedDepthM) + 0.5 * this.sim.maxSpeed;
    const limit = (this.sim.cfl * cs) / c;
    let dt = this.sim.maxDt;
    for (let k = 0; k < 16 && dt > limit; k++) dt *= 0.5;
    return dt;
  }

  step(dt: number): void {
    const gl = this.gl;
    const w = this.world;
    const p = w.water;
    const A = w.cellSizeM * w.cellSizeM;
    const L = this.sim.ledger;
    // Analytic CPU-side ledger of state-independent inputs (mirrors WaterSim.applyForcing).
    if (p.rainMPerS > 0) L.rainIn += this.nonSeaCells * p.rainMPerS * dt * A;
    const src: number[] = [];
    for (const s of p.sources.slice(0, MAX_SOURCES)) {
      if (s.x < 0 || s.y < 0 || s.x >= w.width || s.y >= w.height || s.rateM3PerS <= 0) continue;
      L.sourceIn += s.rateM3PerS * dt;
      if (this.sim.sea[s.y * w.width + s.x]) L.seaOut += s.rateM3PerS * dt;
      else src.push(s.x, s.y, s.rateM3PerS / A, 0);
    }

    gl.bindVertexArray(this.vao);
    gl.viewport(0, 0, this.W, this.H);
    gl.disable(gl.BLEND);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.SCISSOR_TEST);
    gl.disable(gl.CULL_FACE);
    gl.colorMask(true, true, true, true);

    const common = (pr: Prog) => {
      gl.useProgram(pr.p);
      gl.uniform2i(this.uni(pr, 'uSize'), this.W, this.H);
      gl.uniform1f(this.uni(pr, 'uDt'), dt);
      gl.uniform1f(this.uni(pr, 'uCs'), w.cellSizeM);
    };

    // 1. forcing: state[s], acc[s] → state[1-s], acc[1-s]
    const s0 = this.s;
    const s1 = 1 - s0;
    common(this.forcing);
    this.bindTex(this.forcing, 'uGround', 0, this.ground);
    this.bindTex(this.forcing, 'uState', 1, this.state[s0]);
    this.bindTex(this.forcing, 'uAcc', 2, this.acc[s0]);
    gl.uniform1f(this.uni(this.forcing, 'uRain'), p.rainMPerS);
    gl.uniform1f(this.uni(this.forcing, 'uInf'), p.infiltrationMPerS);
    gl.uniform1f(this.uni(this.forcing, 'uEvap'), p.evaporationMPerS);
    gl.uniform1i(this.uni(this.forcing, 'uNSrc'), src.length / 4);
    if (src.length) gl.uniform4fv(this.uni(this.forcing, 'uSrc[0]'), new Float32Array(src));
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbStateAcc[s1]);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // 2. flux: state[1-s], flux[f] → flux[1-f]
    const f0 = this.f;
    const f1 = 1 - f0;
    common(this.fluxProg);
    this.bindTex(this.fluxProg, 'uGround', 0, this.ground);
    this.bindTex(this.fluxProg, 'uState', 1, this.state[s1]);
    this.bindTex(this.fluxProg, 'uFlux', 2, this.flux[f0]);
    gl.uniform1f(this.uni(this.fluxProg, 'uSea'), w.seaLevelM);
    gl.uniform1f(this.uni(this.fluxProg, 'uManning2'), p.manningN * p.manningN);
    gl.uniform1i(this.uni(this.fluxProg, 'uOpen'), p.boundary === 'open' ? 1 : 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbFlux[f1]);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // 3. update: state[1-s], flux[1-f], acc[1-s] → state[s], acc[s]
    common(this.update);
    this.bindTex(this.update, 'uGround', 0, this.ground);
    this.bindTex(this.update, 'uState', 1, this.state[s1]);
    this.bindTex(this.update, 'uFlux', 2, this.flux[f1]);
    this.bindTex(this.update, 'uAcc', 3, this.acc[s1]);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbStateAcc[s0]);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    this.f = f1;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindVertexArray(null);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    const gl = this.gl;
    for (const t of [this.ground, ...this.state, ...this.flux, ...this.acc]) gl.deleteTexture(t);
    for (const fb of [...this.fbStateAcc, ...this.fbFlux]) gl.deleteFramebuffer(fb);
    for (const pr of [this.forcing, this.fluxProg, this.update]) gl.deleteProgram(pr.p);
    gl.deleteVertexArray(this.vao);
  }
}
