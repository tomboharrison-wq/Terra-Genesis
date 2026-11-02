/** Cumulative water volume accounting (m³) since the ledger was reset. */
export interface WaterLedger {
  rainIn: number;
  sourceIn: number;
  /** Glacier meltwater reaching the rivers (real-time share of accelerated ice melt). */
  glacierMeltIn: number;
  /** Added/removed by user tools (rain brush, drain brush). */
  toolIn: number;
  toolOut: number;
  infiltrated: number;
  evaporated: number;
  /** Left through open map edges. */
  edgeOut: number;
  /** Flowed into sea cells (fixed-head sink). */
  seaOut: number;
  /** Pushed onto the land by a raised sea (sea surge hazard). */
  surgeIn: number;
  /** Stored water (surface water + snow) at reset (m³). */
  initialStored: number;
  /** Internal transfers between stores (not inputs/outputs): rain → snowpack, snowpack → water. */
  snowfall: number;
  snowmelt: number;
}

export function emptyLedger(initialStored = 0): WaterLedger {
  return {
    rainIn: 0,
    glacierMeltIn: 0,
    surgeIn: 0,
    sourceIn: 0,
    toolIn: 0,
    toolOut: 0,
    infiltrated: 0,
    evaporated: 0,
    edgeOut: 0,
    seaOut: 0,
    initialStored,
    snowfall: 0,
    snowmelt: 0,
  };
}

export function ledgerIn(l: WaterLedger) {
  return l.rainIn + l.sourceIn + l.toolIn + l.glacierMeltIn + l.surgeIn;
}

export function ledgerOut(l: WaterLedger) {
  return l.infiltrated + l.evaporated + l.edgeOut + l.seaOut + l.toolOut;
}

/** Stored volume the budget predicts: initial + inputs − outputs. */
export function expectedStored(l: WaterLedger) {
  return l.initialStored + ledgerIn(l) - ledgerOut(l);
}

/** Relative closure error of the budget against actually stored volume. */
export function closureError(l: WaterLedger, stored: number): number {
  const scale = Math.max(1e-9, l.initialStored + ledgerIn(l));
  return Math.abs(stored - expectedStored(l)) / scale;
}

/** Correct tiny float32 depth drift while preserving the input/output ledger. */
export function reconcileDepthMass(
  depth: Float32Array,
  sea: Uint8Array,
  cellArea: number,
  expectedStoredM3: number,
  storedOtherM3: number,
  toleranceM3 = 1e-9,
): number {
  if (!(cellArea > 0) || !Number.isFinite(expectedStoredM3) || !Number.isFinite(storedOtherM3)) return 0;
  let stored = 0;
  let wetStored = 0;
  let wet = 0;
  for (let i = 0; i < depth.length; i++) {
    if (sea[i]) continue;
    const volume = Math.max(0, depth[i]) * cellArea;
    stored += volume;
    if (depth[i] > 1e-7) {
      wetStored += volume;
      wet++;
    }
  }
  const delta = expectedStoredM3 - storedOtherM3 - stored;
  if (!Number.isFinite(delta) || Math.abs(delta) <= toleranceM3 || wet === 0) return 0;
  // A large residual indicates a real routing/source mismatch; never hide it
  // with a blanket correction. Only repair representational float32 drift.
  if (Math.abs(delta) > Math.max(1e-3, Math.abs(expectedStoredM3) * 1e-6)) return 0;
  if (delta < 0) {
    const factor = Math.max(0, (wetStored + delta) / wetStored);
    for (let i = 0; i < depth.length; i++) if (!sea[i] && depth[i] > 1e-7) depth[i] *= factor;
  } else {
    const perCell = delta / (wet * cellArea);
    for (let i = 0; i < depth.length; i++) if (!sea[i] && depth[i] > 1e-7) depth[i] += perCell;
  }
  return delta;
}
