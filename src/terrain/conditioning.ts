/**
 * Hydrological conditioning: priority-flood depression filling with an epsilon gradient
 * (Barnes, Lehman & Mulla 2014). Every cell gets a strictly descending path to an outlet
 * (map edge or sea cell). Used at generation time, where filled volume is added as loose
 * sediment (alluvium), so it is a physical deposit rather than invisible smoothing.
 */
class MinHeap {
  private k: number[] = [];
  private v: number[] = [];
  get size() {
    return this.k.length;
  }
  push(key: number, val: number) {
    const k = this.k;
    const v = this.v;
    let i = k.length;
    k.push(key);
    v.push(val);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (k[p] <= key) break;
      k[i] = k[p];
      v[i] = v[p];
      i = p;
    }
    k[i] = key;
    v[i] = val;
  }
  pop(): number {
    const k = this.k;
    const v = this.v;
    const top = v[0];
    const lk = k.pop()!;
    const lv = v.pop()!;
    const n = k.length;
    if (n > 0) {
      let i = 0;
      for (;;) {
        let c = 2 * i + 1;
        if (c >= n) break;
        if (c + 1 < n && k[c + 1] < k[c]) c++;
        if (k[c] >= lk) break;
        k[i] = k[c];
        v[i] = v[c];
        i = c;
      }
      k[i] = lk;
      v[i] = lv;
    }
    return top;
  }
}

/**
 * Returns a copy of `z` with all depressions filled so each cell drains. `isOutlet(i)` marks
 * cells that act as drains (in addition to the map border when `borderOutlets`).
 * `epsilon` (m) is the minimum rise imposed per cell across filled flats.
 */
export function fillDepressions(
  z: Float32Array,
  width: number,
  height: number,
  epsilon: number,
  isOutlet: (i: number) => boolean = () => false,
  borderOutlets = true,
): Float32Array {
  const n = width * height;
  const out = new Float32Array(z);
  const done = new Uint8Array(n);
  const heap = new MinHeap();
  for (let i = 0; i < n; i++) {
    const x = i % width;
    const y = (i / width) | 0;
    const border = x === 0 || y === 0 || x === width - 1 || y === height - 1;
    if ((borderOutlets && border) || isOutlet(i)) {
      done[i] = 1;
      heap.push(out[i], i);
    }
  }
  if (heap.size === 0) {
    // No outlet at all: drain to the global minimum.
    let m = 0;
    for (let i = 1; i < n; i++) if (out[i] < out[m]) m = i;
    done[m] = 1;
    heap.push(out[m], m);
  }
  const DX = [1, -1, 0, 0, 1, 1, -1, -1];
  const DY = [0, 0, 1, -1, 1, -1, 1, -1];
  while (heap.size) {
    const c = heap.pop();
    const cx = c % width;
    const cy = (c / width) | 0;
    const zc = out[c];
    for (let k = 0; k < 8; k++) {
      const nx = cx + DX[k];
      const ny = cy + DY[k];
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const j = ny * width + nx;
      if (done[j]) continue;
      done[j] = 1;
      // Raise to at least the spill level plus epsilon (in float32-representable steps).
      const minZ = Math.fround(zc + epsilon);
      if (out[j] < minZ) out[j] = minZ;
      heap.push(out[j], j);
    }
  }
  return out;
}
