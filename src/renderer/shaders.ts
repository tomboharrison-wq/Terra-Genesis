import { Color, DoubleSide, ShaderMaterial, BackSide, type Texture, type MeshStandardMaterial } from 'three';

export interface StrataUniforms {
  uMatCol: { value: Color[] };
  uStrataOn: { value: number };
  uLineW: { value: number };
  uDetailScale: { value: number };
  uSeaLevel: { value: number };
  uSunDir: { value: [number, number, number] };
}

export function createStrataUniforms(colours: Color[]): StrataUniforms {
  return {
    uMatCol: { value: colours },
    uStrataOn: { value: 1 },
    uLineW: { value: 0.5 },
    uDetailScale: { value: 1 / 30 },
    uSeaLevel: { value: 0 },
    uSunDir: { value: [0.5, 0.7, 0.3] },
  };
}

/**
 * Terrain PBR shader upgrade (Terra Firma 2 style):
 * - Triplanar procedural rock & soil micro-detail (eliminates vertical cliff UV stretching)
 * - Analytical fragment normal perturbation (craggy exposed bedrock, granular soil/sand, smooth ice)
 * - Smooth noise-warped stratigraphy (eliminates flat-varying triangle sawtooth teeth on cliffs)
 * - Per-material roughness & wet-shoreline specular darkening
 * - Molten lava temperature emission
 */
export function addTerrainDetail(mat: MeshStandardMaterial, scaleM: number, strata: StrataUniforms): void {
  strata.uDetailScale.value = 1 / scaleM;
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, strata);
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vTgWorld;
varying vec3 vTgWorldNormal;
varying float vTgNormalY;
attribute vec3 strataB;
attribute vec4 strataM;
attribute float lavaGlow;
varying float vTgGlow;
varying vec3 vTgStrataB;
flat varying vec4 vTgStrataM;`,
      )
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
vTgWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
vTgWorldNormal = normalize(mat3(modelMatrix) * objectNormal);
vTgNormalY = vTgWorldNormal.y;
// Clamp sentinel -1e9 layer bounds to a continuous basal plane so smooth interpolation never spikes
float baseFloor = transformed.y - 2000.0;
vTgStrataB = vec3(
  strataB.x < -1e6 ? baseFloor : strataB.x,
  strataB.y < -1e6 ? baseFloor : strataB.y,
  strataB.z < -1e6 ? baseFloor : strataB.z
);
vTgStrataM = strataM;
vTgGlow = lavaGlow;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vTgWorld;
varying vec3 vTgWorldNormal;
varying float vTgNormalY;
varying vec3 vTgStrataB;
flat varying vec4 vTgStrataM;
varying float vTgGlow;
uniform float uDetailScale;
uniform float uSeaLevel;
uniform vec3 uMatCol[8];
uniform float uStrataOn;
uniform float uLineW;
float tgHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float tgNoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(tgHash(i), tgHash(i + vec2(1, 0)), u.x), mix(tgHash(i + vec2(0, 1)), hash2: tgHash(i + vec2(1, 1)), u.x), u.y);
}
float tgFbm(vec2 p) {
  return tgNoise(p) * 0.52 + tgNoise(p * 2.7 + vec2(17.3, 9.1)) * 0.30 + tgNoise(p * 7.9 - vec2(5.4, 21.8)) * 0.18;
}`,
      )
      .replace('hash2: tgHash(i + vec2(1, 1))', 'tgHash(i + vec2(1, 1))')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
float tgSteep = (1.0 - smoothstep(0.48, 0.84, vTgNormalY)) * uStrataOn;
float tgIsIce = (vTgStrataM.x > 200.0 && vTgGlow < 0.01) ? 1.0 : 0.0;
{
  // Triplanar weights so steep cliffs get crisp horizontal bedding + vertical fracture detail
  vec3 tw = pow(abs(normalize(vTgWorldNormal)), vec3(4.0));
  tw /= max(tw.x + tw.y + tw.z, 1e-4);
  vec2 qXZ = vTgWorld.xz * uDetailScale;
  vec2 qXY = vec2(vTgWorld.x * uDetailScale, vTgWorld.y * uDetailScale * 2.2);
  vec2 qZY = vec2(vTgWorld.z * uDetailScale, vTgWorld.y * uDetailScale * 2.2);
  float nTop = tgFbm(qXZ);
  float nSide = tgFbm(qXY) * tw.z + tgFbm(qZY) * tw.x;
  float n = nTop * tw.y + nSide;
  diffuseColor.rgb *= 0.88 + 0.24 * n;

  // Subtle noise-warped stratigraphy on steep faces
  float warp = (tgNoise(vTgWorld.xz * (uDetailScale * 0.35)) - 0.5) * uLineW * 3.5;
  float steepMask = clamp(tgSteep + (n - 0.5) * 0.18 * tgSteep, 0.0, 1.0);
  if (steepMask > 0.01 && vTgStrataM.x < 200.0) {
    float y = vTgWorld.y + warp;
    float m = vTgStrataM.x;
    if (y < vTgStrataB.x) { m = vTgStrataM.y; if (y < vTgStrataB.y) { m = vTgStrataM.z; if (y < vTgStrataB.z) m = vTgStrataM.w; } }
    float bedStriation = 0.88 + 0.22 * tgNoise(vec2(vTgWorld.y * uDetailScale * 4.5, (vTgWorld.x + vTgWorld.z) * uDetailScale * 0.5));
    vec3 rock = uMatCol[ clamp(int(m + 0.5), 0, 7) ] * (0.82 + 0.22 * n) * bedStriation;
    diffuseColor.rgb = mix(diffuseColor.rgb, rock, steepMask * 0.88);
    float dl = min(abs(y - vTgStrataB.x), min(abs(y - vTgStrataB.y), abs(y - vTgStrataB.z)));
    diffuseColor.rgb *= 1.0 - 0.38 * steepMask * (1.0 - smoothstep(0.0, uLineW * 1.2, dl));
  }

  // Wet shoreline darkening just above sea level
  float aboveSea = vTgWorld.y - uSeaLevel;
  if (uStrataOn > 0.5 && aboveSea >= -0.2 && aboveSea < 1.1 && tgIsIce < 0.5 && vTgGlow < 0.01) {
    float wet = 1.0 - smoothstep(-0.1, 1.1, aboveSea);
    diffuseColor.rgb *= 1.0 - 0.22 * wet;
  }
}`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
{
  float aboveSea = vTgWorld.y - uSeaLevel;
  float wetShore = (uStrataOn > 0.5 && aboveSea >= -0.2 && aboveSea < 1.1) ? (1.0 - smoothstep(-0.1, 1.1, aboveSea)) : 0.0;
  roughnessFactor = mix(0.91, 0.84, tgSteep);
  roughnessFactor = mix(roughnessFactor, 0.28, tgIsIce);
  roughnessFactor = mix(roughnessFactor, 0.24, wetShore * (1.0 - tgIsIce));
}`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
{
  vec2 p = vTgWorld.xz * (uDetailScale * 2.2);
  float eps = 0.08;
  float h0 = tgFbm(p);
  float hx = tgFbm(p + vec2(eps, 0.0)) - h0;
  float hz = tgFbm(p + vec2(0.0, eps)) - h0;
  // Add vertical fracture / bedding micro-normal on steep cliffs
  float hy = (tgNoise(vec2(vTgWorld.y * uDetailScale * 3.5, vTgWorld.x * uDetailScale)) - 0.5) * tgSteep;
  float bumpStrength = mix(0.14, 0.36, tgSteep) * (1.0 - 0.6 * tgIsIce);
  vec3 dN = vec3(-hx / eps, hy * 0.4, -hz / eps) * bumpStrength;
  normal = normalize(normal + mat3(viewMatrix) * dN);
}`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
totalEmissiveRadiance += vec3(1.0, 0.38, 0.08) * vTgGlow * 1.6; // molten lava glows by temperature`,
      );
  };
}

export interface SeaUniforms {
  [k: string]: { value: unknown };
}

/**
 * Sea-level surface with Beer-Lambert depth absorption, shallow seabed caustics,
 * multi-octave capillary wave normals, Schlick Fresnel sky reflection, and soft shoreline foam.
 */
export function createSeaMaterial(heightTex: Texture): ShaderMaterial {
  return new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    uniforms: {
      uHeight: { value: heightTex },
      uWorldSize: { value: [1, 1] },
      uSeaLevel: { value: 0 },
      uDeepDepth: { value: 40 },
      uTime: { value: 0 },
      uSunDir: { value: [0.5, 0.7, 0.3] },
      uShallow: { value: new Color(0x3eb8b0) },
      uDeep: { value: new Color(0x092f54) },
      uFogColor: { value: new Color(0xc8dce9) },
      uFogNear: { value: 1000 },
      uFogFar: { value: 10000 },
    },
    vertexShader: `
varying vec3 vWorld;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`,
    fragmentShader: `
uniform sampler2D uHeight;
uniform vec2 uWorldSize;
uniform float uSeaLevel, uDeepDepth, uTime, uFogNear, uFogFar;
uniform vec3 uSunDir, uShallow, uDeep, uFogColor;
varying vec3 vWorld;
float h2(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 15731.7); }
float vn(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f);
  return mix(mix(h2(i),h2(i+vec2(1,0)),u.x),mix(h2(i+vec2(0,1)),h2(i+vec2(1,1)),u.x),u.y); }
float waveH(vec2 p, float t) {
  return vn(p + vec2(t * 0.06, -t * 0.04)) * 0.55
       + vn(p * 2.4 - vec2(t * 0.08, t * 0.05)) * 0.30
       + vn(p * 5.7 + vec2(-t * 0.11, t * 0.09)) * 0.15;
}
void main() {
  vec2 uv = vec2(vWorld.x / uWorldSize.x, -vWorld.z / uWorldSize.y);
  float ground = texture2D(uHeight, clamp(uv, 0.0, 1.0)).r;
  float depth = uSeaLevel - ground;
  if (depth <= 0.0) discard;

  // Beer-Lambert exponential absorption across R, G, B channels
  float normD = clamp(depth / max(uDeepDepth, 1.0), 0.0, 2.5);
  vec3 transmittance = exp(-vec3(2.6, 0.85, 0.32) * normD);
  vec3 col = mix(uDeep, uShallow, transmittance);

  // Shallow underwater caustics
  if (depth < uDeepDepth * 0.45) {
    vec2 cp = vWorld.xz * 0.045;
    float c1 = vn(cp + vec2(uTime * 0.18, uTime * 0.12));
    float c2 = vn(cp * 1.7 - vec2(uTime * 0.15, -uTime * 0.19));
    float caustics = smoothstep(0.58, 0.88, c1 * c2 * 2.1);
    float cFade = (1.0 - smoothstep(0.0, uDeepDepth * 0.45, depth)) * smoothstep(0.0, 0.35, depth);
    col += vec3(0.18, 0.26, 0.24) * caustics * cFade;
  }

  // Multi-octave wave normal perturbation
  vec2 p = vWorld.xz * 0.018;
  float e = 0.45;
  float h0 = waveH(p, uTime);
  float hx = waveH(p + vec2(e, 0.0), uTime) - h0;
  float hz = waveH(p + vec2(0.0, e), uTime) - h0;
  vec3 n = normalize(vec3(-hx * 0.42, 1.0, -hz * 0.42));

  vec3 v = normalize(cameraPosition - vWorld);
  vec3 l = normalize(uSunDir);
  vec3 hVec = normalize(l + v);
  float diff = 0.58 + 0.42 * max(dot(n, l), 0.0);
  float spec = pow(max(dot(n, hVec), 0.0), 180.0) * 1.15;
  float fres = 0.02 + 0.98 * pow(1.0 - max(dot(n, v), 0.0), 5.0);
  vec3 skyRefl = mix(vec3(0.45, 0.65, 0.85), vec3(0.82, 0.90, 0.96), pow(1.0 - max(n.y, 0.0), 2.0));
  col = mix(col * diff, skyRefl, fres * 0.48) + vec3(1.0, 0.97, 0.90) * spec;

  // Gentle animated shoreline foam & feathered edge
  float swash = vn(vWorld.xz * 0.05 + vec2(uTime * 0.15, 0.0));
  float shore = (1.0 - smoothstep(0.0, 0.85 + 0.35 * swash, depth));
  col = mix(col, vec3(0.93, 0.96, 0.98), shore * 0.42);
  float alpha = smoothstep(0.0, 0.18, depth) * mix(0.38, 0.95, smoothstep(0.0, uDeepDepth * 0.22, depth));

  float dist = length(cameraPosition - vWorld);
  float fogF = smoothstep(uFogNear, uFogFar, dist);
  col = mix(col, uFogColor, fogF);
  gl_FragColor = vec4(col, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`,
  });
}

export function createSkyMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    side: BackSide,
    toneMapped: false,
    fog: false,
    depthWrite: false,
    uniforms: {
      uHorizon: { value: new Color(0xd2e2ee) },
      uZenith: { value: new Color(0x3d73ad) },
      uGround: { value: new Color(0xb9c6cf) },
      uSunDir: { value: [0.5, 0.7, 0.3] },
    },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 uHorizon, uZenith, uGround, uSunDir; varying vec3 vDir;
void main(){
  vec3 d = normalize(vDir);
  vec3 l = normalize(uSunDir);
  float y = d.y;
  vec3 c = y > 0.0 ? mix(uHorizon, uZenith, pow(y, 0.55)) : mix(uHorizon, uGround, min(1.0, -y * 4.0));
  // Mie solar aureole + soft sun disc
  float mu = max(dot(d, l), 0.0);
  c += vec3(1.0, 0.88, 0.68) * (0.18 * pow(mu, 8.0) + 0.45 * smoothstep(0.9985, 0.9998, mu));
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}`,
  });
}
