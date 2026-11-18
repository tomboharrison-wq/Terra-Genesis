import type { WorldState } from '../engine/world';
import { terrainColour } from '../renderer/palette';

export interface TerrainMeshData {
  positions: Float32Array;
  colours: Float32Array;
  indices: Uint32Array;
}

/** Full-resolution triangle mesh in metres, using the same world-to-Three axis mapping as the renderer. */
export function terrainMeshData(w: WorldState, surface: Float32Array): TerrainMeshData {
  const n = w.width * w.height;
  const positions = new Float32Array(n * 3);
  const colours = new Float32Array(n * 3);
  let zMin = Infinity;
  let zMax = -Infinity;
  for (const z of surface) {
    zMin = Math.min(zMin, z);
    zMax = Math.max(zMax, z);
  }
  const relief = Math.max(1, zMax - Math.max(zMin, w.seaLevelM));
  for (let y = 0; y < w.height; y++)
    for (let x = 0; x < w.width; x++) {
      const i = y * w.width + x;
      const xl = Math.max(0, x - 1);
      const xr = Math.min(w.width - 1, x + 1);
      const yd = Math.max(0, y - 1);
      const yu = Math.min(w.height - 1, y + 1);
      const sx = (surface[y * w.width + xr] - surface[y * w.width + xl]) / (Math.max(1, xr - xl) * w.cellSizeM);
      const sy = (surface[yu * w.width + x] - surface[yd * w.width + x]) / (Math.max(1, yu - yd) * w.cellSizeM);
      positions[i * 3] = x * w.cellSizeM;
      positions[i * 3 + 1] = surface[i];
      positions[i * 3 + 2] = -y * w.cellSizeM;
      terrainColour({ materialId: w.materialId[i], sedimentM: w.looseSedimentThicknessM[i], slope: Math.hypot(sx, sy), aboveSeaM: surface[i] - w.seaLevelM, reliefM: relief }, colours, i * 3);
    }
  const indices = new Uint32Array((w.width - 1) * (w.height - 1) * 6);
  let k = 0;
  for (let y = 0; y < w.height - 1; y++)
    for (let x = 0; x < w.width - 1; x++) {
      const a = y * w.width + x;
      const b = a + 1;
      const c = a + w.width;
      const d = c + 1;
      if ((x + y) & 1) indices.set([a, b, d, a, d, c], k);
      else indices.set([a, b, c, b, d, c], k);
      k += 6;
    }
  return { positions, colours, indices };
}
