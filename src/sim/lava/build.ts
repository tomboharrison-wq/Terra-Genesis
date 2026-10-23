import type { WorldState } from '../../engine/world';
import { LavaSim, type LavaKind } from './lavaSim';
import type { EruptionStyle } from './tephra';

/**
 * Volcano builds (spec E10): a volcano grows from many eruptions. Each eruption runs the real lava and
 * tephra physics for its duration plus 2 h of flow; the rest years between eruptions are skipped
 * (labelled time compression: leftover lava is cooled to rock, water and erosion do not run).
 *
 * Plans (teaching values within real ranges):
 *   shield     runny basalt lava every time (Hawaii-type);
 *   composite  sticky andesite, explosive (ash + cinder) and lava eruptions taking turns (strato-volcano);
 *   island     basalt from a sea-floor vent: explosive while the vent is under water (magma meets
 *              sea water and shatters — Surtseyan, as at Surtsey 1963; the wet, low jets drop most
 *              tephra (85 %) close to the vent), lava once the vent is above the sea, so the new
 *              island is capped by lava that resists the waves.
 */
export type VolcanoType = 'shield' | 'composite' | 'island';

export interface EpisodePlan {
  kind: LavaKind;
  style: EruptionStyle;
  rateM3PerS: number;
  seconds: number;
  /** Near-vent share of tephra (see LavaVent.coarseShare). */
  coarseShare?: number;
}

export function episodePlan(type: VolcanoType, k: number, ventUnderWater = false): EpisodePlan {
  if (type === 'shield') return { kind: 'basalt', style: 'lava', rateM3PerS: 200, seconds: 4 * 3600 };
  if (type === 'island')
    return ventUnderWater
      ? { kind: 'basalt', style: 'explosive', rateM3PerS: 1000, seconds: 12 * 3600, coarseShare: 0.85 }
      : { kind: 'basalt', style: 'lava', rateM3PerS: 300, seconds: 3 * 3600 };
  return k % 2 === 0
    ? { kind: 'andesite', style: 'explosive', rateM3PerS: 200, seconds: 3 * 3600 }
    : { kind: 'andesite', style: 'lava', rateM3PerS: 60, seconds: 6 * 3600 };
}

/** Run one eruption at cell (x, y) to completion, then cool everything left to rock. */
export function runEruption(lava: LavaSim, w: WorldState, x: number, y: number, p: EpisodePlan): void {
  const v = lava.addVent(x, y, p.rateM3PerS, p.kind, p.seconds, p.style);
  if (p.coarseShare !== undefined) v.coarseShare = p.coarseShare;
  lava.windFromDeg = w.climate.windFromDeg;
  for (let t = 0; t < p.seconds + 2 * 3600; t += 600) {
    lava.advance(600);
    if (lava.tephraDue()) lava.layTephra();
    if (lava.solidifyDue()) lava.solidify();
  }
  if (lava.pendingTephra() > 0) lava.layTephra();
  lava.freezeAll();
}

/** Ground elevation (bedrock + loose) at a cell. */
export const groundAt = (w: WorldState, i: number) => w.bedrockElevationM[i] + w.looseSedimentThicknessM[i];

/**
 * Grow a volcanic island from a sea-floor vent at the map centre (world generation): explosive
 * eruptions until the vent stands above the sea (at most `maxExplosive`), then `lavaEruptions` lava
 * eruptions that cap it. Returns the eruptions used.
 */
export function growIsland(w: WorldState, lavaEruptions = 3, maxExplosive = 12): number {
  const n = w.width * w.height;
  const surface = new Float32Array(n);
  const sea = new Uint8Array(n);
  const refresh = () => {
    for (let i = 0; i < n; i++) {
      surface[i] = groundAt(w, i);
      sea[i] = surface[i] < w.seaLevelM ? 1 : 0;
    }
  };
  refresh();
  const lava = new LavaSim(w, surface);
  lava.sea = sea;
  const x = w.width >> 1;
  const y = w.height >> 1;
  const vent = y * w.width + x;
  let k = 0;
  while (k < maxExplosive && surface[vent] < w.seaLevelM) {
    runEruption(lava, w, x, y, episodePlan('island', k++, true));
    refresh();
  }
  for (let j = 0; j < lavaEruptions; j++) {
    runEruption(lava, w, x, y, episodePlan('island', k++, surface[vent] < w.seaLevelM));
    refresh();
  }
  return k;
}
