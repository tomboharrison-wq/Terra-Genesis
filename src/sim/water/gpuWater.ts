import type { WorldState } from '../../engine/world';
import type { Stepper } from '../../engine/clock';
import type { WaterSim } from './waterSim';
import { MIN_TRANSPORT_DEPTH, SLOPE_MAX, SLOPE_MIN, SedimentSim } from '../sediment/sedimentSim';
import { MATERIALS } from '../../terrain/materials';

/**
 * WebGL2 port of WaterSim + SedimentSim (same schemes, see waterSim.ts / sedimentSim.ts).
 * Textures (RGBA32F, texel (x, y) = cell (x, y), y north):
 *   bed:    r = bedrock elevation, g = loose sediment thickness, b = suspended sediment (m),
 *           a = bedrock erodibility of the cell's lithology. Surface z = r + g; sea ⇔ z < sea level.
 *   state:  r = water depth d, g = vx, b = vy (m/s)
 *   flux:   outflow discharge west, east, south, north (m³/s)
 *   acc:    water depth-equivalents since last sync: lost (infiltration+evaporation, split by
 *           their rate ratio on sync), rain added, into sea, off edges
 *   sedA:   sediment since last sync (m): eroded loose, eroded bedrock, deposited on land, exported
 *   sedB:   r = deposited on the sea floor (m)
 * Accumulators are folded into the CPU ledgers (× cell area) on sync and cleared. Rain is
 * measured on the GPU (the land/sea mask moves with erosion); source inputs are ledgered on the CPU.
 * While attached, GPU textures are authoritative; CPU arrays are a mirror refreshed by syncToCpu().
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
uniform float uSea;
uniform sampler2D uBed;
float zAt(ivec2 c) { vec4 b = texelFetch(uBed, c, 0); return b.r + b.g; }
bool seaAt(ivec2 c) { return zAt(c) < uSea; }
`;

const FORCING_FS = `${HEADER}
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
  float d = s.r;
  if (seaAt(c)) {
    acc.b += d; // water on a cell that became sea joins the sea (ledgered)
    oState = vec4(0.0);
    oAcc = acc;
    return;
  }
  d += uRain * uDt;
  acc.g += uRain * uDt;
  for (int k = 0; k < ${MAX_SOURCES}; k++) {
    if (k >= uNSrc) break;
    if (ivec2(uSrc[k].xy) == c) d += uSrc[k].z * uDt;
  }
  float lossRate = uInf + uEvap;
  if (lossRate > 0.0 && d > 0.0) {
    float l = min(d, lossRate * uDt);
    d -= l;
    acc.r += l;
  }
  oState = vec4(d, s.g, s.b, 0.0);
  oAcc = acc;
}`;

const FLUX_FS = `${HEADER}
uniform sampler2D uState;
uniform sampler2D uFlux;
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
  float zj = zAt(j);
  bool sj = zj < uSea;
  float dj = texelFetch(uState, j, 0).r;
  return face(fOld, Hi, zi, sj ? uSea : zj + dj, sj ? min(zj, uSea) : zj);
}
void main() {
  ivec2 c = ivec2(gl_FragCoord.xy);
  float zi = zAt(c);
  float di = texelFetch(uState, c, 0).r;
  if (zi < uSea || di <= 0.0) { oFlux = vec4(0.0); return; }
  gdt = ${G} * uDt;
  fr = gdt * uManning2 / uCs;
  vec4 F = texelFetch(uFlux, c, 0);
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
  if (seaAt(c)) {
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

const SEDIMENT_FS = `${HEADER}
uniform sampler2D uPrev;   // state after forcing, before routing (depth d0)
uniform sampler2D uState;  // state after routing (d, vx, vy)
uniform sampler2D uFlux;   // discharges used by the routing step
uniform sampler2D uSedA;
uniform sampler2D uSedB;
uniform float uCapK;
uniform float uKe;         // min(1, erodeK * speedup * dt)
uniform float uKd;         // min(1, depositK * speedup * dt)
uniform float uRockF;
uniform float uKappa;      // creep coefficient (see SedimentSim.creepKappa)
layout(location = 0) out vec4 oBed;
layout(location = 1) out vec4 oSedA;
layout(location = 2) out vec4 oSedB;

// Suspended volume (per unit area of the source cell) leaving cell j through face k this step.
float outThrough(ivec2 j, int k) {
  vec4 b = texelFetch(uBed, j, 0);
  if (b.b <= 0.0 || b.r + b.g < uSea) return 0.0;
  float d0 = texelFetch(uPrev, j, 0).r;
  if (d0 <= 0.0) return 0.0;
  vec4 F = texelFetch(uFlux, j, 0);
  float f = k == 0 ? F.x : k == 1 ? F.y : k == 2 ? F.z : F.w;
  return b.b * f * uDt / (d0 * uCs * uCs);
}

// Creep loss of cell i to neighbour j (negative = gain), from start-of-step values.
float creepFace(float zi, float li, ivec2 j) {
  vec4 bj = texelFetch(uBed, j, 0);
  float dz = zi - (bj.r + bj.g);
  return dz > 0.0 ? min(uKappa * dz, 0.25 * li) : -min(-uKappa * dz, 0.25 * bj.g);
}

void main() {
  ivec2 c = ivec2(gl_FragCoord.xy);
  vec4 B = texelFetch(uBed, c, 0);
  vec4 sa = texelFetch(uSedA, c, 0);
  vec4 sb = texelFetch(uSedB, c, 0);
  float bedrock = B.r;
  float loose = B.g;
  float s = B.b;
  float zi = bedrock + loose;
  bool sea = zi < uSea;

  // 0. Hillslope creep of loose sediment (conservative pairwise exchange).
  if (uKappa > 0.0) {
    float net = 0.0;
    if (c.x > 0) net += creepFace(zi, B.g, c + ivec2(-1, 0));
    if (c.x < uSize.x - 1) net += creepFace(zi, B.g, c + ivec2(1, 0));
    if (c.y > 0) net += creepFace(zi, B.g, c + ivec2(0, -1));
    if (c.y < uSize.y - 1) net += creepFace(zi, B.g, c + ivec2(0, 1));
    loose = max(0.0, B.g - net);
  }

  // 1. Advection (upwind, same face discharges as the water).
  float inS = 0.0;
  if (c.x > 0) inS += outThrough(c + ivec2(-1, 0), 1);
  if (c.x < uSize.x - 1) inS += outThrough(c + ivec2(1, 0), 0);
  if (c.y > 0) inS += outThrough(c + ivec2(0, -1), 3);
  if (c.y < uSize.y - 1) inS += outThrough(c + ivec2(0, 1), 2);
  if (sea) {
    float settle = s + inS;
    loose += settle;
    sb.r += settle;
    oBed = vec4(bedrock, loose, 0.0, B.a);
    oSedA = sa;
    oSedB = sb;
    return;
  }
  float o0 = outThrough(c, 0), o1 = outThrough(c, 1), o2 = outThrough(c, 2), o3 = outThrough(c, 3);
  float edge = 0.0;
  if (c.x == 0) edge += o0;
  if (c.x == uSize.x - 1) edge += o1;
  if (c.y == 0) edge += o2;
  if (c.y == uSize.y - 1) edge += o3;
  sa.a += edge;
  s = max(0.0, s - (o0 + o1 + o2 + o3) + inS);

  // 2. Exchange with the bed.
  vec4 st = texelFetch(uState, c, 0);
  float d = st.r;
  if (d < ${MIN_TRANSPORT_DEPTH.toExponential()}) {
    loose += s;
    sa.b += s;
    s = 0.0;
  } else {
    ivec2 xl = ivec2(max(c.x - 1, 0), c.y), xr = ivec2(min(c.x + 1, uSize.x - 1), c.y);
    ivec2 yd = ivec2(c.x, max(c.y - 1, 0)), yu = ivec2(c.x, min(c.y + 1, uSize.y - 1));
    float sx = (zAt(xr) - zAt(xl)) / (float(xr.x - xl.x) * uCs);
    float sy = (zAt(yu) - zAt(yd)) / (float(yu.y - yd.y) * uCs);
    float S = clamp(length(vec2(sx, sy)), ${SLOPE_MIN.toExponential()}, ${SLOPE_MAX.toFixed(1)});
    float C = uCapK * d * length(st.gb) * S;
    if (s < C) {
      float demand = uKe * (C - s);
      float fromLoose = min(loose, demand);
      loose -= fromLoose;
      demand -= fromLoose;
      float fromRock = 0.0;
      if (demand > 0.0) {
        float nb = bedrock - demand * B.a * uRockF;
        fromRock = bedrock - nb; // exact float32 change actually applied
        bedrock = nb;
      }
      s += fromLoose + fromRock;
      sa.r += fromLoose;
      sa.g += fromRock;
    } else if (s > C) {
      float amt = uKd * (s - C);
      s -= amt;
      loose += amt;
      sa.b += amt;
    }
  }
  oBed = vec4(bedrock, loose, s, B.a);
  oSedA = sa;
  oSedB = sb;
}`;

interface Prog {
  p: WebGLProgram;
  u: Map<string, WebGLUniformLocation | null>;
}

type Pair = [WebGLTexture, WebGLTexture];

export class GpuWater implements Stepper {
  readonly kind = 'gpu';
  private gl: WebGL2RenderingContext;
  private bed: Pair;
  private state: Pair;
  private flux: Pair;
  private acc: Pair;
  private sedA: Pair;
  private sedB: Pair;
  private fbStateAcc: [WebGLFramebuffer, WebGLFramebuffer];
  private fbFlux: [WebGLFramebuffer, WebGLFramebuffer];
  private fbBed: [WebGLFramebuffer, WebGLFramebuffer];
  private vao: WebGLVertexArrayObject;
  private forcing: Prog;
  private fluxProg: Prog;
  private update: Prog;
  private sediment: Prog;
  private s = 0; // index of current state/acc
  private f = 0; // index of current flux
  private b = 0; // index of current bed/sedA/sedB
  private W: number;
  private H: number;
  /** Depth assumed when choosing dt between syncs (m); grows to observed max depth. */
  assumedDepthM = 4;
  disposed = false;

  static isSupported(gl: WebGL2RenderingContext): boolean {
    return !!gl.getExtension('EXT_color_buffer_float');
  }

  constructor(
    gl: WebGL2RenderingContext,
    private world: WorldState,
    private surface: Float32Array,
    private sim: WaterSim,
    private sed: SedimentSim | null = null,
  ) {
    if (!GpuWater.isSupported(gl)) throw new Error('EXT_color_buffer_float unavailable');
    this.gl = gl;
    this.W = world.width;
    this.H = world.height;
    const pair = (): Pair => [this.tex(), this.tex()];
    this.bed = pair();
    this.state = pair();
    this.flux = pair();
    this.acc = pair();
    this.sedA = pair();
    this.sedB = pair();
    this.fbStateAcc = [this.fb([this.state[0], this.acc[0]]), this.fb([this.state[1], this.acc[1]])];
    this.fbFlux = [this.fb([this.flux[0]]), this.fb([this.flux[1]])];
    this.fbBed = [this.fb([this.bed[0], this.sedA[0], this.sedB[0]]), this.fb([this.bed[1], this.sedA[1], this.sedB[1]])];
    this.vao = gl.createVertexArray()!;
    this.forcing = this.program(FORCING_FS);
    this.fluxProg = this.program(FLUX_FS);
    this.update = this.program(UPDATE_FS);
    this.sediment = this.program(SEDIMENT_FS);
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

  /** Upload bedrock, loose and suspended sediment, and lithology erodibility (after CPU edits). */
  uploadGround(): void {
    this.sim.refreshSea();
    const w = this.world;
    const n = this.W * this.H;
    const g = new Float32Array(n * 4);
    const erod = new Float32Array(256);
    for (const m of MATERIALS) erod[m.id] = m.erodibility;
    for (let i = 0; i < n; i++) {
      g[i * 4] = w.bedrockElevationM[i];
      g[i * 4 + 1] = w.looseSedimentThicknessM[i];
      g[i * 4 + 2] = w.sedimentSuspendedM[i];
      g[i * 4 + 3] = erod[w.materialId[i]];
    }
    this.write(this.bed[this.b], g);
    const zero = new Float32Array(n * 4);
    this.write(this.sedA[this.b], zero);
    this.write(this.sedB[this.b], zero);
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

  /**
   * Read GPU state back into the CPU mirror and fold accumulators into the ledgers.
   * Returns true if bed fields (terrain) were read back, i.e. the surface may have changed.
   */
  syncToCpu(): boolean {
    const n = this.W * this.H;
    const w = this.world;
    const A = w.cellSizeM * w.cellSizeM;
    const st = new Float32Array(n * 4);
    const ac = new Float32Array(n * 4);
    this.read(this.fbStateAcc[this.s], 0, st);
    this.read(this.fbStateAcc[this.s], 1, ac);
    this.read(this.fbFlux[this.f], 0, w.waterFluxM3PerS);
    const d = w.waterDepthM;
    let lost = 0;
    let rain = 0;
    let sea = 0;
    let edge = 0;
    for (let i = 0; i < n; i++) {
      const o = i * 4;
      d[i] = st[o];
      this.sim.vx[i] = st[o + 1];
      this.sim.vy[i] = st[o + 2];
      lost += ac[o];
      rain += ac[o + 1];
      sea += ac[o + 2];
      edge += ac[o + 3];
    }
    const L = this.sim.ledger;
    const lossRate = w.water.infiltrationMPerS + w.water.evaporationMPerS;
    const fInf = lossRate > 0 ? w.water.infiltrationMPerS / lossRate : 1;
    L.infiltrated += lost * A * fInf;
    L.evaporated += lost * A * (1 - fInf);
    L.rainIn += rain * A;
    L.seaOut += sea * A;
    L.edgeOut += edge * A;
    this.write(this.acc[this.s], new Float32Array(n * 4));

    let bedChanged = false;
    if (this.sed && w.erosion.enabled) {
      const bd = new Float32Array(n * 4);
      const sa = new Float32Array(n * 4);
      const sb = new Float32Array(n * 4);
      this.read(this.fbBed[this.b], 0, bd);
      this.read(this.fbBed[this.b], 1, sa);
      this.read(this.fbBed[this.b], 2, sb);
      let eL = 0;
      let eB = 0;
      let dep = 0;
      let exp = 0;
      let seaDep = 0;
      for (let i = 0; i < n; i++) {
        const o = i * 4;
        w.bedrockElevationM[i] = bd[o];
        w.looseSedimentThicknessM[i] = bd[o + 1];
        w.sedimentSuspendedM[i] = bd[o + 2];
        this.surface[i] = bd[o] + bd[o + 1];
        eL += sa[o];
        eB += sa[o + 1];
        dep += sa[o + 2];
        exp += sa[o + 3];
        seaDep += sb[o];
      }
      const SL = this.sed.ledger;
      SL.erodedLoose += eL * A;
      SL.erodedBedrock += eB * A;
      SL.deposited += dep * A;
      SL.edgeExport += exp * A;
      SL.seaDeposited += seaDep * A;
      const zero = new Float32Array(n * 4);
      this.write(this.sedA[this.b], zero);
      this.write(this.sedB[this.b], zero);
      this.sim.refreshSea();
      bedChanged = true;
    }
    this.sim.refreshStats();
    this.assumedDepthM = Math.max(4, this.sim.maxDepth * 1.25);
    return bedChanged;
  }

  /** Current water state texture (depth, vx, vy) for rendering. */
  get stateTexture(): WebGLTexture {
    return this.state[this.s];
  }

  /** Current bed texture (bedrock, loose, suspended, erodibility) for rendering. */
  get bedTexture(): WebGLTexture {
    return this.bed[this.b];
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
    // Sources are ledgered on the CPU (rain is measured on the GPU, see acc.g).
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

    const bed = this.bed[this.b];
    const common = (pr: Prog) => {
      gl.useProgram(pr.p);
      gl.uniform2i(this.uni(pr, 'uSize'), this.W, this.H);
      gl.uniform1f(this.uni(pr, 'uDt'), dt);
      gl.uniform1f(this.uni(pr, 'uCs'), w.cellSizeM);
      gl.uniform1f(this.uni(pr, 'uSea'), w.seaLevelM);
      this.bindTex(pr, 'uBed', 0, bed);
    };

    // 1. forcing: state[s], acc[s] → state[1-s], acc[1-s]
    const s0 = this.s;
    const s1 = 1 - s0;
    common(this.forcing);
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
    this.bindTex(this.fluxProg, 'uState', 1, this.state[s1]);
    this.bindTex(this.fluxProg, 'uFlux', 2, this.flux[f0]);
    gl.uniform1f(this.uni(this.fluxProg, 'uManning2'), p.manningN * p.manningN);
    gl.uniform1i(this.uni(this.fluxProg, 'uOpen'), p.boundary === 'open' ? 1 : 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbFlux[f1]);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // 3. update: state[1-s], flux[1-f], acc[1-s] → state[s], acc[s]
    common(this.update);
    this.bindTex(this.update, 'uState', 1, this.state[s1]);
    this.bindTex(this.update, 'uFlux', 2, this.flux[f1]);
    this.bindTex(this.update, 'uAcc', 3, this.acc[s1]);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbStateAcc[s0]);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    this.f = f1;

    // 4. sediment: bed[b], sedA/B[b] + prev/new state + flux → bed[1-b], sedA/B[1-b]
    const e = w.erosion;
    if (this.sed && e.enabled) {
      const b0 = this.b;
      const b1 = 1 - b0;
      common(this.sediment);
      this.bindTex(this.sediment, 'uPrev', 1, this.state[s1]);
      this.bindTex(this.sediment, 'uState', 2, this.state[s0]);
      this.bindTex(this.sediment, 'uFlux', 3, this.flux[f1]);
      this.bindTex(this.sediment, 'uSedA', 4, this.sedA[b0]);
      this.bindTex(this.sediment, 'uSedB', 5, this.sedB[b0]);
      gl.uniform1f(this.uni(this.sediment, 'uCapK'), e.capacityK);
      gl.uniform1f(this.uni(this.sediment, 'uKe'), Math.min(1, e.erodeK * e.speedup * dt));
      gl.uniform1f(this.uni(this.sediment, 'uKd'), Math.min(1, e.depositK * e.speedup * dt));
      gl.uniform1f(this.uni(this.sediment, 'uRockF'), e.bedrockFactor);
      gl.uniform1f(this.uni(this.sediment, 'uKappa'), SedimentSim.creepKappa(w, dt));
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbBed[b1]);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      this.b = b1;
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindVertexArray(null);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    const gl = this.gl;
    for (const t of [...this.bed, ...this.state, ...this.flux, ...this.acc, ...this.sedA, ...this.sedB]) gl.deleteTexture(t);
    for (const fb of [...this.fbStateAcc, ...this.fbFlux, ...this.fbBed]) gl.deleteFramebuffer(fb);
    for (const pr of [this.forcing, this.fluxProg, this.update, this.sediment]) gl.deleteProgram(pr.p);
    gl.deleteVertexArray(this.vao);
  }
}
