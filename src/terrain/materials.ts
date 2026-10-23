/**
 * Material registry. Values are relative/approximate placeholders until M03 (erosion)
 * calibrates them; they are NOT used by any physics yet. Colours are sRGB hex.
 */
export type MaterialKind = 'bedrock' | 'loose';

export interface MaterialDef {
  id: number;
  key: string;
  name: string;
  kind: MaterialKind;
  colour: number;
  /** Relative erodibility (1 = reference weak sedimentary); also scales weathering. */
  erodibility: number;
  /** Steepest stable bedrock face (degrees) before rockfall. */
  cliffDeg: number;
  densityKgPerM3: number;
}

export const MATERIALS: readonly MaterialDef[] = [
  { id: 0, key: 'crystalline', name: 'Hard crystalline (granite)', kind: 'bedrock', colour: 0x8a8580, erodibility: 0.1, cliffDeg: 80, densityKgPerM3: 2700 },
  { id: 1, key: 'resistant-sed', name: 'Resistant sedimentary (sandstone)', kind: 'bedrock', colour: 0xa98f6c, erodibility: 0.4, cliffDeg: 75, densityKgPerM3: 2400 },
  { id: 2, key: 'weak-sed', name: 'Weak sedimentary (mudstone)', kind: 'bedrock', colour: 0x77777a, erodibility: 1.0, cliffDeg: 58, densityKgPerM3: 2300 },
  { id: 3, key: 'clay', name: 'Clay', kind: 'bedrock', colour: 0x94664c, erodibility: 1.6, cliffDeg: 45, densityKgPerM3: 1900 },
  { id: 4, key: 'chalk', name: 'Chalk / limestone', kind: 'bedrock', colour: 0xbdb7a4, erodibility: 0.6, cliffDeg: 72, densityKgPerM3: 2200 },
  { id: 5, key: 'volcanic', name: 'Volcanic rock (basalt / andesite)', kind: 'bedrock', colour: 0x4b4744, erodibility: 0.25, cliffDeg: 78, densityKgPerM3: 2900 },
];

export const BEDROCK_MATERIALS = MATERIALS.filter((m) => m.kind === 'bedrock');

export function materialById(id: number): MaterialDef {
  return MATERIALS[id] ?? MATERIALS[0];
}

/** Angle of repose of dry loose sediment (degrees); saturation lowers it (see slopes). */
export const LOOSE_REPOSE_DEG = 33;

/** Loose sediment (soil/regolith) appearance; sediment typing arrives with M03. */
export const LOOSE_SEDIMENT_COLOUR = 0x6f6a3f;
