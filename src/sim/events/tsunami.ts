import type { WorldState } from '../../engine/world';

const G = 9.81;

export type TsunamiEdge = 'west' | 'east' | 'south' | 'north';

export interface TsunamiParams {
  /** Initial free-surface displacement at the source edge (m). */
  amplitudeM: number;
  /** Edge from which the long wave enters the map. */
  sourceEdge: TsunamiEdge;
  /** Width of the initial Gaussian pulse along the propagation axis (cells). */
  sourceWidthCells: number;
  /** Linear energy damping coefficient (s⁻¹). */
  dampingPerS: number;
}

/**
 * Depth-averaged, linear shallow-water wave field for a tsunami / long-wave event.
 *
 * `eta` is free-surface displacement above the normal sea level. The bathymetry is the
 * actual heightfield, so the wave slows in shallow water and can run up onto land when
 * eta + sea level rises above the ground. This is intentionally a reference CPU process:
 * it is coupled to the normal water solver through the measured land run-up volume, and
 * never rendered as a decorative animation.
 */
export class TsunamiSim {
  readonly eta: Float64Array;
  readonly runup: Float64Array;
  private nextEta: Float64Array;
  private prevEta: Float64Array;
  private params: TsunamiParams | null = null;

  constructor(
    private readonly world: WorldState,
    private readonly surface: Float32Array,
  ) {
    const n = world.width * world.height;
    this.eta = new Float64Array(n);
    this.runup = new Float64Array(n);
    this.nextEta = new Float64Array(n);
    this.prevEta = new Float64Array(n);
  }

  get active() {
    return this.params !== null;
  }

  /** CFL limit for the fastest full-depth wave on the current map. */
  stableDt(): number {
    let hMax = 0;
    for (let i = 0; i < this.surface.length; i++) hMax = Math.max(hMax, this.world.seaLevelM + this.eta[i] - this.surface[i]);
    const c = Math.sqrt(G * Math.max(hMax, 0.01));
    return Math.min(2, Math.max(0.01, (0.35 * this.world.cellSizeM) / c));
  }

  start(params: TsunamiParams): void {
    this.eta.fill(0);
    this.runup.fill(0);
    this.params = {
      amplitudeM: Math.max(0, params.amplitudeM),
      sourceEdge: params.sourceEdge,
      sourceWidthCells: Math.max(1, params.sourceWidthCells),
      dampingPerS: Math.max(0, params.dampingPerS),
    };
    const { width: W, height: H, seaLevelM: sl } = this.world;
    const p = this.params;
    const widthM = p.sourceWidthCells * this.world.cellSizeM;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (this.surface[i] >= sl) continue;
        const edgeDistance = p.sourceEdge === 'west' ? x : p.sourceEdge === 'east' ? W - 1 - x : p.sourceEdge === 'south' ? y : H - 1 - y;
        const cross = p.sourceEdge === 'west' || p.sourceEdge === 'east' ? y : x;
        const along = Math.min(cross, (p.sourceEdge === 'west' || p.sourceEdge === 'east' ? H - 1 : W - 1) - cross);
        const pulse = Math.exp(-(((edgeDistance * this.world.cellSizeM) / widthM) ** 2)) * Math.exp(-(((along * this.world.cellSizeM) / (widthM * 2)) ** 2));
        this.eta[i] = p.amplitudeM * pulse;
      }
    }
    // Zero initial velocity: the first step is a symmetric long-wave pulse.
    this.prevEta.set(this.eta);
  }

  stop(): void {
    this.params = null;
    this.eta.fill(0);
    this.runup.fill(0);
    this.nextEta.fill(0);
    this.prevEta.fill(0);
  }

  /** Advance one stable linear shallow-water step (the long-wave equation). */
  step(dt: number): void {
    const p = this.params;
    if (!p || dt <= 0) return;
    const W = this.world.width;
    const H = this.world.height;
    const cs = this.world.cellSizeM;
    const sl = this.world.seaLevelM;
    const eta = this.eta;
    const damping = Math.exp(-p.dampingPerS * dt);
    const waterDepth = (i: number) => Math.max(0, sl + eta[i] - this.surface[i]);
    const at = (x: number, y: number, fallback: number) => (x < 0 || y < 0 || x >= W || y >= H ? fallback : eta[y * W + x]);

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        let h = waterDepth(i);
        if (h <= 1e-6) {
          const neighbourWet =
            (x > 0 && waterDepth(i - 1) > 1e-6) ||
            (x + 1 < W && waterDepth(i + 1) > 1e-6) ||
            (y > 0 && waterDepth(i - W) > 1e-6) ||
            (y + 1 < H && waterDepth(i + W) > 1e-6);
          if (neighbourWet) h = Math.max(0.1, this.world.cellSizeM * 0.01);
        }
        if (h <= 1e-6) {
          this.nextEta[i] = this.surface[i] - sl;
          continue;
        }
        const lap = (at(x + 1, y, eta[i]) + at(x - 1, y, eta[i]) + at(x, y + 1, eta[i]) + at(x, y - 1, eta[i]) - 4 * eta[i]) / (cs * cs);
        const floorEta = this.surface[i] - sl;
        this.nextEta[i] = Math.max(floorEta, (2 * eta[i] - this.prevEta[i] + G * h * dt * dt * lap) * damping);
      }
    }

    this.prevEta.set(eta);
    this.eta.set(this.nextEta);
  }

  /** Land water-equivalent depth currently produced by the wave field. */
  runupDepth(i: number): number {
    if (this.surface[i] < this.world.seaLevelM) return 0;
    return Math.max(0, this.world.seaLevelM + this.eta[i] - this.surface[i]);
  }

  maxElevationM(): number {
    let m = 0;
    for (const v of this.eta) if (v > m) m = v;
    return m;
  }

  /** Total water volume represented by the free-surface field, including sea and run-up. */
  volumeM3(): number {
    const A = this.world.cellSizeM * this.world.cellSizeM;
    let v = 0;
    for (let i = 0; i < this.surface.length; i++) v += Math.max(0, this.world.seaLevelM + this.eta[i] - this.surface[i]);
    return v * A;
  }
}
