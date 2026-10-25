import type { WorldState } from '../engine/world';
import { d8Receivers, flowAccumulation } from '../renderer/overlays';

/**
 * Drainage-basin features found in the simulated landscape (spec G3: "labels … attached to actual
 * locations"). Everything is derived from D8 flow routing on the current ground surface: nothing is
 * placed by hand, so the labels move if the landscape changes.
 */
export interface Feature {
  kind: 'mouth' | 'source' | 'confluence' | 'tributary' | 'main-river' | 'watershed';
  xM: number;
  yM: number;
  /** Supporting measurement, e.g. upstream area (m²) or height (m). */
  value: number;
}

export interface Basin {
  features: Feature[];
  /** 1 on cells that drain to the mouth. */
  basin: Uint8Array;
  /** 1 on channel cells (upstream area ≥ channel threshold). */
  channel: Uint8Array;
  acc: Float32Array;
  areaM2: number;
}

/**
 * Find the largest drainage basin and its features. A cell is part of a channel when at least
 * `channelFrac` of the map's area drains through it (the threshold at which a permanent stream is
 * drawn; a modelling choice, stated in the lesson).
 */
export function findBasin(w: WorldState, surface: Float32Array, channelFrac = 0.004): Basin {
  const W = w.width;
  const H = w.height;
  const cs = w.cellSizeM;
  const n = W * H;
  const isSea = (i: number) => surface[i] < w.seaLevelM;
  const rec = d8Receivers(surface, W, H, cs, isSea);
  const acc = flowAccumulation(surface, W, H, cs, isSea, rec);
  const at = (i: number) => ({ xM: (i % W) * cs, yM: ((i / W) | 0) * cs });
  // Mouth: the outlet (cell whose flow leaves the land: no receiver, or a sea receiver) with most area.
  let mouth = 0;
  for (let i = 0; i < n; i++) {
    if (isSea(i)) continue;
    const r = rec[i];
    const outlet = r < 0 || isSea(r);
    if (outlet && acc[i] > acc[mouth]) mouth = i;
  }
  const thr = Math.max(50 * cs * cs, channelFrac * n * cs * cs);
  const channel = new Uint8Array(n);
  for (let i = 0; i < n; i++) channel[i] = acc[i] >= thr && !isSea(i) ? 1 : 0;
  // Basin: every cell whose D8 path reaches the mouth (walk down, memoised).
  const basin = new Uint8Array(n); // 0 unknown, 1 in, 2 out
  basin[mouth] = 1;
  const path: number[] = [];
  for (let i = 0; i < n; i++) {
    let j = i;
    path.length = 0;
    while (basin[j] === 0) {
      path.push(j);
      const r = rec[j];
      if (r < 0) {
        basin[j] = j === mouth ? 1 : 2;
        break;
      }
      j = r;
    }
    const v = basin[j];
    for (const p of path) basin[p] = v;
  }
  for (let i = 0; i < n; i++) basin[i] = basin[i] === 1 ? 1 : 0;
  // Upstream channel neighbours of each channel cell, largest first.
  const ups: number[][] = Array.from({ length: n }, () => []);
  for (let i = 0; i < n; i++) if (channel[i] && basin[i] && rec[i] >= 0) ups[rec[i]].push(i);
  for (const u of ups) if (u.length > 1) u.sort((p, q) => acc[q] - acc[p]);
  // Confluence: two channels meet and the smaller brings at least 10 % of the combined flow (so a
  // hillside rill does not count). The largest such meeting is labelled.
  let conf = -1;
  for (let i = 0; i < n; i++) {
    const u = ups[i];
    if (u.length >= 2 && acc[u[1]] >= 0.1 * acc[i] && i !== mouth && (conf < 0 || acc[i] > acc[conf])) conf = i;
  }
  // Source of the main river: from the mouth, walk upstream along the largest channel to its head.
  let source = mouth;
  for (let k = 0; k < n && ups[source].length; k++) source = ups[source][0];
  if (source === mouth) source = -1;
  // Tributary: the smaller channel at the confluence, a few cells upstream of it.
  let trib = -1;
  if (conf >= 0) {
    trib = ups[conf][1];
    for (let k = 0; k < 6 && ups[trib].length; k++) trib = ups[trib][0];
  }
  // Main river: halfway (by cells) along the trunk from the confluence (or source) down to the mouth.
  const trunkStart = conf >= 0 ? conf : source;
  let mainRiver = -1;
  if (trunkStart >= 0) {
    const trunk: number[] = [];
    for (let j = trunkStart; j >= 0 && trunk.length < n; j = rec[j]) {
      trunk.push(j);
      if (j === mouth) break;
    }
    mainRiver = trunk[Math.floor(trunk.length / 2)];
  }
  // Watershed: the highest basin cell on its boundary (on the divide).
  let shed = -1;
  for (let i = 0; i < n; i++) {
    if (!basin[i]) continue;
    const x = i % W;
    const y = (i / W) | 0;
    // On the divide: next to another basin, or on the map edge (the divide continues beyond the map).
    const edge = x === 0 || y === 0 || x === W - 1 || y === H - 1 || !basin[i - 1] || !basin[i + 1] || !basin[i - W] || !basin[i + W];
    if (edge && (shed < 0 || surface[i] > surface[shed])) shed = i;
  }
  const features: Feature[] = [{ kind: 'mouth', ...at(mouth), value: acc[mouth] }];
  if (source >= 0) features.push({ kind: 'source', ...at(source), value: surface[source] });
  if (conf >= 0) features.push({ kind: 'confluence', ...at(conf), value: acc[conf] });
  if (trib >= 0) features.push({ kind: 'tributary', ...at(trib), value: acc[trib] });
  if (mainRiver >= 0 && mainRiver !== mouth)
    features.push({
      kind: 'main-river',
      ...at(mainRiver),
      value: acc[mainRiver],
    });
  if (shed >= 0) features.push({ kind: 'watershed', ...at(shed), value: surface[shed] });
  let area = 0;
  for (let i = 0; i < n; i++) area += basin[i];
  return { features, basin, channel, acc, areaM2: area * cs * cs };
}
