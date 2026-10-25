/**
 * Flood hazards (spec E12): a storm and a sea surge, each run as a timed event through the real water
 * solver, with the flood it causes recorded as the deepest water reached on every land cell.
 *
 * Storm: the map-wide rain is set to `rainMmH` for `activeS`, then put back to what it was. Rivers
 * rise, overtop their banks and drain through the normal shallow-water routing.
 *
 * Sea surge ("tsunami", explicitly simplified): the sea's fixed water level rises by `surgeM` for
 * `activeS` (smooth rise and fall over `rampS`), and the solver pushes sea water onto any land the
 * raised sea can reach, then lets it drain back. It is NOT a travelling wave: there is no wave speed,
 * shoaling, breaking or backwash force, and every sea cell rises at once (inland cells below sea level
 * count as sea, so they rise too). Run-up = the surge height you set.
 *
 * Flood extent = land cells where the deepest water during the event (peak) was at least
 * `FLOOD_THRESHOLD_M` higher than the water there when the event began, so rivers and lakes that
 * were already full do not count as flooded. Peak depth is updated after every solver step.
 */
export type HazardKind = 'storm' | 'surge';

export interface HazardEvent {
  id: number;
  kind: HazardKind;
  label: string;
  /** Simulated time the event began (s). */
  startS: number;
  /** Simulated time since the event began (s). */
  elapsedS: number;
  /** How long the storm rain / raised sea lasts (s). */
  activeS: number;
  /** Total recording time including the aftermath while water drains (s). */
  recordS: number;
  rainMmH: number;
  /** Rain before the storm (m/s), restored when it ends. */
  prevRainMPerS: number;
  rainRestored: boolean;
  surgeM: number;
  rampS: number;
  done: boolean;
}

export const FLOOD_THRESHOLD_M = 0.3;

/** Sea surge height (m above normal sea level) `t` seconds into the event: smooth rise, hold, fall. */
export function surgeHeight(e: Pick<HazardEvent, 'kind' | 'surgeM' | 'activeS' | 'rampS'>, t: number): number {
  if (e.kind !== 'surge' || t <= 0 || t >= e.activeS) return 0;
  const r = Math.min(e.rampS, e.activeS / 2);
  const ease = (u: number) => 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, u)));
  if (t < r) return e.surgeM * ease(t / r);
  if (t > e.activeS - r) return e.surgeM * ease((e.activeS - t) / r);
  return e.surgeM;
}

export interface FloodSummary {
  /** Land flooded: area where the water rose by at least the threshold (m²). */
  areaM2: number;
  cells: number;
  /** Deepest water reached on any flooded cell (m). */
  peakDepthM: number;
  /** Largest rise of the water on any cell (m). */
  peakRiseM: number;
}

/** Flood extent from the peak-depth record. `start` = water depth when the event began. */
export function floodSummary(peak: Float32Array, start: Float32Array, cellSizeM: number, thresholdM = FLOOD_THRESHOLD_M): FloodSummary {
  let cells = 0;
  let deep = 0;
  let rise = 0;
  for (let i = 0; i < peak.length; i++) {
    const r = peak[i] - start[i];
    if (r > rise) rise = r;
    if (r >= thresholdM) {
      cells++;
      if (peak[i] > deep) deep = peak[i];
    }
  }
  return { areaM2: cells * cellSizeM * cellSizeM, cells, peakDepthM: deep, peakRiseM: rise };
}

/** Raise every entry of `peak` to at least the current depth (land cells only; sea depth is 0). */
export function updatePeak(peak: Float32Array, depth: Float32Array): void {
  for (let i = 0; i < peak.length; i++) if (depth[i] > peak[i]) peak[i] = depth[i];
}
