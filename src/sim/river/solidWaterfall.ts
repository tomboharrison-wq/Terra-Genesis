import { createWorld, setUniformStrata, type WorldState } from '../../engine/world';

export const FALL_NX = 96, FALL_NY = 40, FALL_NZ = 40;
export const FALL_CHANNEL_Y0 = 16, FALL_CHANNEL_Y1 = 24, FALL_CAP_BASE = 26;
const INITIAL_LIP = 47, INITIAL_TOP = 32, BANK_TOP = 34, FLOOR = 4;
const at = (x: number, z: number) => z * FALL_NX + x;

/** Numerical longitudinal rock section, extruded over an eight-metre channel in the world. */
export interface SolidWaterfall {
  solid: number[];
  damage: number[];
  step: number;
  remainderYears: number;
  dischargeM3PerS: number;
  maxSpanM: number;
  weakErosionMYr: number;
  hardFactor: number;
  initialRockM3: number;
  erodedM3: number;
  collapsedM3: number;
  exportedM3: number;
}

interface Working { solid: Uint8Array; damage: Float32Array }
const cache = new WeakMap<SolidWaterfall, Working>();
export function waterfallRock(s: SolidWaterfall): Working {
  let b = cache.get(s);
  if (!b) { b = { solid: Uint8Array.from(s.solid), damage: Float32Array.from(s.damage) }; cache.set(s, b); }
  return b;
}

export function waterfallSolid(s: SolidWaterfall, x: number, y: number, z: number): boolean {
  if (x < 0 || y < 0 || z < 0 || x >= FALL_NX || y >= FALL_NY || z >= FALL_NZ) return false;
  if (y < FALL_CHANNEL_Y0 || y >= FALL_CHANNEL_Y1) return z < (x <= INITIAL_LIP ? BANK_TOP : 12);
  return waterfallRock(s).solid[at(x, z)] === 1;
}

export function waterfallProfile(s: SolidWaterfall): Float32Array {
  const b = waterfallRock(s).solid;
  const top = new Float32Array(FALL_NX);
  for (let x = 0; x < FALL_NX; x++) for (let z = FALL_NZ - 1; z >= 0; z--)
    if (b[at(x, z)]) { top[x] = z + 1; break; }
  return top;
}

export function waterfallMetrics(s: SolidWaterfall) {
  const p = waterfallProfile(s);
  let lip = 0, dropM = 0;
  for (let x = 1; x < FALL_NX - 8; x++) if (p[x] - p[x + 1] > dropM) { lip = x; dropM = p[x] - p[x + 1]; }
  let poolBed = Infinity;
  for (let x = lip + 1; x <= Math.min(FALL_NX - 1, lip + 7); x++) poolBed = Math.min(poolBed, p[x]);
  let undercutM = 0;
  const b = waterfallRock(s).solid;
  for (let x = lip; x >= 0 && !b[at(x, FALL_CAP_BASE - 1)]; x--) undercutM++;
  return { lip, dropM, poolBedM: poolBed, poolDepthM: Math.max(0, 12 - poolBed),
    retreatM: Math.max(0, INITIAL_LIP - lip), undercutM };
}

export function projectWaterfall(w: WorldState): void {
  const s = w.meta.solidWaterfall;
  if (!s) return;
  const p = waterfallProfile(s);
  for (let y = 0; y < w.height; y++) for (let x = 0; x < w.width; x++) {
    const xx = Math.min(x, FALL_NX - 1), yy = Math.min(y, FALL_NY - 1);
    w.bedrockElevationM[y * w.width + x] = yy >= FALL_CHANNEL_Y0 && yy < FALL_CHANNEL_Y1 ? p[xx] : xx <= INITIAL_LIP ? BANK_TOP : 12;
  }
}

/** One year of quasi-steady river attack. Geometry, not a requested stage, determines change. */
function step(s: SolidWaterfall): void {
  const b = waterfallRock(s), solid = b.solid, damage = b.damage;
  const f = waterfallMetrics(s);
  if (s.dischargeM3PerS <= 0 || f.dropM < 1) { s.step++; return; }
  const rate = s.weakErosionMYr * Math.pow(s.dischargeM3PerS / 8, 0.6) * Math.sqrt(f.dropM / 20);
  const removed: number[] = [];
  // Water at the fall attacks exposed faces of the weak rock below the cap. It cannot erode sealed rock.
  for (let x = Math.max(1, f.lip - 12); x <= f.lip; x++) for (let z = Math.max(FLOOR, Math.floor(f.poolBedM)); z < INITIAL_TOP; z++) {
    const i = at(x, z);
    if (!solid[i] || solid[at(x + 1, z)]) continue;
    const rock = z >= FALL_CAP_BASE ? s.hardFactor : 1;
    damage[i] += rate * rock * Math.exp(-(f.lip - x) / 12);
    if (damage[i] >= 1) removed.push(i);
  }
  // Impact scour below the falling jet cuts a real pool into the bed, with attenuation as it deepens.
  const top = waterfallProfile(s);
  for (let x = f.lip + 1; x <= Math.min(FALL_NX - 1, f.lip + 6); x++) {
    const z = top[x] - 1;
    if (z < FLOOR) continue;
    const i = at(x, z);
    const depth = Math.max(0, 12 - top[x]);
    damage[i] += rate * 1.5 * Math.exp(-Math.pow((x - f.lip - 2) / 2.5, 2)) * Math.exp(-depth / 4);
    if (damage[i] >= 1) removed.push(i);
  }
  let eroded = 0;
  for (const i of removed) if (solid[i]) { solid[i] = 0; eroded++; }
  // Beam support is measured from intact soft-rock anchorage, across the whole cap thickness.
  // Measuring support one layer at a time would let a thick roof bridge an arbitrarily wide cave.
  let collapsed = 0;
  let span = 0;
  for (let x = 0; x <= f.lip; x++) {
    if (solid[at(x, FALL_CAP_BASE - 1)]) span = 0;
    else span++;
    if (span <= s.maxSpanM) continue;
    for (let z = FALL_CAP_BASE; z < FALL_NZ; z++) if (solid[at(x, z)]) { solid[at(x, z)] = 0; collapsed++; }
  }
  const width = FALL_CHANNEL_Y1 - FALL_CHANNEL_Y0;
  s.erodedM3 += eroded * width;
  s.collapsedM3 += collapsed * width;
  s.exportedM3 += (eroded + collapsed) * width;
  s.step++;
}

export function advanceWaterfallState(s: SolidWaterfall, years: number): number {
  if (!s || !Number.isFinite(years) || years <= 0) return 0;
  const before = s.exportedM3;
  s.remainderYears += years;
  const n = Math.floor(s.remainderYears + 1e-9);
  for (let k = 0; k < n; k++) step(s);
  s.remainderYears -= n;
  const b = waterfallRock(s);
  s.solid = Array.from(b.solid);
  s.damage = Array.from(b.damage);
  return s.exportedM3 - before;
}

export function advanceWaterfall(w: WorldState, years: number): number {
  const s = w.meta.solidWaterfall;
  if (!s || !Number.isFinite(years) || years <= 0) return 0;
  const removed = advanceWaterfallState(s, years);
  projectWaterfall(w);
  return removed;
}

export function buildLiveWaterfallWorld(): WorldState {
  const w = createWorld({ width: FALL_NX + 1, height: FALL_NY + 1, cellSizeM: 1, seed: 19, seaLevelM: -10,
    meta: { name: 'Live river waterfall', presetId: 'solid-waterfall', reliefM: 32 } });
  const solid = new Uint8Array(FALL_NX * FALL_NZ);
  let count = 0;
  for (let x = 0; x < FALL_NX; x++) for (let z = 0; z < (x <= INITIAL_LIP ? INITIAL_TOP : 12); z++) { solid[at(x, z)] = 1; count++; }
  w.meta.solidWaterfall = { solid: Array.from(solid), damage: Array.from(new Float32Array(solid.length)), step: 0,
    remainderYears: 0, dischargeM3PerS: 8, maxSpanM: 4, weakErosionMYr: 0.08, hardFactor: 0.04,
    initialRockM3: count * (FALL_CHANNEL_Y1 - FALL_CHANNEL_Y0), erodedM3: 0, collapsedM3: 0, exportedM3: 0 };
  w.materialId.fill(2);
  setUniformStrata(w);
  projectWaterfall(w);
  return w;
}
