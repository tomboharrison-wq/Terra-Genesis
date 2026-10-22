import { computeSurface, type WorldState } from './world';
import type { HeightfieldView } from '../terrain/heightfield';
import { sampleBilinear } from '../terrain/heightfield';
import { applyBrush, type BrushParams } from '../tools/brush';
import { History, StrokeRecorder } from '../tools/history';
import { unionRect, type CellRect } from '../utils/rect';
import { WaterSim } from '../sim/water/waterSim';
import { GpuWater } from '../sim/water/gpuWater';
import { SimClock, type Stepper } from './clock';
import type { WaterParams, WaterSource } from './world';

export type EngineEvent =
  | { type: 'world-replaced' }
  | { type: 'terrain-changed'; rect: CellRect }
  | { type: 'history-changed' }
  | { type: 'water-params-changed' }
  | { type: 'sim-state-changed' };

/**
 * Owns the authoritative WorldState, its derived surface cache, edit history and dirty
 * regions. UI and renderer communicate with the world only through this object.
 */
export class Engine {
  world!: WorldState;
  surface!: Float32Array;
  readonly history = new History();
  private dirty: CellRect | null = null;
  private listeners = new Set<(e: EngineEvent) => void>();
  private stroke: { rec: StrokeRecorder; params: BrushParams } | null = null;
  /** CPU water solver: tested reference, fallback backend, ledger and stats owner. */
  water!: WaterSim;
  /** Optional GPU backend (attached by the renderer when WebGL2 float targets exist). */
  gpu: GpuWater | null = null;
  private gpuContext: WebGL2RenderingContext | null = null;
  readonly clock = new SimClock(10);
  /** Increments whenever water state on the CPU mirror or GPU changes (renderer polls it). */
  waterRevision = 0;
  private groundDirty = false;
  private syncTimer = 0;
  /** Real seconds between GPU→CPU syncs while running (inspector, stats, ledger). */
  syncInterval = 0.25;

  constructor(world: WorldState) {
    this.setWorld(world);
  }

  private setWorld(world: WorldState) {
    this.world = world;
    this.surface = new Float32Array(world.width * world.height);
    computeSurface(world, this.surface);
    this.dirty = null;
    this.water = new WaterSim(world, this.surface);
    this.clock.playing = false;
    this.clock.reset();
    this.groundDirty = false;
    if (this.gpuContext) this.attachGpu(this.gpuContext);
    this.waterRevision++;
  }

  // ---------- water backend ----------

  get stepper(): Stepper {
    return this.gpu ?? this.water;
  }

  get backend(): 'gpu' | 'cpu' {
    return this.gpu ? 'gpu' : 'cpu';
  }

  /** Attach a GPU backend on the given context; returns false (CPU fallback) if unsupported. */
  attachGpu(gl: WebGL2RenderingContext): boolean {
    this.detachGpu();
    this.gpuContext = gl;
    try {
      if (!GpuWater.isSupported(gl)) return false;
      this.gpu = new GpuWater(gl, this.world, this.surface, this.water);
      return true;
    } catch (err) {
      console.warn('GPU water unavailable, using CPU', err);
      this.gpu = null;
      return false;
    }
  }

  /** Sync GPU state to the CPU mirror and drop the GPU backend (e.g. renderer disposal). */
  detachGpu(): void {
    if (this.gpu) {
      if (!this.gpu.disposed) this.gpu.syncToCpu();
      this.gpu.dispose();
    }
    this.gpu = null;
    this.gpuContext = null;
  }

  /** Make the CPU mirror current (before save, inspect, CPU-side water edits). */
  syncWater(): void {
    if (this.gpu) this.gpu.syncToCpu();
  }

  /** Advance simulation by one real frame. Returns simulated seconds advanced. */
  tick(realDt: number): number {
    this.flushGround();
    const done = this.clock.tick(this.stepper, realDt);
    if (done > 0) {
      this.world.simTimeSeconds += done;
      this.waterRevision++;
      if (this.gpu) {
        this.syncTimer += realDt;
        if (this.syncTimer >= this.syncInterval) {
          this.syncTimer = 0;
          this.gpu.syncToCpu();
        }
      }
    }
    return done;
  }

  /** Advance exactly `seconds` of simulated time (Step button / tests), ignoring budget. */
  advance(seconds: number): number {
    this.flushGround();
    const done = this.clock.advanceExactly(this.stepper, seconds);
    this.world.simTimeSeconds += done;
    this.syncWater();
    this.waterRevision++;
    return done;
  }

  private flushGround() {
    if (!this.groundDirty) return;
    this.groundDirty = false;
    if (this.gpu) this.gpu.uploadGround();
    else this.water.refreshSea();
  }

  setPlaying(playing: boolean): void {
    this.clock.playing = playing;
    if (!playing) this.syncWater();
    this.emit({ type: 'sim-state-changed' });
  }

  setSpeed(simSecondsPerSecond: number): void {
    this.clock.speed = simSecondsPerSecond;
    this.emit({ type: 'sim-state-changed' });
  }

  setWaterParams(p: Partial<WaterParams>): void {
    Object.assign(this.world.water, p);
    if (p.boundary !== undefined) this.groundDirty = true;
    this.emit({ type: 'water-params-changed' });
  }

  /** CPU-side water edit wrapped in GPU sync/upload. */
  private editWater<T>(fn: () => T): T {
    this.syncWater();
    const r = fn();
    if (this.gpu) this.gpu.uploadWater();
    this.waterRevision++;
    return r;
  }

  /** Add (depth > 0) or remove (depth < 0) water in a disc around world (xM, yM). Returns m³. */
  addWater(xM: number, yM: number, radiusM: number, depthM: number): number {
    const cs = this.world.cellSizeM;
    return this.editWater(() => this.water.addWaterDisc(xM / cs, yM / cs, radiusM / cs, depthM));
  }

  clearWater(): void {
    this.editWater(() => this.water.clearWater());
  }

  addSource(xM: number, yM: number, rateM3PerS: number): WaterSource {
    const w = this.world;
    const id = w.water.sources.reduce((m, s) => Math.max(m, s.id), 0) + 1;
    const src: WaterSource = {
      id,
      x: Math.min(w.width - 1, Math.max(0, Math.round(xM / w.cellSizeM))),
      y: Math.min(w.height - 1, Math.max(0, Math.round(yM / w.cellSizeM))),
      rateM3PerS,
    };
    w.water.sources.push(src);
    this.emit({ type: 'water-params-changed' });
    return src;
  }

  removeSource(id: number): void {
    this.world.water.sources = this.world.water.sources.filter((s) => s.id !== id);
    this.emit({ type: 'water-params-changed' });
  }

  on(fn: (e: EngineEvent) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(e: EngineEvent) {
    for (const fn of this.listeners) fn(e);
  }

  get heightfield(): HeightfieldView {
    const w = this.world;
    return { width: w.width, height: w.height, cellSizeM: w.cellSizeM, z: this.surface };
  }

  replaceWorld(world: WorldState): void {
    this.stroke = null;
    const gl = this.gpuContext;
    this.detachGpu();
    this.gpuContext = gl;
    this.setWorld(world);
    this.history.clear();
    this.emit({ type: 'world-replaced' });
    this.emit({ type: 'history-changed' });
    this.emit({ type: 'sim-state-changed' });
  }

  sampleSurface(xM: number, yM: number): number {
    return sampleBilinear(this.heightfield, xM, yM);
  }

  get strokeActive(): boolean {
    return this.stroke !== null;
  }

  beginStroke(params: BrushParams, xM: number, yM: number, label: string = params.kind): void {
    const p = { ...params };
    if (p.kind === 'flatten' && p.targetM === undefined) p.targetM = this.sampleSurface(xM, yM);
    this.stroke = { rec: new StrokeRecorder(this.world, label), params: p };
  }

  /** Apply the active stroke at (xM, yM) for dt seconds of brush time. */
  strokeStep(xM: number, yM: number, dt: number): void {
    if (!this.stroke) return;
    const rect = applyBrush(this.world, this.surface, xM, yM, this.stroke.params, dt, this.stroke.rec.capture);
    if (rect) this.markDirty(rect);
  }

  endStroke(): void {
    if (!this.stroke) return;
    const cmd = this.stroke.rec.finish();
    this.stroke = null;
    if (cmd) {
      this.history.push(cmd);
      this.emit({ type: 'history-changed' });
    }
  }

  undo(): void {
    if (this.stroke) this.endStroke();
    const r = this.history.undo(this.world);
    if (r) this.afterBulkEdit(r);
  }

  redo(): void {
    if (this.stroke) this.endStroke();
    const r = this.history.redo(this.world);
    if (r) this.afterBulkEdit(r);
  }

  private afterBulkEdit(r: CellRect) {
    computeSurface(this.world, this.surface, r);
    this.markDirty(r);
    this.emit({ type: 'history-changed' });
  }

  markDirty(rect: CellRect): void {
    this.dirty = unionRect(this.dirty, rect);
    this.groundDirty = true;
    this.emit({ type: 'terrain-changed', rect });
  }

  /** Renderer takes and clears accumulated dirty region once per frame. */
  takeDirty(): CellRect | null {
    const d = this.dirty;
    this.dirty = null;
    return d;
  }
}
