import { refreshExposed, STRATA_BOUNDS, STRATA_LAYERS, type WorldState } from '../engine/world';
import type { CellRect } from '../utils/rect';
import { unionRect } from '../utils/rect';

/**
 * One undoable edit: sparse per-cell before/after values of the physical fields.
 * `material` holds the STRATA_LAYERS strata lithologies of each cell (exposed lithology is derived)
 * and `bounds` its STRATA_BOUNDS layer boundaries (moved by uplift and earthquakes); `tephra` the ash share
 * of the loose sediment (volcano builds).
 */
interface CellValues {
  bedrock: Float32Array;
  sediment: Float32Array;
  material: Uint8Array;
  bounds: Float32Array;
  tephra: Float32Array;
}
export interface EditCommand {
  label: string;
  indices: Int32Array;
  before: CellValues;
  after: CellValues;
  rect: CellRect;
}

/** Lazily records original values of every cell touched during a stroke. */
export class StrokeRecorder {
  private touched: Uint8Array;
  private idx: number[] = [];
  private b: number[] = [];
  private s: number[] = [];
  private m: number[] = [];
  private bd: number[] = [];
  private t: number[] = [];
  private rect: CellRect | null = null;

  constructor(private world: WorldState, readonly label: string) {
    this.touched = new Uint8Array(world.width * world.height);
  }

  capture = (r: CellRect): void => {
    const w = this.world;
    for (let y = r.y0; y < r.y1; y++) {
      for (let x = r.x0; x < r.x1; x++) {
        const i = y * w.width + x;
        if (this.touched[i]) continue;
        this.touched[i] = 1;
        this.idx.push(i);
        this.b.push(w.bedrockElevationM[i]);
        this.s.push(w.looseSedimentThicknessM[i]);
        this.t.push(w.tephraM[i]);
        for (let k = 0; k < STRATA_LAYERS; k++) this.m.push(w.strataMaterial[i * STRATA_LAYERS + k]);
        for (let k = 0; k < STRATA_BOUNDS; k++) this.bd.push(w.strataBoundsM[i * STRATA_BOUNDS + k]);
      }
    }
    this.rect = unionRect(this.rect, r);
  };

  /** Build the command, dropping cells whose values did not change. Null if no change. */
  finish(): EditCommand | null {
    const w = this.world;
    const keep: number[] = [];
    for (let k = 0; k < this.idx.length; k++) {
      const i = this.idx[k];
      let strataChanged = false;
      for (let l = 0; l < STRATA_LAYERS; l++) if (w.strataMaterial[i * STRATA_LAYERS + l] !== this.m[k * STRATA_LAYERS + l]) strataChanged = true;
      for (let l = 0; l < STRATA_BOUNDS; l++) if (w.strataBoundsM[i * STRATA_BOUNDS + l] !== Math.fround(this.bd[k * STRATA_BOUNDS + l])) strataChanged = true;
      if (w.bedrockElevationM[i] !== Math.fround(this.b[k]) || w.looseSedimentThicknessM[i] !== Math.fround(this.s[k]) || w.tephraM[i] !== Math.fround(this.t[k]) || strataChanged) keep.push(k);
    }
    if (!keep.length || !this.rect) return null;
    const n = keep.length;
    const cmd: EditCommand = {
      label: this.label,
      indices: new Int32Array(n),
      before: { bedrock: new Float32Array(n), sediment: new Float32Array(n), material: new Uint8Array(n * STRATA_LAYERS), bounds: new Float32Array(n * STRATA_BOUNDS), tephra: new Float32Array(n) },
      after: { bedrock: new Float32Array(n), sediment: new Float32Array(n), material: new Uint8Array(n * STRATA_LAYERS), bounds: new Float32Array(n * STRATA_BOUNDS), tephra: new Float32Array(n) },
      rect: this.rect,
    };
    keep.forEach((k, j) => {
      const i = this.idx[k];
      cmd.indices[j] = i;
      cmd.before.bedrock[j] = this.b[k];
      cmd.before.sediment[j] = this.s[k];
      cmd.before.tephra[j] = this.t[k];
      cmd.after.tephra[j] = w.tephraM[i];
      for (let l = 0; l < STRATA_LAYERS; l++) cmd.before.material[j * STRATA_LAYERS + l] = this.m[k * STRATA_LAYERS + l];
      for (let l = 0; l < STRATA_BOUNDS; l++) cmd.before.bounds[j * STRATA_BOUNDS + l] = this.bd[k * STRATA_BOUNDS + l];
      for (let l = 0; l < STRATA_BOUNDS; l++) cmd.after.bounds[j * STRATA_BOUNDS + l] = w.strataBoundsM[i * STRATA_BOUNDS + l];
      cmd.after.bedrock[j] = w.bedrockElevationM[i];
      cmd.after.sediment[j] = w.looseSedimentThicknessM[i];
      for (let l = 0; l < STRATA_LAYERS; l++) cmd.after.material[j * STRATA_LAYERS + l] = w.strataMaterial[i * STRATA_LAYERS + l];
    });
    return cmd;
  }
}

function applyValues(w: WorldState, cmd: EditCommand, which: 'before' | 'after'): void {
  const v = cmd[which];
  for (let j = 0; j < cmd.indices.length; j++) {
    const i = cmd.indices[j];
    w.bedrockElevationM[i] = v.bedrock[j];
    w.looseSedimentThicknessM[i] = v.sediment[j];
    w.tephraM[i] = v.tephra[j];
    for (let l = 0; l < STRATA_LAYERS; l++) w.strataMaterial[i * STRATA_LAYERS + l] = v.material[j * STRATA_LAYERS + l];
    for (let l = 0; l < STRATA_BOUNDS; l++) w.strataBoundsM[i * STRATA_BOUNDS + l] = v.bounds[j * STRATA_BOUNDS + l];
    refreshExposed(w, i);
  }
}

export class History {
  private undoStack: EditCommand[] = [];
  private redoStack: EditCommand[] = [];

  constructor(readonly limit = 64) {}

  push(cmd: EditCommand): void {
    this.undoStack.push(cmd);
    if (this.undoStack.length > this.limit) this.undoStack.shift();
    this.redoStack.length = 0;
  }

  get canUndo() {
    return this.undoStack.length > 0;
  }
  get canRedo() {
    return this.redoStack.length > 0;
  }
  get undoLabel() {
    return this.undoStack.at(-1)?.label;
  }
  get redoLabel() {
    return this.redoStack.at(-1)?.label;
  }

  undo(w: WorldState): CellRect | null {
    const cmd = this.undoStack.pop();
    if (!cmd) return null;
    applyValues(w, cmd, 'before');
    this.redoStack.push(cmd);
    return cmd.rect;
  }

  redo(w: WorldState): CellRect | null {
    const cmd = this.redoStack.pop();
    if (!cmd) return null;
    applyValues(w, cmd, 'after');
    this.undoStack.push(cmd);
    return cmd.rect;
  }

  clear(): void {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
  }
}
