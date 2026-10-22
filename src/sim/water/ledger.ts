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
  /** Stored water (surface water + snow) at reset (m³). */
  initialStored: number;
  /** Internal transfers between stores (not inputs/outputs): rain → snowpack, snowpack → water. */
  snowfall: number;
  snowmelt: number;
}

export function emptyLedger(initialStored = 0): WaterLedger {
  return { rainIn: 0, glacierMeltIn: 0, sourceIn: 0, toolIn: 0, toolOut: 0, infiltrated: 0, evaporated: 0, edgeOut: 0, seaOut: 0, initialStored, snowfall: 0, snowmelt: 0 };
}

export function ledgerIn(l: WaterLedger) {
  return l.rainIn + l.sourceIn + l.toolIn + l.glacierMeltIn;
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
