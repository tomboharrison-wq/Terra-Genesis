import { beforeAll, describe, expect, it } from 'vitest';
import { ArchModel, BED_Z, defaultArchParams, NX, NY, NZ, STAGE_ORDER, type Stage } from '../src/local/arch/model';

/** Run the default headland to the stump stage, keeping a copy of the voxels at each new stage. */
function runToStump(seed = 7) {
  const m = new ArchModel({ ...defaultArchParams(), seed });
  const snaps = new Map<Stage, { solid: Uint8Array; step: number }>();
  let last: Stage = 'headland';
  for (let k = 0; k < 1500 && m.currentStage !== 'stump' && m.currentStage !== 'gone'; k++) {
    m.advance();
    if (m.currentStage !== last) {
      last = m.currentStage;
      snaps.set(last, { solid: m.solid.slice(), step: m.step });
    }
    expect(m.initialVoxels - m.count()).toBe(m.erodedVoxels + m.collapsedVoxels);
  }
  return { m, snaps };
}

/** Water flood through the headland (west side → east side) below zTop, inside rows y0 … y1. */
function passage(s: Uint8Array, x0: number, x1: number, y0: number, y1: number, zTop: number): boolean {
  const seen = new Set<number>();
  const q: [number, number, number][] = [];
  for (let y = y0; y <= y1; y++) for (let z = BED_Z; z <= zTop; z++) if (!at(s, x0 - 1, y, z)) q.push([x0 - 1, y, z]);
  for (let k = 0; k < q.length; k++) {
    const [x, y, z] = q[k];
    if (x >= x1) return true;
    for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
      const [a, b, c] = [x + dx, y + dy, z + dz];
      if (a < x0 - 1 || a > x1 || b < y0 || b > y1 || c < BED_Z || c > zTop || at(s, a, b, c)) continue;
      const key = (c * NY + b) * NX + a;
      if (seen.has(key)) continue;
      seen.add(key);
      q.push([a, b, c]);
    }
  }
  return false;
}

/** Above-high-water rock reachable from the mainland edge (y = 0) through rock above zW. */
function mainlandAbove(s: Uint8Array, zW: number): Uint8Array {
  const comp = new Uint8Array(s.length);
  const q: number[] = [];
  for (let z = zW + 1; z < NZ; z++) for (let x = 0; x < NX; x++) if (at(s, x, 0, z)) q.push((z * NY) * NX + x);
  for (const i of q) comp[i] = 1;
  for (let k = 0; k < q.length; k++) {
    const i = q[k];
    const z = Math.floor(i / (NX * NY));
    const y = Math.floor((i % (NX * NY)) / NX);
    const x = i % NX;
    for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
      const [a, b, c] = [x + dx, y + dy, z + dz];
      if (c <= zW || !at(s, a, b, c)) continue;
      const j = (c * NY + b) * NX + a;
      if (!comp[j]) {
        comp[j] = 1;
        q.push(j);
      }
    }
  }
  return comp;
}

const at = (s: Uint8Array, x: number, y: number, z: number) => x >= 0 && y >= 0 && z >= 0 && x < NX && y < NY && z < NZ && s[(z * NY + y) * NX + x] === 1;

describe('guided cave → arch → stack → stump model (M05-C05)', () => {
  let run: ReturnType<typeof runToStump>;
  beforeAll(() => {
    run = runToStump();
  }, 120000);

  it('passes through every stage in order', () => {
    const seq = run.m.stageHistory.map((h) => h.stage);
    expect(seq).toEqual(['headland', 'cave', 'arch', 'stack', 'stump']);
    const steps = run.m.stageHistory.map((h) => h.step);
    for (let i = 1; i < steps.length; i++) expect(steps[i]).toBeGreaterThan(steps[i - 1]);
  });

  it('arch: sea passes right through the headland under a rock roof', () => {
    const { solid } = run.snaps.get('arch')!;
    const p = run.m.p;
    // Water can pass from the west side to the east side of the headland, inland of its tip.
    expect(passage(solid, p.headX0, p.headX1, 11, p.headY - 3, p.seaLevel + 2)).toBe(true);
    // …while all the rock above high water is still one piece with the mainland (the roof stands).
    const main = mainlandAbove(solid, p.seaLevel + 2);
    let seawardHigh = 0;
    for (let i = 0; i < solid.length; i++) if (solid[i] && Math.floor(i / (NX * NY)) > p.seaLevel + 2 && !main[i]) seawardHigh++;
    expect(seawardHigh).toBe(0);
  });

  it('stack: a free-standing pillar above high water, cut off from the mainland', () => {
    const { solid } = run.snaps.get('stack')!;
    const p = run.m.p;
    let top = 0;
    for (let z = p.seaLevel + 3; z < NZ; z++) for (let y = p.jointY + 2; y < NY; y++) for (let x = 0; x < NX; x++) if (at(solid, x, y, z)) top = Math.max(top, z);
    expect(top).toBeGreaterThan(p.seaLevel + 2);
    // The roof has gone: rock above high water exists that is not joined to the mainland above water.
    const main = mainlandAbove(solid, p.seaLevel + 2);
    let isolated = 0;
    for (let i = 0; i < solid.length; i++) if (solid[i] && Math.floor(i / (NX * NY)) > p.seaLevel + 2 && !main[i]) isolated++;
    expect(isolated).toBeGreaterThan(20);
  });

  it('stump: what remains seaward is below high water but still on the seabed', () => {
    const { solid } = run.snaps.get('stump')!;
    const p = run.m.p;
    let maxZ = 0;
    let n = 0;
    for (let z = BED_Z; z < NZ; z++)
      for (let y = p.jointY + 1; y < NY; y++)
        for (let x = p.headX0 - 2; x < p.headX1 + 2; x++)
          if (at(solid, x, y, z)) {
            n++;
            maxZ = Math.max(maxZ, z);
          }
    expect(n).toBeGreaterThan(0);
    expect(maxZ).toBeLessThanOrEqual(p.seaLevel + 2);
  });

  it('is deterministic and robust to the variability seed', () => {
    const again = runToStump();
    expect(again.m.stageHistory).toEqual(run.m.stageHistory);
    const other = runToStump(11);
    expect(other.m.stageHistory.map((h) => h.stage)).toEqual(['headland', 'cave', 'arch', 'stack', 'stump']);
    expect(STAGE_ORDER.indexOf('stump')).toBeGreaterThan(STAGE_ORDER.indexOf('stack'));
  }, 120000);

  it('reset restores the intact headland', () => {
    const m = new ArchModel();
    for (let k = 0; k < 20; k++) m.advance();
    m.reset();
    expect(m.count()).toBe(m.initialVoxels);
    expect(m.currentStage).toBe('headland');
    expect(m.step).toBe(0);
  });
});
