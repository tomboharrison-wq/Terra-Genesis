import type { WorldState } from '../engine/world';

export const MINECRAFT_MIN_Y = -64;
export const MINECRAFT_MAX_Y = 319;
export const MINECRAFT_SEA_Y = 63;

/** Map real elevation to a modern Minecraft Java terrain column, preserving sea level at Y=63. */
export function minecraftY(elevationM: number, seaLevelM: number): number {
  return Math.max(MINECRAFT_MIN_Y, Math.min(MINECRAFT_MAX_Y, Math.round(elevationM - seaLevelM + MINECRAFT_SEA_Y)));
}

/** 16-bit WorldPainter height-map values, north at the top. */
export function minecraftHeightmap(w: WorldState, surface: Float32Array): Uint16Array {
  const out = new Uint16Array(surface.length);
  const range = MINECRAFT_MAX_Y - MINECRAFT_MIN_Y;
  for (let y = 0; y < w.height; y++)
    for (let x = 0; x < w.width; x++) {
      const src = y * w.width + x;
      const dst = (w.height - 1 - y) * w.width + x;
      out[dst] = Math.round(((minecraftY(surface[src], w.seaLevelM) - MINECRAFT_MIN_Y) / range) * 65535);
    }
  return out;
}

export function minecraftMetadata(w: WorldState) {
  return {
    format: 'Terra Genesis WorldPainter 16-bit height map',
    minecraftEdition: 'Java 1.18 or later',
    widthPixels: w.width,
    heightPixels: w.height,
    northAtTop: true,
    minecraftMinY: MINECRAFT_MIN_Y,
    minecraftMaxY: MINECRAFT_MAX_Y,
    seaLevelY: MINECRAFT_SEA_Y,
    horizontalScale: `${w.cellSizeM} Minecraft blocks per pixel preserves the model's physical horizontal scale`,
    import: 'In WorldPainter choose Import new world from height map, set the low and high mapping to -64 and 319, set water level to 63, then choose the desired horizontal scale.',
  };
}
