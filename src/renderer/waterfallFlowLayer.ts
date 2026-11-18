import { BufferAttribute, BufferGeometry, DoubleSide, Group, Mesh, ShaderMaterial } from 'three';
import { FALL_NX, FALL_CHANNEL_Y0, FALL_CHANNEL_Y1, waterfallMetrics, type SolidWaterfall } from '../sim/river/solidWaterfall';

/** Quasi-steady river surface over the current solid. Jet follows v*t, z - g*t²/2. */
export class WaterfallFlowLayer {
  readonly group = new Group();
  private geometry = new BufferGeometry();
  private material = new ShaderMaterial({ transparent: true, side: DoubleSide, depthWrite: true,
    uniforms: { time: { value: 0 }, speed: { value: 1 } },
    vertexShader: `varying vec2 vFlow; attribute vec2 flow; void main(){ vFlow=flow; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `varying vec2 vFlow; uniform float time; uniform float speed;
      void main(){ float ripple=.5+.5*sin(vFlow.x*8.-time*speed*7.+sin(vFlow.y*9.)*.6);
      float streak=smoothstep(.8,1.,ripple); vec3 water=mix(vec3(.08,.42,.58),vec3(.82,.95,1.),max(vFlow.y,streak*.35)); gl_FragColor=vec4(water,.87); }` });
  private mesh = new Mesh(this.geometry, this.material);
  private last?: SolidWaterfall;
  private lastStep = -1;
  private lastQ = -1;

  constructor() { this.group.add(this.mesh); this.mesh.renderOrder = 3; }

  update(s: SolidWaterfall | undefined, time: number): void {
    this.group.visible = !!s && s.dischargeM3PerS > 0;
    this.material.uniforms.time.value = time;
    if (!s || (s === this.last && s.step === this.lastStep && s.dischargeM3PerS === this.lastQ)) return;
    this.last = s; this.lastStep = s.step; this.lastQ = s.dischargeM3PerS;
    const f = waterfallMetrics(s), width = FALL_CHANNEL_Y1 - FALL_CHANNEL_Y0;
    // Manning normal-depth estimate for the incoming reach (n=.035, slope=.001).
    const depth = Math.max(0.03, Math.pow(s.dischargeM3PerS / width * 0.035 / Math.sqrt(0.001), 0.6));
    const velocity = s.dischargeM3PerS / (width * depth);
    this.material.uniforms.speed.value = velocity;
    const points: [number, number, number][] = [];
    const lipX = f.lip + 0.8, lipZ = 32 + depth;
    for (let x = 0; x < lipX; x++) points.push([x, lipZ, 0]);
    points.push([lipX, lipZ, 0]);
    const poolLevel = 12 + depth;
    const flight = Math.sqrt(2 * Math.max(0, lipZ - poolLevel) / 9.81);
    for (let k = 1; k <= 24; k++) {
      const t = flight * k / 24;
      points.push([lipX + velocity * t, lipZ - 4.905 * t * t, 0.65]);
    }
    const landing = points[points.length - 1][0];
    for (let x = Math.ceil(landing); x <= FALL_NX; x++) points.push([x, poolLevel, 0]);
    const p: number[] = [], flow: number[] = [], index: number[] = [];
    let distance = 0;
    for (let k = 0; k < points.length; k++) {
      const [x, z, foam] = points[k];
      if (k) distance += Math.hypot(x - points[k - 1][0], z - points[k - 1][1]);
      for (const y of [FALL_CHANNEL_Y0 + 0.05, FALL_CHANNEL_Y1 - 0.05]) { p.push(x, z + 0.03, -y); flow.push(distance, foam); }
      if (k) { const a = (k - 1) * 2; index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    this.geometry.dispose();
    this.geometry = new BufferGeometry();
    this.geometry.setAttribute('position', new BufferAttribute(Float32Array.from(p), 3));
    this.geometry.setAttribute('flow', new BufferAttribute(Float32Array.from(flow), 2));
    this.geometry.setIndex(index);
    this.mesh.geometry = this.geometry;
  }

  dispose(): void { this.geometry.dispose(); this.material.dispose(); }
}
