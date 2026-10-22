import { Color, DoubleSide, ShaderMaterial, BackSide, type Texture, type MeshStandardMaterial } from 'three';

export interface StrataUniforms {
  uMatCol: { value: Color[] };
  uStrataOn: { value: number };
  uLineW: { value: number };
}

export function createStrataUniforms(colours: Color[]): StrataUniforms {
  return { uMatCol: { value: colours }, uStrataOn: { value: 1 }, uLineW: { value: 0.5 } };
}

/**
 * Terrain albedo detail: world-space value noise, plus true stratigraphy on steep faces — each
 * fragment is coloured by the lithology at its own elevation in the cell's strata column
 * (attributes strataB / strataM), with thin dark lines at layer boundaries.
 */
export function addTerrainDetail(mat: MeshStandardMaterial, scaleM: number, strata: StrataUniforms): void {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uDetailScale = { value: 1 / scaleM };
    Object.assign(shader.uniforms, strata);
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vTgWorld;
varying float vTgNormalY;
attribute vec3 strataB;
attribute vec4 strataM;
flat varying vec3 vTgStrataB;
flat varying vec4 vTgStrataM;`,
      )
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
vTgWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
vTgNormalY = normalize(mat3(modelMatrix) * objectNormal).y;
vTgStrataB = strataB;
vTgStrataM = strataM;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vTgWorld;
varying float vTgNormalY;
flat varying vec3 vTgStrataB;
flat varying vec4 vTgStrataM;
uniform float uDetailScale;
uniform vec3 uMatCol[8];
uniform float uStrataOn;
uniform float uLineW;
float tgHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float tgNoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(tgHash(i), tgHash(i + vec2(1, 0)), u.x), mix(tgHash(i + vec2(0, 1)), tgHash(i + vec2(1, 1)), u.x), u.y);
}`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
{
  vec2 q = vTgWorld.xz * uDetailScale;
  float n = tgNoise(q) * 0.5 + tgNoise(q * 3.7) * 0.3 + tgNoise(q * 13.1) * 0.2;
  diffuseColor.rgb *= 0.9 + 0.2 * n;
  float steep = (1.0 - smoothstep(0.5, 0.82, vTgNormalY)) * uStrataOn;
  if (steep > 0.0) {
    float y = vTgWorld.y;
    float m = vTgStrataM.x;
    if (y < vTgStrataB.x) { m = vTgStrataM.y; if (y < vTgStrataB.y) { m = vTgStrataM.z; if (y < vTgStrataB.z) m = vTgStrataM.w; } }
    vec3 rock = uMatCol[int(m + 0.5)] * (0.82 + 0.2 * n);
    diffuseColor.rgb = mix(diffuseColor.rgb, rock, steep * 0.85);
    float dl = min(abs(y - vTgStrataB.x), min(abs(y - vTgStrataB.y), abs(y - vTgStrataB.z)));
    diffuseColor.rgb *= 1.0 - 0.35 * steep * (1.0 - smoothstep(0.0, uLineW, dl));
  }
}`,
      );
  };
}

export interface SeaUniforms {
  [k: string]: { value: unknown };
}

/**
 * Sea-level surface. Colour/opacity from depth = seaLevel - terrain (sampled from a
 * half-float heightmap texture), so shorelines follow the real terrain. Ripples are
 * cosmetic normal perturbation only — this is NOT a hydrology or wave simulation.
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
      uShallow: { value: new Color(0x3fa7a8) },
      uDeep: { value: new Color(0x0d3a66) },
      uFogColor: { value: new Color(0xbcd3e6) },
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
void main() {
  // three.x = east, three.z = -north
  vec2 uv = vec2(vWorld.x / uWorldSize.x, -vWorld.z / uWorldSize.y);
  float ground = texture2D(uHeight, clamp(uv, 0.0, 1.0)).r;
  float depth = uSeaLevel - ground;
  if (depth <= 0.0) discard;
  float d = smoothstep(0.0, uDeepDepth, depth);
  vec3 col = mix(uShallow, uDeep, d);
  float alpha = mix(0.25, 0.94, smoothstep(0.0, uDeepDepth * 0.25, depth));
  // Cosmetic ripple normal.
  vec2 p = vWorld.xz * 0.02;
  float e = 0.6;
  float a = vn(p + uTime * 0.05) + 0.5 * vn(p * 2.3 - uTime * 0.07);
  float bx = vn(p + vec2(e, 0.0) + uTime * 0.05) + 0.5 * vn((p + vec2(e, 0.0)) * 2.3 - uTime * 0.07);
  float bz = vn(p + vec2(0.0, e) + uTime * 0.05) + 0.5 * vn((p + vec2(0.0, e)) * 2.3 - uTime * 0.07);
  vec3 n = normalize(vec3((a - bx) * 0.25, 1.0, (a - bz) * 0.25));
  vec3 v = normalize(cameraPosition - vWorld);
  vec3 l = normalize(uSunDir);
  float diff = 0.55 + 0.45 * max(dot(n, l), 0.0);
  float spec = pow(max(dot(reflect(-l, n), v), 0.0), 120.0) * 0.8;
  float fres = pow(1.0 - max(dot(n, v), 0.0), 4.0);
  col = col * diff + vec3(spec) + fres * vec3(0.55, 0.68, 0.8) * 0.35;
  float shore = 1.0 - smoothstep(0.0, 0.6, depth);
  col = mix(col, vec3(0.92, 0.95, 0.96), shore * 0.35);
  float fogF = smoothstep(uFogNear, uFogFar, length(cameraPosition - vWorld));
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
      uZenith: { value: new Color(0x4f86c0) },
      uGround: { value: new Color(0xb9c6cf) },
    },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 uHorizon, uZenith, uGround; varying vec3 vDir;
void main(){ float y = vDir.y; vec3 c = y > 0.0 ? mix(uHorizon, uZenith, pow(y, 0.6)) : mix(uHorizon, uGround, min(1.0, -y * 4.0));
gl_FragColor = vec4(c, 1.0);
#include <colorspace_fragment>
}`,
  });
}
