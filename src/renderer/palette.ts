import { Color } from 'three';
import { MATERIALS, LOOSE_SEDIMENT_COLOUR } from '../terrain/materials';
import { smoothstep } from '../utils/math';

/**
 * Terrain surface colouring from simulated fields (cosmetic mapping, not a vegetation model):
 * bedrock lithology colour, blended with loose-sediment colour by thickness and slope,
 * with height-relative tinting (lowland sediment olive, upland sediment browner,
 * near-sea-level sediment sandy).
 */
const lin = (hex: number): [number, number, number] => {
  const c = new Color().setHex(hex);
  return [c.r, c.g, c.b];
};

const ROCK = MATERIALS.map((m) => lin(m.colour));
const SED_LOW = lin(LOOSE_SEDIMENT_COLOUR);
const SED_HIGH = lin(0x7b6f52);
const SAND = lin(0xc8b48a);
const SEABED = lin(0x8a8466);

export interface ColourInputs {
  materialId: number;
  sedimentM: number;
  slope: number;
  /** Surface elevation minus sea level (m). */
  aboveSeaM: number;
  /** World relief scale (m) for height-relative tints. */
  reliefM: number;
}

export function terrainColour(p: ColourInputs, out: Float32Array, o: number): void {
  const rock = ROCK[p.materialId] ?? ROCK[0];
  const rel = p.reliefM > 1 ? p.aboveSeaM / p.reliefM : 0;
  const hi = smoothstep(0.25, 0.75, rel);
  let sr = SED_LOW[0] + (SED_HIGH[0] - SED_LOW[0]) * hi;
  let sg = SED_LOW[1] + (SED_HIGH[1] - SED_LOW[1]) * hi;
  let sb = SED_LOW[2] + (SED_HIGH[2] - SED_LOW[2]) * hi;
  const sandy = p.aboveSeaM < 0 ? 0.6 : 1 - smoothstep(0.5, 4, p.aboveSeaM);
  const sandT = sandy * (p.aboveSeaM < 0 ? 0.5 : 1);
  const sandC = p.aboveSeaM < 0 ? SEABED : SAND;
  sr += (sandC[0] - sr) * sandT;
  sg += (sandC[1] - sg) * sandT;
  sb += (sandC[2] - sb) * sandT;
  const sedW = smoothstep(0.03, 0.6, p.sedimentM) * (1 - smoothstep(0.55, 1.0, p.slope));
  // Steep exposed rock reads slightly darker (shadowed crevices).
  const rockShade = 1 - 0.18 * smoothstep(0.6, 1.6, p.slope);
  out[o] = rock[0] * rockShade + (sr - rock[0] * rockShade) * sedW;
  out[o + 1] = rock[1] * rockShade + (sg - rock[1] * rockShade) * sedW;
  out[o + 2] = rock[2] * rockShade + (sb - rock[2] * rockShade) * sedW;
}
