import type { WorldState } from '../../engine/world';
import { findWaterfall, mainRiver } from '../../education/geoFeatures';
import {
  advanceWaterfallState,
  buildLiveWaterfallWorld,
  FALL_CHANNEL_Y0,
  FALL_CHANNEL_Y1,
  FALL_NX,
  FALL_NY,
  waterfallMetrics,
  type SolidWaterfall,
} from '../river/solidWaterfall';
import {
  advanceHeadlandState,
  buildLiveHeadlandWorld,
  headlandModel,
  type SolidHeadland,
} from '../coast/solidHeadland';
import { NX, NY } from '../../local/arch/model';

/**
 * M20-C01: Coupled 3D Solid Voxel Patches embedded directly inside full heightfield landscapes.
 * Allows an ordinary 3D landscape world (River basin, River to sea, Coastal headlands, Island, etc.)
 * to host a live 3D voxel waterfall (with undercutting, overhang void, plunge pool, cap collapse,
 * and falling water jet) and/or a live 3D voxel headland (cave → arch → roof collapse → stack → stump),
 * coupled to the world's river discharge, wave climate, heightfield bedrock, and sediment ledgers.
 */

export interface EmbeddedWaterfallPatch {
  xM: number;
  yM: number;
  zBaseM: number;
  angleRad: number;
  scaleM: number;
  cellIndex: number;
  waterfall: SolidWaterfall;
}

export interface EmbeddedHeadlandPatch {
  xM: number;
  yM: number;
  zBaseM: number;
  angleRad: number;
  scaleM: number;
  cellIndex: number;
  headland: SolidHeadland;
}

const surf = (w: WorldState, i: number) => w.bedrockElevationM[i] + w.looseSedimentThicknessM[i];

/**
 * Locate the best waterfall / knickpoint site on the main river of `w` (or at `targetCell`)
 * and embed a coupled 3D solid waterfall domain there.
 */
export function attachEmbeddedWaterfall(w: WorldState, targetCell?: number): EmbeddedWaterfallPatch | null {
  if (w.meta.solidWaterfall || w.meta.solidHeadland) return null;
  if (w.meta.embeddedWaterfall && targetCell === undefined) return w.meta.embeddedWaterfall;

  const W = w.width;
  const H = w.height;
  const cs = w.cellSizeM;
  const p = mainRiver(w, 10);
  if (p.cells.length < 8 && targetCell === undefined) return null;

  let lipCell = targetCell ?? -1;
  let angleRad = 0;

  if (lipCell < 0) {
    const wf = findWaterfall(w, p, Math.max(80, cs * 4), 4);
    if (wf) {
      lipCell = wf.lip;
      const fx = (wf.foot % W) - (wf.lip % W);
      const fy = ((wf.foot / W) | 0) - ((wf.lip / W) | 0);
      angleRad = Math.atan2(-fy, fx);
    } else {
      // Pick the steepest upper-middle reach along the trunk river (indices 0.45..0.82 from mouth)
      let bestK = Math.floor(p.cells.length * 0.65);
      let bestDrop = -Infinity;
      const k0 = Math.max(2, Math.floor(p.cells.length * 0.35));
      const k1 = Math.min(p.cells.length - 3, Math.floor(p.cells.length * 0.85));
      for (let k = k0; k <= k1; k++) {
        const drop = p.z[Math.min(p.cells.length - 1, k + 2)] - p.z[Math.max(0, k - 2)];
        if (drop > bestDrop) {
          bestDrop = drop;
          bestK = k;
        }
      }
      lipCell = p.cells[bestK];
      const up = p.cells[Math.min(p.cells.length - 1, bestK + 2)];
      const dn = p.cells[Math.max(0, bestK - 2)];
      const fx = (dn % W) - (up % W);
      const fy = ((dn / W) | 0) - ((up / W) | 0);
      angleRad = Math.atan2(-fy, fx);
    }
  }

  if (lipCell < 0 || lipCell >= W * H) return null;
  const cx = lipCell % W;
  const cy = (lipCell / W) | 0;
  const xM = cx * cs;
  const yM = cy * cs;
  const scaleM = Math.max(1, Math.min(2.4, cs * 0.08));
  const zSurf = surf(w, lipCell);
  // Align the 3D waterfall lip (z = 32 in voxel coords) with the channel elevation at lipCell
  const zBaseM = zSurf - 31 * scaleM;

  const template = buildLiveWaterfallWorld().meta.solidWaterfall!;
  const patch: EmbeddedWaterfallPatch = {
    xM,
    yM,
    zBaseM,
    angleRad,
    scaleM,
    cellIndex: lipCell,
    waterfall: structuredClone(template),
  };
  w.meta.embeddedWaterfall = patch;
  return patch;
}

/**
 * Advance the embedded 3D waterfall patch by `years` of process time, coupling local river discharge
 * and carving the retreating gorge back into the host heightfield `w.bedrockElevationM`.
 */
export function stepEmbeddedWaterfall(w: WorldState, years: number, liveDischargeM3S?: number): number {
  const patch = w.meta.embeddedWaterfall;
  if (!patch || !Number.isFinite(years) || years <= 0) return 0;

  const i = patch.cellIndex;
  const f = w.waterFluxM3PerS;
  const qPipe = i >= 0 && i < w.width * w.height ? f[4 * i] + f[4 * i + 1] + f[4 * i + 2] + f[4 * i + 3] : 0;
  const qRain = Math.max(6, (w.water.rainMPerS * 3.6e6) * 0.25);
  patch.waterfall.dischargeM3PerS =
    liveDischargeM3S !== undefined ? liveDischargeM3S : qPipe > 0.2 ? Math.min(40, Math.max(4, qPipe)) : qRain;

  const beforeRetreat = waterfallMetrics(patch.waterfall).retreatM;
  const removedVoxelM3 = advanceWaterfallState(patch.waterfall, years);
  if (removedVoxelM3 <= 0) return 0;

  const afterMetrics = waterfallMetrics(patch.waterfall);
  const dRetreat = Math.max(0, afterMetrics.retreatM - beforeRetreat);

  // Couple the gorge incision & plunge pool deepening into the host terrain cell
  if (i >= 0 && i < w.bedrockElevationM.length) {
    const cellArea = w.cellSizeM * w.cellSizeM;
    const dz = Math.min(3.5, (removedVoxelM3 * patch.scaleM) / Math.max(100, cellArea));
    if (dz > 0 || dRetreat > 0) {
      w.bedrockElevationM[i] -= Math.max(dz, dRetreat * 0.04 * patch.scaleM);
    }
  }
  return removedVoxelM3;
}

/**
 * Locate the most prominent jutting coastal headland on `w` (or at `targetCell`)
 * and embed a coupled 3D voxel headland (`cave → arch → stack → stump`) there.
 */
export function attachEmbeddedHeadland(w: WorldState, targetCell?: number): EmbeddedHeadlandPatch | null {
  if (w.meta.solidHeadland || w.meta.solidWaterfall) return null;
  if (w.meta.embeddedHeadland && targetCell === undefined) return w.meta.embeddedHeadland;

  const W = w.width;
  const H = w.height;
  const cs = w.cellSizeM;
  const sl = w.seaLevelM;

  let bestCell = targetCell ?? -1;
  let bestScore = -Infinity;
  let bestSeaDx = 1;
  let bestSeaDy = 0;

  if (bestCell < 0) {
    for (let y = 4; y < H - 4; y++) {
      for (let x = 4; x < W - 4; x++) {
        const i = y * W + x;
        const z = surf(w, i);
        if (z < sl + 2 || z > sl + 160) continue;
        let seaCount = 0;
        let sdx = 0;
        let sdy = 0;
        for (let dy = -3; dy <= 3; dy++) {
          for (let dx = -3; dx <= 3; dx++) {
            if (dx === 0 && dy === 0) continue;
            const j = (y + dy) * W + (x + dx);
            if (surf(w, j) < sl) {
              seaCount++;
              sdx += dx;
              sdy += dy;
            }
          }
        }
        // A convex headland has sea neighbours on ~2–3 sides (between 14 and 36 of 48 neighbours in 7×7)
        if (seaCount >= 12 && seaCount <= 38) {
          const hardness = 8 - w.materialId[i]; // prefer harder rock bands (granite/limestone/chalk)
          const score = seaCount * 1.5 + hardness * 3 + Math.min(40, z - sl) * 0.4;
          if (score > bestScore) {
            bestScore = score;
            bestCell = i;
            bestSeaDx = sdx || 1;
            bestSeaDy = sdy;
          }
        }
      }
    }
  }

  if (bestCell < 0 || bestCell >= W * H) return null;
  const cx = bestCell % W;
  const cy = (bestCell / W) | 0;
  const xM = cx * cs;
  const yM = cy * cs;
  const angleRad = Math.atan2(-bestSeaDy, bestSeaDx);
  const scaleM = Math.max(1, Math.min(2.2, cs * 0.075));

  const template = buildLiveHeadlandWorld(w.seed || 7).meta.solidHeadland!;
  const seaVoxelZ = template.params.seaLevel + 0.5;
  const zBaseM = sl - seaVoxelZ * scaleM;

  const patch: EmbeddedHeadlandPatch = {
    xM,
    yM,
    zBaseM,
    angleRad,
    scaleM,
    cellIndex: bestCell,
    headland: structuredClone(template),
  };
  w.meta.embeddedHeadland = patch;
  return patch;
}

/**
 * Advance the embedded 3D coastal headland patch by `years` of wave attack,
 * evolving `headland → cave → arch → stack → stump` and coupling removed rock to the host cell.
 */
export function stepEmbeddedHeadland(w: WorldState, years: number): number {
  const patch = w.meta.embeddedHeadland;
  if (!patch || !Number.isFinite(years) || years <= 0 || !w.coast.wavesOn) return 0;

  const virtualSeaLevel = patch.headland.params.seaLevel + 0.5;
  const removedVoxels = advanceHeadlandState(patch.headland, w.coast, virtualSeaLevel, years);
  if (removedVoxels <= 0) return 0;

  const i = patch.cellIndex;
  if (i >= 0 && i < w.bedrockElevationM.length) {
    const cellArea = w.cellSizeM * w.cellSizeM;
    const dz = Math.min(2.5, (removedVoxels * patch.scaleM) / Math.max(100, cellArea));
    w.bedrockElevationM[i] = Math.max(w.seaLevelM - 1.5, w.bedrockElevationM[i] - dz);
  }
  return removedVoxels;
}

/**
 * Summary metrics for any active 3D solid headland (dedicated 1 m world or embedded patch).
 */
export function activeHeadlandInfo(w: WorldState): {
  stage: 'headland' | 'cave' | 'arch' | 'stack' | 'stump' | 'gone';
  exportedM3: number;
  erodedVoxels: number;
  collapsedVoxels: number;
  hasArchOpening: boolean;
  xM: number;
  yM: number;
  distanceM: number;
} | null {
  if (w.meta.solidHeadland) {
    const s = w.meta.solidHeadland;
    const m = headlandModel(s);
    const stage = s.history[s.history.length - 1]?.stage ?? m.currentStage;
    return {
      stage,
      exportedM3: s.exportedM3,
      erodedVoxels: s.erodedVoxels,
      collapsedVoxels: s.collapsedVoxels,
      hasArchOpening: m.hasArchOpening(),
      xM: NX * 0.5,
      yM: NY * 0.55,
      distanceM: 68,
    };
  }
  if (w.meta.embeddedHeadland) {
    const p = w.meta.embeddedHeadland;
    const s = p.headland;
    const m = headlandModel(s);
    const stage = s.history[s.history.length - 1]?.stage ?? m.currentStage;
    return {
      stage,
      exportedM3: s.exportedM3,
      erodedVoxels: s.erodedVoxels,
      collapsedVoxels: s.collapsedVoxels,
      hasArchOpening: m.hasArchOpening(),
      xM: p.xM,
      yM: p.yM,
      distanceM: Math.max(95, 72 * p.scaleM),
    };
  }
  return null;
}

/**
 * Summary metrics for any active 3D solid waterfall (dedicated 1 m world or embedded patch).
 */
export function activeWaterfallInfo(w: WorldState): {
  retreatM: number;
  undercutM: number;
  poolDepthM: number;
  dropM: number;
  erodedM3: number;
  collapsedM3: number;
  dischargeM3PerS: number;
  xM: number;
  yM: number;
  distanceM: number;
} | null {
  if (w.meta.solidWaterfall) {
    const s = w.meta.solidWaterfall;
    const f = waterfallMetrics(s);
    return {
      retreatM: f.retreatM,
      undercutM: f.undercutM,
      poolDepthM: f.poolDepthM,
      dropM: f.dropM,
      erodedM3: s.erodedM3,
      collapsedM3: s.collapsedM3,
      dischargeM3PerS: s.dischargeM3PerS,
      xM: f.lip + 5,
      yM: (FALL_CHANNEL_Y0 + FALL_CHANNEL_Y1) * 0.5,
      distanceM: 70,
    };
  }
  if (w.meta.embeddedWaterfall) {
    const p = w.meta.embeddedWaterfall;
    const s = p.waterfall;
    const f = waterfallMetrics(s);
    return {
      retreatM: f.retreatM,
      undercutM: f.undercutM,
      poolDepthM: f.poolDepthM,
      dropM: f.dropM,
      erodedM3: s.erodedM3,
      collapsedM3: s.collapsedM3,
      dischargeM3PerS: s.dischargeM3PerS,
      xM: p.xM,
      yM: p.yM,
      distanceM: Math.max(110, 78 * p.scaleM),
    };
  }
  return null;
}

export { FALL_NX, FALL_NY };
