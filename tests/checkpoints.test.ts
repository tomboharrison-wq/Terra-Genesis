import { describe, expect, it } from 'vitest';
import { createWorld, setUniformStrata, MM_PER_H } from '../src/engine/world';
import { Engine } from '../src/engine/engine';
import { diffSummary, MAX_CHECKPOINTS } from '../src/engine/checkpoints';
import { OVERLAYS, overlayById, prepareOverlay } from '../src/renderer/overlays';

function engine() {
  const w = createWorld({ width: 40, height: 30, cellSizeM: 10, seed: 3, seaLevelM: -100 });
  for (let y = 0; y < 30; y++) for (let x = 0; x < 40; x++) w.bedrockElevationM[y * 40 + x] = 60 - x + 3 * Math.abs(y - 15);
  w.looseSedimentThicknessM.fill(0.5);
  setUniformStrata(w);
  w.vegCover.fill(0.3);
  return new Engine(w);
}

const FIELDS = [
  'bedrockElevationM',
  'looseSedimentThicknessM',
  'waterDepthM',
  'waterFluxM3PerS',
  'sedimentSuspendedM',
  'strataBoundsM',
  'strataMaterial',
  'vegCover',
  'tephraM',
  'lavaDepthM',
] as const;

describe('M09-C03 checkpoints', () => {
  it('restoring a checkpoint gives back exactly the world it copied (time included)', { timeout: 60000 }, () => {
    const e = engine();
    e.setWaterParams({ rainMPerS: 30 * MM_PER_H });
    e.setErosionParams({ enabled: true, speedup: 200 });
    e.advance(1200);
    const cp = e.takeCheckpoint('after first rain');
    const snap = Object.fromEntries(FIELDS.map((f) => [f, Array.from(e.world[f] as ArrayLike<number>)]));
    const t0 = e.world.simTimeSeconds;
    // Change everything: more rain + erosion, a landslide, plants.
    e.advance(1800);
    e.landslide(200, 150, 60);
    e.world.vegCover.fill(0.9);
    expect(Array.from(e.world.bedrockElevationM)).not.toEqual(snap.bedrockElevationM);
    // The checkpoint itself was not touched by those changes (deep copy).
    expect(Array.from(cp.world.bedrockElevationM)).toEqual(snap.bedrockElevationM);
    expect(e.restoreCheckpoint(cp.id)).toBe(true);
    for (const f of FIELDS) expect(Array.from(e.world[f] as ArrayLike<number>)).toEqual(snap[f]);
    expect(e.world.simTimeSeconds).toBe(t0);
    expect(e.world.erosion.speedup).toBe(200);
    // And the world keeps running from there.
    e.advance(600);
    expect(e.world.simTimeSeconds).toBeGreaterThan(t0);
  });

  it('the difference summary equals the sums of cell differences', () => {
    const e = engine();
    const cp = e.takeCheckpoint('before');
    // Lower one block by 2 m, raise another by 0.5 m, add water and remove plants.
    for (let i = 0; i < 100; i++) e.world.bedrockElevationM[i] -= 2;
    for (let i = 500; i < 560; i++) e.world.bedrockElevationM[i] += 0.5;
    for (let i = 0; i < e.surface.length; i++) e.surface[i] = e.world.bedrockElevationM[i] + e.world.looseSedimentThicknessM[i];
    e.world.waterDepthM.fill(0.1, 700, 750);
    e.world.vegCover.fill(0, 0, 200);
    const s = diffSummary(cp, e.world, e.surface);
    expect(s.loweredM3).toBeCloseTo(100 * 100 * 2, 2);
    expect(s.raisedM3).toBeCloseTo(60 * 100 * 0.5, 2);
    expect(s.changedAreaM2).toBe(160 * 100);
    expect(s.maxLoweringM).toBeCloseTo(2, 4);
    expect(s.maxRaisingM).toBeCloseTo(0.5, 4);
    expect(s.waterChangeM3).toBeCloseTo(50 * 100 * 0.1, 3);
    expect(s.plantAreaChangeM2).toBeCloseTo(-200 * 100 * 0.3, 2);
    // Ground-change overlay reads the same numbers.
    e.compareWith(cp.id);
    expect(OVERLAYS.filter((o) => o.available(e)).map((o) => o.id)).toEqual(expect.arrayContaining(['cp-ground', 'cp-water', 'cp-plants']));
    const d = prepareOverlay('cp-ground', e);
    expect(overlayById('cp-ground')!.describe(e, 5, d)).toBe('−2.0 m since “before”');
    expect(overlayById('cp-ground')!.describe(e, 300, d)).toMatch(/^no change/);
  });

  it('only checkpoints of the same world can be compared; the list is capped; deleting ends a comparison', () => {
    const e = engine();
    const a = e.takeCheckpoint('A');
    e.compareWith(a.id);
    expect(e.compareCheckpoint?.id).toBe(a.id);
    // A different world (new creation) cannot be compared with A, but A can still be restored.
    const other = createWorld({ width: 40, height: 30, cellSizeM: 10, seed: 9, meta: { createdAtIso: '2001-01-01T00:00:00Z' } });
    e.replaceWorld(other);
    expect(e.compareCheckpoint).toBeNull();
    e.compareWith(a.id);
    expect(e.compareCheckpoint).toBeNull();
    e.restoreCheckpoint(a.id);
    e.compareWith(a.id);
    expect(e.compareCheckpoint?.id).toBe(a.id);
    for (let k = 0; k < MAX_CHECKPOINTS + 2; k++) e.takeCheckpoint(`#${k}`);
    expect(e.checkpoints.length).toBe(MAX_CHECKPOINTS);
    expect(e.checkpoints.some((c) => c.id === a.id)).toBe(false); // oldest dropped …
    expect(e.compareCheckpoint).toBeNull(); // … and its comparison with it
    const b = e.checkpoints[0];
    e.compareWith(b.id);
    e.deleteCheckpoint(b.id);
    expect(e.compareCheckpoint).toBeNull();
    expect(OVERLAYS.find((o) => o.id === 'cp-ground')!.available(e)).toBe(false);
  });
});
