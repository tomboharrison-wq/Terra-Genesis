import { computeSurface, type WorldState } from './world';
import type { HeightfieldView } from '../terrain/heightfield';
import { sampleBilinear } from '../terrain/heightfield';
import { applyBrush, type BrushParams } from '../tools/brush';
import { History, StrokeRecorder } from '../tools/history';
import { unionRect, type CellRect } from '../utils/rect';

export type EngineEvent =
  | { type: 'world-replaced' }
  | { type: 'terrain-changed'; rect: CellRect }
  | { type: 'history-changed' };

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

  constructor(world: WorldState) {
    this.setWorld(world);
  }

  private setWorld(world: WorldState) {
    this.world = world;
    this.surface = new Float32Array(world.width * world.height);
    computeSurface(world, this.surface);
    this.dirty = null;
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
    this.setWorld(world);
    this.history.clear();
    this.emit({ type: 'world-replaced' });
    this.emit({ type: 'history-changed' });
  }

  sampleSurface(xM: number, yM: number): number {
    return sampleBilinear(this.heightfield, xM, yM);
  }

  get strokeActive(): boolean {
    return this.stroke !== null;
  }

  beginStroke(params: BrushParams, xM: number, yM: number, label = params.kind): void {
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
    this.emit({ type: 'terrain-changed', rect });
  }

  /** Renderer takes and clears accumulated dirty region once per frame. */
  takeDirty(): CellRect | null {
    const d = this.dirty;
    this.dirty = null;
    return d;
  }
}
