import type { WorldState } from '../engine/world';
import type { CellRect } from '../utils/rect';
import { unionRect } from '../utils/rect';

/** One undoable edit: sparse per-cell before/after values of the physical fields. */
export interface EditCommand {
  label: string;
  indices: Int32Array;
  before: { bedrock: Float32Array; sediment: Float32Array; material: Uint8Array };
  after: { bedrock: Float32Array; sediment: Float32Array; material: Uint8Array };
  rect: CellRect;
}

/** Lazily records original values of every cell touched during a stroke. */
export class StrokeRecorder {
  private touched: Uint8Array;
  private idx: number[] = [];
  private b: number[] = [];
  private s: number[] = [];
  private m: number[] = [];
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
        this.m.push(w.materialId[i]);
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
      if (
        w.bedrockElevationM[i] !== Math.fround(this.b[k]) ||
        w.looseSedimentThicknessM[i] !== Math.fround(this.s[k]) ||
        w.materialId[i] !== this.m[k]
      )
        keep.push(k);
    }
    if (!keep.length || !this.rect) return null;
    const n = keep.length;
    const cmd: EditCommand = {
      label: this.label,
      indices: new Int32Array(n),
      before: { bedrock: new Float32Array(n), sediment: new Float32Array(n), material: new Uint8Array(n) },
      after: { bedrock: new Float32Array(n), sediment: new Float32Array(n), material: new Uint8Array(n) },
      rect: this.rect,
    };
    keep.forEach((k, j) => {
      const i = this.idx[k];
      cmd.indices[j] = i;
      cmd.before.bedrock[j] = this.b[k];
      cmd.before.sediment[j] = this.s[k];
      cmd.before.material[j] = this.m[k];
      cmd.after.bedrock[j] = w.bedrockElevationM[i];
      cmd.after.sediment[j] = w.looseSedimentThicknessM[i];
      cmd.after.material[j] = w.materialId[i];
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
    w.materialId[i] = v.material[j];
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
