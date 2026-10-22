/** Wave climate and coastal process parameters (see coastSim.ts). Dependency-free. */
export interface CoastParams {
  wavesOn: boolean;
  waveHeightM: number;
  wavePeriodS: number;
  /** Bearing waves come FROM (degrees clockwise from north). */
  waveFromDeg: number;
  /** Cliff lowering per unit wave power (m/s per W/m at ×1 acceleration). */
  cliffK: number;
  /** Longshore transport coefficient (m³/s per m^2.5 at ×1). */
  driftK: number;
  /** Simulated seconds between coastal updates. */
  intervalS: number;
}

export function defaultCoastParams(): CoastParams {
  return { wavesOn: false, waveHeightM: 2, wavePeriodS: 8, waveFromDeg: 180, cliffK: 6e-11, driftK: 2e-4, intervalS: 600 };
}
