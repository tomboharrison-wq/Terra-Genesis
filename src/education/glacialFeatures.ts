import type { WorldState } from '../engine/world';
import { LandscapeEvolution } from '../sim/geology/landscapeEvolution';

/**
 * Glacial landforms found in the simulated landscape after the ice has gone, by comparing the land
 * with how it was before the ice age (`pre`, the surface at the start of glaciation) and with the
 * greatest ice cover reached (`iceMax`, m). Everything here is measured; nothing is placed by hand.
 */
const surf = (w: WorldState, i: number) => w.bedrockElevationM[i] + w.looseSedimentThicknessM[i];
const xy = (w: WorldState, i: number) => ({ xM: (i % w.width) * w.cellSizeM, yM: ((i / w.width) | 0) * w.cellSizeM });
const BEARINGS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
/** Compass name of a direction (dx east, dy north). */
export const compass = (dx: number, dy: number) => BEARINGS[Math.round((((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360) / 45) % 8];

export interface ValleySection {
  floorM: number;
  /** Steepest part of the valley sides (°), mean of both sides. */
  sideDeg: number;
  depthM: number;
}

/** Cross-valley profile through cell c, perpendicular to (dx, dy), on surface z (floor = within 10 m of the lowest point). */
export function section(w: WorldState, z: ArrayLike<number>, c: number, dx: number, dy: number, reachM = 1500): ValleySection {
  const W = w.width;
  const H = w.height;
  const cs = w.cellSizeM;
  const cx = c % W;
  const cy = (c / W) | 0;
  const L = Math.hypot(dx, dy) || 1;
  const px = -dy / L;
  const py = dx / L;
  const samples: { d: number; z: number }[] = [];
  for (let d = -reachM; d <= reachM; d += cs / 2) {
    const x = Math.round(cx + (px * d) / cs);
    const y = Math.round(cy + (py * d) / cs);
    if (x < 0 || y < 0 || x >= W || y >= H) continue;
    samples.push({ d, z: z[y * W + x] });
  }
  let lo = samples[0];
  for (const s of samples) if (Math.abs(s.d) < 300 && s.z < lo.z) lo = s;
  let floorL = lo.d;
  let floorR = lo.d;
  for (const s of samples) if (s.z - lo.z <= 10 && Math.abs(s.d - lo.d) < 400) (floorL = Math.min(floorL, s.d)), (floorR = Math.max(floorR, s.d));
  const side = (sgn: number) => {
    let crest = lo.z;
    let crestD = 0;
    for (const s of samples) if (Math.sign(s.d - lo.d) === sgn && s.z > crest) (crest = s.z), (crestD = Math.abs(s.d - lo.d));
    // Valley-side steepness: the steepest rise over two cells between the floor and the crest.
    const sideS = samples.filter((s) => Math.sign(s.d - lo.d) === sgn && Math.abs(s.d - lo.d) <= crestD).sort((a, b) => Math.abs(a.d - lo.d) - Math.abs(b.d - lo.d));
    let steep = 0;
    for (let k = 4; k < sideS.length; k++) steep = Math.max(steep, (sideS[k].z - sideS[k - 4].z) / Math.max(cs, Math.abs(sideS[k].d - sideS[k - 4].d)));
    return { crest, crestD, slope: (Math.atan(steep) * 180) / Math.PI };
  };
  const l = side(-1);
  const r = side(1);
  return { floorM: floorR - floorL + cs, sideDeg: (l.slope + r.slope) / 2, depthM: Math.min(l.crest, r.crest) - lo.z };
}

export interface GlacialFeatures {
  trough: { cell: number; before: ValleySection; after: ValleySection; deepenedM: number } | null;
  corries: { cell: number; facing: string; tarnM: number }[];
  arete: { cell: number; sideDeg: number } | null;
  peak: { cell: number; corries: number } | null;
  hanging: { cell: number; dropM: number } | null;
  moraine: { cell: number; thickM: number } | null;
  ribbon: { cell: number; lengthM: number; depthM: number } | null;
}

/**
 * Find the glacial landforms. `pre`: surface before the ice age; `iceMax`: thickest ice each cell had;
 * `moraineM`: debris the ice left behind (m).
 */
export function findGlacialFeatures(w: WorldState, pre: Float32Array, iceMax: Float32Array, moraineM: ArrayLike<number>, snowlineM: number, glacialM: ArrayLike<number>): GlacialFeatures {
  const W = w.width;
  const H = w.height;
  const n = W * H;
  const cs = w.cellSizeM;
  const z = new Float32Array(n);
  for (let i = 0; i < n; i++) z[i] = surf(w, i);
  const geo = new LandscapeEvolution(w);
  geo.route();
  const lakeD = (i: number) => geo.lake[i] - z[i];
  const glaciated = (i: number) => iceMax[i] > 20;

  // Glacial trough: where the ice wore a river valley down most (the per-cell glacial erosion record) —
  // a drainage line under thick ice that was already a valley (≥ 60 m deep) before the ice age.
  const dirOf = (i: number) => {
    const r = geo.receiver[i] >= 0 ? geo.receiver[i] : i;
    return [(r % W) - (i % W) || 0.0001, ((r / W) | 0) - ((i / W) | 0)] as const;
  };
  const cands = Array.from({ length: n }, (_, i) => i)
    .filter((i) => iceMax[i] >= 50 && geo.area[i] >= 60 * cs * cs && lakeD(i) <= 0.5)
    .sort((a, b) => glacialM[b] - glacialM[a])
    .slice(0, 300);
  let tc = -1;
  for (const i of cands) {
    const [dx, dy] = dirOf(i);
    if (section(w, pre, i, dx, dy).depthM >= 60) {
      tc = i;
      break;
    }
  }
  void snowlineM;
  const best = tc >= 0 ? glacialM[tc] : 0;
  let trough: GlacialFeatures['trough'] = null;
  if (tc >= 0) {
    const [dx, dy] = dirOf(tc);
    trough = { cell: tc, before: section(w, pre, tc, dx, dy), after: section(w, z, tc, dx, dy), deepenedM: best };
  }

  // Corries: hollows at glacier heads — the highest glaciated cells on each glacier's flow path with a
  // steep back wall; facing = downhill direction out of the hollow. Tarn = lake in it.
  const corries: GlacialFeatures['corries'] = [];
  const zSorted = Array.from({ length: n }, (_, i) => i).filter((i) => glaciated(i) && iceMax[i] < 120 && pre[i] - z[i] > 30).sort((a, b) => z[b] - z[a]);
  for (const i of zSorted) {
    if (corries.length >= 6) break;
    if (corries.some((c) => Math.hypot((c.cell % W) - (i % W), ((c.cell / W) | 0) - ((i / W) | 0)) * cs < 1200)) continue;
    // Back wall: ground ≥ 150 m higher within 600 m uphill.
    const x = i % W;
    const y = (i / W) | 0;
    let wallDx = 0;
    let wallDy = 0;
    let wall = 0;
    const R = Math.round(600 / cs);
    for (let yy = Math.max(0, y - R); yy <= Math.min(H - 1, y + R); yy++)
      for (let xx = Math.max(0, x - R); xx <= Math.min(W - 1, x + R); xx++) {
        const rise = z[yy * W + xx] - z[i];
        if (rise > wall) (wall = rise), (wallDx = xx - x), (wallDy = yy - y);
      }
    if (wall < 150) continue;
    // The hollow opens away from its back wall.
    corries.push({ cell: i, facing: compass(-wallDx, -wallDy), tarnM: Math.max(0, lakeD(i)) });
  }

  // Arête: the highest point on the line between two corries, if it is a narrow ridge (both sides steep).
  let arete: GlacialFeatures['arete'] = null;
  for (let a = 0; a < corries.length && !arete; a++)
    for (let b = a + 1; b < corries.length && !arete; b++) {
      const ia = corries[a].cell;
      const ib = corries[b].cell;
      const dist = Math.hypot((ia % W) - (ib % W), ((ia / W) | 0) - ((ib / W) | 0)) * cs;
      if (dist > 3000) continue;
      let top = -1;
      for (let t = 0.2; t <= 0.8; t += 0.02) {
        const x = Math.round((ia % W) + ((ib % W) - (ia % W)) * t);
        const y = Math.round(((ia / W) | 0) + (((ib / W) | 0) - ((ia / W) | 0)) * t);
        const k = y * W + x;
        if (top < 0 || z[k] > z[top]) top = k;
      }
      const sa = Math.atan((z[top] - z[ia]) / Math.max(cs, (dist * 0.5))) * 57.3;
      const sb = Math.atan((z[top] - z[ib]) / Math.max(cs, (dist * 0.5))) * 57.3;
      if (Math.min(sa, sb) > 15) arete = { cell: top, sideDeg: (sa + sb) / 2 };
    }

  // Pyramidal peak: the summit with corries on three or more sides within 2 km.
  let peak: GlacialFeatures['peak'] = null;
  let top = 0;
  for (let i = 0; i < n; i++) if (z[i] > z[top]) top = i;
  {
    const sides = new Set<string>();
    for (const c of corries) {
      const d = Math.hypot((c.cell % W) - (top % W), ((c.cell / W) | 0) - ((top / W) | 0)) * cs;
      if (d < 2000) sides.add(compass((c.cell % W) - (top % W), ((c.cell / W) | 0) - ((top / W) | 0)));
    }
    if (sides.size >= 3) peak = { cell: top, corries: sides.size };
  }

  // Hanging valley: where a tributary joins the trough, the tributary floor ends high above it.
  let hanging: GlacialFeatures['hanging'] = null;
  for (let i = 0; i < n; i++) {
    const r = geo.receiver[i];
    if (r < 0 || !glaciated(r) || geo.area[i] < 40 * cs * cs || geo.area[r] < 4 * geo.area[i]) continue;
    // i is a tributary channel cell draining into a much bigger glaciated valley: drop over the last 400 m.
    let up = i;
    for (let k = 0; k < Math.round(400 / cs); k++) {
      const x = up % W;
      const y = (up / W) | 0;
      let nb = -1;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const xn = x + dx;
          const yn = y + dy;
          if (xn < 0 || yn < 0 || xn >= W || yn >= H) continue;
          const j = yn * W + xn;
          if (geo.receiver[j] === up && (nb < 0 || geo.area[j] > geo.area[nb])) nb = j;
        }
      if (nb < 0) break;
      up = nb;
    }
    const drop = z[up] - z[r];
    if (drop > 60 && (!hanging || drop > hanging.dropM)) hanging = { cell: i, dropM: drop };
  }

  // Moraine: the thickest debris left behind by the ice (recorded as it was dropped), not in a lake.
  let moraine: GlacialFeatures['moraine'] = null;
  for (let i = 0; i < n; i++) {
    if (lakeD(i) > 0.5) continue;
    const thick = Math.min(moraineM[i], w.looseSedimentThicknessM[i]);
    if (thick > 3 && (!moraine || thick > moraine.thickM)) moraine = { cell: i, thickM: thick };
  }

  // Ribbon lake: the longest lake in a glaciated valley.
  let ribbon: GlacialFeatures['ribbon'] = null;
  const seen = new Uint8Array(n);
  for (let i0 = 0; i0 < n; i0++) {
    if (seen[i0] || lakeD(i0) <= 0.5 || !glaciated(i0)) continue;
    const stack = [i0];
    seen[i0] = 1;
    const cells: number[] = [];
    while (stack.length) {
      const i = stack.pop()!;
      cells.push(i);
      const x = i % W;
      const y = (i / W) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const xn = x + dx;
        const yn = y + dy;
        if (xn < 0 || yn < 0 || xn >= W || yn >= H) continue;
        const j = yn * W + xn;
        if (!seen[j] && lakeD(j) > 0.5) (seen[j] = 1), stack.push(j);
      }
    }
    let len = 0;
    let deep = cells[0];
    for (const a of cells) {
      if (lakeD(a) > lakeD(deep)) deep = a;
      for (const b of cells) len = Math.max(len, Math.hypot((a % W) - (b % W), ((a / W) | 0) - ((b / W) | 0)) * cs);
      if (cells.length > 400) break;
    }
    // A ribbon lake is long and deep (≥ 0.5 km, ≥ 5 m): smaller ponds are not labelled as one.
    if (len + cs >= 500 && lakeD(deep) >= 5 && (!ribbon || len > ribbon.lengthM)) ribbon = { cell: deep, lengthM: len + cs, depthM: lakeD(deep) };
  }

  return { trough, corries, arete, peak, hanging, moraine, ribbon };
}

export const at = xy;
