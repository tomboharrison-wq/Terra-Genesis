import type { WorldState } from '../../engine/world';
import { COAST_Y, DEPTH_M, NX, NY, ShorelineModel } from '../../local/shoreline/model';

export interface DetailedShorelineResult {
  centre: number;
  days: number;
  movedM3: number;
  changedCells: number;
  builtCells: number;
  erodedCells: number;
  beforeM3: number;
  afterM3: number;
}

const surfaceAt = (w: WorldState, i: number) => w.bedrockElevationM[i] + w.looseSedimentThicknessM[i];

/** Find the sandy coastal cell with the largest nearby loose-sediment store. */
export function findSandyCoast(w: WorldState): number {
  const W = w.width;
  const H = w.height;
  const sl = w.seaLevelM;
  let best = -1;
  let bestSand = 0;
  for (let y = 2; y < H - 2; y++)
    for (let x = 2; x < W - 2; x++) {
      const i = y * W + x;
      if (surfaceAt(w, i) < sl) continue;
      const coastal = surfaceAt(w, i - 1) < sl || surfaceAt(w, i + 1) < sl || surfaceAt(w, i - W) < sl || surfaceAt(w, i + W) < sl;
      if (!coastal) continue;
      let sand = 0;
      for (let dy = -5; dy <= 5; dy++)
        for (let dx = -5; dx <= 5; dx++) sand += w.looseSedimentThicknessM[(y + dy) * W + x + dx];
      if (sand > bestSand) {
        bestSand = sand;
        best = i;
      }
    }
  return bestSand > 0.5 ? best : -1;
}

/** Cardinal seaward direction from the local land/sea mask. */
function seawardAxis(w: WorldState, centre: number): [number, number] {
  const W = w.width;
  const x = centre % W;
  const y = (centre / W) | 0;
  const sl = w.seaLevelM;
  let gx = 0;
  let gy = 0;
  for (let dy = -3; dy <= 3; dy++)
    for (let dx = -3; dx <= 3; dx++) {
      if (!dx && !dy) continue;
      const xx = x + dx;
      const yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= w.width || yy >= w.height) continue;
      const sea = surfaceAt(w, yy * W + xx) < sl ? 1 : -1;
      const d = Math.hypot(dx, dy);
      gx += (sea * dx) / d;
      gy += (sea * dy) / d;
    }
  return Math.abs(gx) >= Math.abs(gy) ? [gx >= 0 ? 1 : -1, 0] : [0, gy >= 0 ? 1 : -1];
}

/**
 * Run the detailed one-line shoreline model on a sampled patch of the real world, then transfer its
 * conservative sand redistribution back into authoritative loose-sediment thickness. Bedrock is
 * never removed. If the model asks for more sand than the beach holds, all deposition is scaled to
 * the volume actually removed, so the world sediment ledger closes exactly.
 */
export function evolveDetailedShoreline(w: WorldState, centre = findSandyCoast(w), days = 3650): DetailedShorelineResult | null {
  if (centre < 0 || days <= 0) return null;
  const W = w.width;
  const H = w.height;
  const cx = centre % W;
  const cy = (centre / W) | 0;
  const [nx, ny] = seawardAxis(w, centre);
  const tx = -ny;
  const ty = nx;
  const map = new Int32Array(NX * NY).fill(-1);
  const fill = new Float64Array(NX * NY);
  for (let ly = 0; ly < NY; ly++)
    for (let lx = 0; lx < NX; lx++) {
      const wx = cx + (lx - (NX >> 1)) * tx + (ly - COAST_Y) * nx;
      const wy = cy + (lx - (NX >> 1)) * ty + (ly - COAST_Y) * ny;
      const k = ly * NX + lx;
      if (wx < 0 || wy < 0 || wx >= W || wy >= H) {
        fill[k] = ly < COAST_Y ? 1 : 0;
        continue;
      }
      const i = wy * W + wx;
      map[k] = i;
      const z = surfaceAt(w, i);
      fill[k] = z >= w.seaLevelM ? 1 : 0;
    }

  const waveRad = (w.coast.waveFromDeg * Math.PI) / 180;
  const waveX = Math.sin(waveRad);
  const waveY = Math.cos(waveRad);
  const along = waveX * tx + waveY * ty;
  const normal = Math.abs(waveX * nx + waveY * ny);
  const model = new ShorelineModel({
    asymmetry: along >= 0 ? 0.82 : 0.18,
    highness: Math.min(0.8, Math.max(0.05, 1 - normal)),
    qMaxM3: Math.max(250, 1500 * Math.pow(Math.max(0.25, w.coast.waveHeightM / 2), 2.5)),
    // Boundary feed lets the nested model express a complete alongshore transport pathway; the
    // transfer back to the world is closed by scaling deposits to sand actually removed in-patch.
    supply: true,
    seed: w.seed ^ centre,
    layout: 'bay',
  });
  model.loadFill(fill);
  const f0 = model.f.slice();
  // The local model uses 50 m cells; adjust duration to the real world's active-shoreface volume.
  const volumeScale = (50 * 50 * DEPTH_M) / (w.cellSizeM * w.cellSizeM * DEPTH_M);
  model.step(Math.max(1, Math.round(days * volumeScale)));

  const A = w.cellSizeM * w.cellSizeM;
  const dv = new Map<number, number>();
  for (let k = 0; k < map.length; k++) {
    const i = map[k];
    if (i < 0) continue;
    const delta = (model.f[k] - f0[k]) * A * DEPTH_M;
    if (Math.abs(delta) > 1e-6) dv.set(i, (dv.get(i) ?? 0) + delta);
  }

  let removed = 0;
  const removedBy = new Map<number, number>();
  const positive: [number, number][] = [];
  let positiveWant = 0;
  for (const [i, vol] of dv) {
    if (vol < 0) {
      const take = Math.min(-vol, w.looseSedimentThicknessM[i] * A);
      if (take > 0) {
        removedBy.set(i, take);
        removed += take;
      }
    } else if (vol > 0) {
      positive.push([i, vol]);
      positiveWant += vol;
    }
  }
  if (removed <= 1 || positiveWant <= 0) return null;

  let builtCells = 0;
  let erodedCells = 0;
  let beforeM3 = 0;
  for (const v of w.looseSedimentThicknessM) beforeM3 += v * A;
  for (const [i, vol] of removedBy) {
    w.looseSedimentThicknessM[i] = Math.max(0, w.looseSedimentThicknessM[i] - vol / A);
    erodedCells++;
  }
  let deposited = 0;
  for (let k = 0; k < positive.length; k++) {
    const [i, want] = positive[k];
    const put = k === positive.length - 1 ? removed - deposited : removed * (want / positiveWant);
    w.looseSedimentThicknessM[i] += put / A;
    deposited += put;
    builtCells++;
  }
  let afterM3 = 0;
  for (const v of w.looseSedimentThicknessM) afterM3 += v * A;
  return {
    centre,
    days,
    movedM3: removed,
    changedCells: builtCells + erodedCells,
    builtCells,
    erodedCells,
    beforeM3,
    afterM3,
  };
}
