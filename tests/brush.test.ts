import { describe, expect, it } from 'vitest';
import { createWorld, computeSurface, validateWorld } from '../src/engine/world';
import { Engine } from '../src/engine/engine';
import { applySurfaceDelta, brushWeight, type BrushParams } from '../src/tools/brush';
import { generateWorld, defaultOptions } from '../src/terrain/generate';

function flatEngine(size = 41, cs = 10, sed = 2) {
  const w = createWorld({ width: size, height: size, cellSizeM: cs, seed: 1 });
  w.bedrockElevationM.fill(100);
  w.looseSedimentThicknessM.fill(sed);
  return new Engine(w);
}

const centre = (e: Engine) => ((e.world.width - 1) * e.world.cellSizeM) / 2;
const idxC = (e: Engine) => ((e.world.height - 1) / 2) * e.world.width + (e.world.width - 1) / 2;

function stroke(e: Engine, p: BrushParams, seconds: number, steps: number) {
  const c = centre(e);
  e.beginStroke(p, c, c);
  for (let k = 0; k < steps; k++) e.strokeStep(c, c, seconds / steps);
  e.endStroke();
}

describe('brush primitives', () => {
  it('weight falls from 1 at centre to 0 at radius', () => {
    expect(brushWeight(0, 0)).toBeCloseTo(1);
    expect(brushWeight(1, 0)).toBe(0);
    expect(brushWeight(0.5, 0)).toBeCloseTo(0.5);
    expect(brushWeight(0.4, 0.5)).toBe(1);
  });

  it('losses remove sediment before bedrock; gains add bedrock', () => {
    const w = createWorld({ width: 2, height: 2, cellSizeM: 1, seed: 0 });
    w.bedrockElevationM[0] = 10;
    w.looseSedimentThicknessM[0] = 1;
    applySurfaceDelta(w, 0, -0.4);
    expect(w.looseSedimentThicknessM[0]).toBeCloseTo(0.6);
    expect(w.bedrockElevationM[0]).toBe(10);
    applySurfaceDelta(w, 0, -1);
    expect(w.looseSedimentThicknessM[0]).toBe(0);
    expect(w.bedrockElevationM[0]).toBeCloseTo(9.6);
    applySurfaceDelta(w, 0, 2);
    expect(w.bedrockElevationM[0]).toBeCloseTo(11.6);
    expect(w.looseSedimentThicknessM[0]).toBe(0);
  });
});

describe('sculpt tools via Engine', () => {
  it('raise adds rate × time at centre, nothing outside radius', () => {
    const e = flatEngine();
    stroke(e, { kind: 'raise', radiusM: 100, rate: 5, hardness: 0 }, 2, 10);
    expect(e.surface[idxC(e)]).toBeCloseTo(102 + 10, 3);
    expect(e.surface[0]).toBe(102);
    expect(validateWorld(e.world)).toEqual([]);
  });

  it('result is frame-rate independent (same total time, different step counts)', () => {
    const a = flatEngine();
    const b = flatEngine();
    stroke(a, { kind: 'raise', radiusM: 120, rate: 3, hardness: 0.2 }, 1, 4);
    stroke(b, { kind: 'raise', radiusM: 120, rate: 3, hardness: 0.2 }, 1, 60);
    for (let i = 0; i < a.surface.length; i++) expect(a.surface[i]).toBeCloseTo(b.surface[i], 3);
  });

  it('lower strips sediment first and never makes sediment negative', () => {
    const e = flatEngine();
    stroke(e, { kind: 'lower', radiusM: 100, rate: 3, hardness: 0 }, 1, 5);
    const i = idxC(e);
    expect(e.world.looseSedimentThicknessM[i]).toBe(0);
    expect(e.world.bedrockElevationM[i]).toBeCloseTo(99, 3);
    expect(validateWorld(e.world)).toEqual([]);
  });

  it('smooth reduces local relief', () => {
    const e = flatEngine();
    stroke(e, { kind: 'raise', radiusM: 40, rate: 20, hardness: 0.8 }, 1, 5);
    const peak0 = e.surface[idxC(e)];
    stroke(e, { kind: 'smooth', radiusM: 150, rate: 4, hardness: 0 }, 2, 40);
    expect(e.surface[idxC(e)]).toBeLessThan(peak0 - 2);
  });

  it('flatten converges to elevation sampled at stroke start', () => {
    const w = generateWorld(defaultOptions('mountain-range', 3, 64));
    const e = new Engine(w);
    const c = centre(e);
    const target = e.sampleSurface(c, c);
    e.beginStroke({ kind: 'flatten', radiusM: 200, rate: 8, hardness: 0.9 }, c, c);
    for (let k = 0; k < 120; k++) e.strokeStep(c, c, 1 / 30);
    e.endStroke();
    expect(e.surface[(e.world.height >> 1) * e.world.width + (e.world.width >> 1)]).toBeCloseTo(target, 0);
  });

  it('paint changes bedrock material only inside brush', () => {
    const e = flatEngine();
    stroke(e, { kind: 'paint', radiusM: 60, rate: 1, hardness: 0.5, materialId: 5 }, 0.1, 1);
    expect(e.world.materialId[idxC(e)]).toBe(5);
    expect(e.world.materialId[0]).toBe(0);
    expect(e.surface[idxC(e)]).toBe(102);
  });

  it('sediment brushes edit sediment only and clip at zero', () => {
    const e = flatEngine();
    stroke(e, { kind: 'add-sediment', radiusM: 60, rate: 1, hardness: 1 }, 1, 3);
    expect(e.world.looseSedimentThicknessM[idxC(e)]).toBeCloseTo(3, 4);
    expect(e.world.bedrockElevationM[idxC(e)]).toBe(100);
    stroke(e, { kind: 'remove-sediment', radiusM: 60, rate: 10, hardness: 1 }, 1, 3);
    expect(e.world.looseSedimentThicknessM[idxC(e)]).toBe(0);
  });
});

describe('undo / redo', () => {
  it('a whole stroke is one command; undo restores exactly, redo reapplies exactly', () => {
    const e = new Engine(generateWorld(defaultOptions('island', 11, 64)));
    const b0 = e.world.bedrockElevationM.slice();
    const s0 = e.world.looseSedimentThicknessM.slice();
    stroke(e, { kind: 'lower', radiusM: 200, rate: 10, hardness: 0.3 }, 1, 20);
    const b1 = e.world.bedrockElevationM.slice();
    expect(e.history.canUndo).toBe(true);
    e.undo();
    expect(e.world.bedrockElevationM).toEqual(b0);
    expect(e.world.looseSedimentThicknessM).toEqual(s0);
    const surf = new Float32Array(e.surface.length);
    computeSurface(e.world, surf);
    expect(e.surface).toEqual(surf);
    expect(e.history.canUndo).toBe(false);
    e.redo();
    expect(e.world.bedrockElevationM).toEqual(b1);
  });

  it('new edit clears redo; no-op strokes are not recorded', () => {
    const e = flatEngine();
    stroke(e, { kind: 'raise', radiusM: 50, rate: 1, hardness: 0 }, 1, 2);
    e.undo();
    expect(e.history.canRedo).toBe(true);
    stroke(e, { kind: 'raise', radiusM: 50, rate: 1, hardness: 0 }, 1, 2);
    expect(e.history.canRedo).toBe(false);
    const before = e.history.undoLabel;
    stroke(e, { kind: 'paint', radiusM: 50, rate: 1, hardness: 1, materialId: 0 }, 1, 1); // already 0
    expect(e.history.undoLabel).toBe(before);
  });

  it('marks dirty regions covering the brush', () => {
    const e = flatEngine();
    e.takeDirty();
    stroke(e, { kind: 'raise', radiusM: 50, rate: 1, hardness: 0 }, 1, 2);
    const d = e.takeDirty()!;
    expect(d.x0).toBeLessThanOrEqual(15);
    expect(d.x1).toBeGreaterThanOrEqual(26);
    expect(e.takeDirty()).toBeNull();
  });
});
