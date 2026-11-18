import { ArchModel, archParamsFor, BED_Z, NX, NY, NZ, type ArchParams, type Stage } from '../../local/arch/model';
import { createWorld, setUniformStrata, type WorldState } from '../../engine/world';

/** Saved solid rock, not a stage selector. Arrays are plain data in the world header. */
export interface SolidHeadland {
  params: ArchParams;
  solid: number[];
  damage: number[];
  step: number;
  remainderYears: number;
  erodedVoxels: number;
  collapsedVoxels: number;
  initialVoxels: number;
  exportedM3: number;
  history: { stage: Stage; step: number }[];
}

/** Illustrative process time, not a calibrated prediction of coastal retreat. */
export const HEADLAND_STEP_YEARS = 10;
const models = new WeakMap<SolidHeadland, ArchModel>();

export function headlandModel(s: SolidHeadland): ArchModel {
  let m = models.get(s);
  if (!m) {
    m = new ArchModel({ ...s.params });
    m.solid.set(s.solid);
    m.damage.set(s.damage);
    m.step = s.step;
    m.erodedVoxels = s.erodedVoxels;
    m.collapsedVoxels = s.collapsedVoxels;
    m.initialVoxels = s.initialVoxels;
    m.stageHistory = structuredClone(s.history);
    models.set(s, m);
  }
  return m;
}

/** Column envelope for routing and measurements. Volume must be measured from solid voxels. */
export function projectHeadland(w: WorldState): void {
  const s = w.meta.solidHeadland;
  if (!s) return;
  const m = headlandModel(s);
  for (let y = 0; y < w.height; y++) for (let x = 0; x < w.width; x++) {
    const xx = Math.min(NX - 1, x);
    const yy = Math.min(NY - 1, y);
    let top = BED_Z;
    for (let z = NZ - 1; z >= BED_Z; z--) if (m.isSolid(xx, yy, z)) { top = z + 1; break; }
    w.bedrockElevationM[y * w.width + x] = top;
  }
}

/** Fixed numerical steps: splitting requests or saving midway cannot change the rock sequence. */
export function advanceHeadland(w: WorldState, years: number): number {
  const s = w.meta.solidHeadland;
  if (!s || !Number.isFinite(years) || years <= 0 || !w.coast.wavesOn) return 0;
  const m = headlandModel(s);
  const p = archParamsFor('chalk', w.coast.waveHeightM, w.coast.wavePeriodS, s.params.jointFactor, s.params.seed);
  m.p = { ...s.params };
  m.refreshErodibility();
  // Keep saved geometry/strength parameters; wave climate and sea level are live world controls.
  const direction = 0.15 + 0.85 * Math.max(0, Math.cos(w.coast.waveFromDeg * Math.PI / 180));
  m.p.waveRate = w.coast.waveHeightM > 0 ? p.waveRate * direction : 0;
  m.p.surgeTop = p.surgeTop;
  m.p.seaLevel = Math.max(BED_Z, Math.min(NZ - 2, Math.floor(w.seaLevelM)));
  const count = m.count();
  s.remainderYears += years;
  const steps = Math.floor((s.remainderYears + 1e-9) / HEADLAND_STEP_YEARS);
  for (let k = 0; k < steps; k++) m.advance();
  s.remainderYears -= steps * HEADLAND_STEP_YEARS;
  const removed = count - m.count();
  s.exportedM3 += removed; // 1 m³ voxels; explicitly exported, never silently discarded.
  s.solid = Array.from(m.solid);
  s.damage = Array.from(m.damage);
  s.step = m.step;
  s.params = { ...m.p };
  s.erodedVoxels = m.erodedVoxels;
  s.collapsedVoxels = m.collapsedVoxels;
  s.history = structuredClone(m.stageHistory);
  projectHeadland(w);
  return removed;
}

/** A real 48 × 40 m headland in the main world, with one-metre solid rock resolution. */
export function buildLiveHeadlandWorld(seed = 7): WorldState {
  const m = new ArchModel(archParamsFor('chalk', 2, 8, 5, seed));
  const w = createWorld({ width: NX + 1, height: NY + 1, cellSizeM: 1, seed, seaLevelM: m.p.seaLevel + 0.5,
    meta: { name: 'Live chalk headland', presetId: 'solid-headland', reliefM: 24 } });
  w.meta.solidHeadland = { params: { ...m.p }, solid: Array.from(m.solid), damage: Array.from(m.damage), step: 0,
    remainderYears: 0, initialVoxels: m.initialVoxels, erodedVoxels: 0, collapsedVoxels: 0, exportedM3: 0,
    history: structuredClone(m.stageHistory) };
  w.coast.wavesOn = true;
  w.coast.waveFromDeg = 0;
  w.materialId.fill(4);
  setUniformStrata(w);
  projectHeadland(w);
  return w;
}
