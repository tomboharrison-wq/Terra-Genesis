import type { WorldState } from '../engine/world';

/**
 * Export encoders (spec F7): PNG (8-bit RGBA or 16-bit greyscale, written here so the heightmap keeps
 * all 16 bits), heightmaps and raw float32 elevation with metadata. Pure functions, tested by decoding.
 *
 * Orientation: images put north at the top (image row 0 = world row H − 1), so they read like a map.
 * The .raw file keeps the world's own order (index i = y·width + x, x east, y north, row 0 = south),
 * which the .json metadata states.
 */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(bytes: Uint8Array, start = 0, end = bytes.length): number {
  let c = 0xffffffff;
  for (let i = start; i < end; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

async function zlib(bytes: Uint8Array, inflate = false): Promise<Uint8Array> {
  const s = inflate ? new DecompressionStream('deflate') : new CompressionStream('deflate');
  const out = new Blob([bytes as BlobPart]).stream().pipeThrough(s);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  for (let k = 0; k < 4; k++) out[4 + k] = type.charCodeAt(k);
  out.set(data, 8);
  dv.setUint32(8 + data.length, crc32(out, 4, 8 + data.length));
  return out;
}

const latin1 = (s: string) => Uint8Array.from(s, (c) => c.charCodeAt(0) & 0xff);
export const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

/**
 * Encode a PNG. `kind` 'rgba8': data = width·height·4 bytes; 'grey16': data = width·height values.
 * Rows are written top to bottom as given, filter type 0. `text` adds tEXt chunks (Latin-1).
 */
export async function encodePng(
  width: number,
  height: number,
  kind: 'rgba8' | 'grey16',
  data: Uint8Array | Uint16Array,
  text: Record<string, string> = {},
): Promise<Uint8Array> {
  const bpp = kind === 'rgba8' ? 4 : 2;
  const stride = width * bpp + 1;
  const raw = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) {
    const o = y * stride;
    raw[o] = 0; // filter: none
    if (kind === 'rgba8') raw.set((data as Uint8Array).subarray(y * width * 4, (y + 1) * width * 4), o + 1);
    else
      for (let x = 0; x < width; x++) {
        const v = (data as Uint16Array)[y * width + x];
        raw[o + 1 + 2 * x] = v >> 8; // PNG is big-endian
        raw[o + 2 + 2 * x] = v & 0xff;
      }
  }
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, width);
  dv.setUint32(4, height);
  ihdr[8] = kind === 'rgba8' ? 8 : 16; // bit depth
  ihdr[9] = kind === 'rgba8' ? 6 : 0; // colour type: RGBA / greyscale
  const parts = [Uint8Array.from(PNG_SIGNATURE), chunk('IHDR', ihdr)];
  for (const [k, v] of Object.entries(text)) parts.push(chunk('tEXt', latin1(`${k}\0${v}`)));
  parts.push(chunk('IDAT', await zlib(raw)), chunk('IEND', new Uint8Array(0)));
  const out = new Uint8Array(parts.reduce((a, p) => a + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

/** Decode a PNG written by encodePng (filter 0 only) — used by tests and the e2e check. */
export async function decodePng(
  bytes: Uint8Array,
): Promise<{
  width: number;
  height: number;
  depth: number;
  colourType: number;
  pixels: Uint8Array | Uint16Array;
  text: Record<string, string>;
  crcOk: boolean;
}> {
  for (let k = 0; k < 8; k++) if (bytes[k] !== PNG_SIGNATURE[k]) throw new Error('Not a PNG');
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let o = 8;
  let width = 0;
  let height = 0;
  let depth = 0;
  let colourType = 0;
  let crcOk = true;
  const idat: Uint8Array[] = [];
  const text: Record<string, string> = {};
  while (o < bytes.length) {
    const len = dv.getUint32(o);
    const type = String.fromCharCode(...bytes.subarray(o + 4, o + 8));
    const data = bytes.subarray(o + 8, o + 8 + len);
    if (dv.getUint32(o + 8 + len) !== crc32(bytes, o + 4, o + 8 + len)) crcOk = false;
    if (type === 'IHDR') {
      width = dv.getUint32(o + 8);
      height = dv.getUint32(o + 12);
      depth = data[8];
      colourType = data[9];
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'tEXt') {
      const z = data.indexOf(0);
      text[String.fromCharCode(...data.subarray(0, z))] = String.fromCharCode(...data.subarray(z + 1));
    }
    o += 12 + len;
    if (type === 'IEND') break;
  }
  const joined = new Uint8Array(idat.reduce((a, d) => a + d.length, 0));
  let p = 0;
  for (const d of idat) {
    joined.set(d, p);
    p += d.length;
  }
  const raw = await zlib(joined, true);
  const bpp = colourType === 6 ? 4 : 2;
  const stride = width * bpp + 1;
  if (colourType === 6) {
    const px = new Uint8Array(width * height * 4);
    for (let y = 0; y < height; y++) px.set(raw.subarray(y * stride + 1, (y + 1) * stride), y * width * 4);
    return { width, height, depth, colourType, pixels: px, text, crcOk };
  }
  const px = new Uint16Array(width * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) px[y * width + x] = (raw[y * stride + 1 + 2 * x] << 8) | raw[y * stride + 2 + 2 * x];
  return { width, height, depth, colourType, pixels: px, text, crcOk };
}

/** Surface → 16-bit heightmap (north at the top): 0 = lowest, 65535 = highest point on the map. */
export function heightmap16(surface: Float32Array, W: number, H: number): { pixels: Uint16Array; minM: number; maxM: number } {
  let min = Infinity;
  let max = -Infinity;
  for (const z of surface) {
    if (z < min) min = z;
    if (z > max) max = z;
  }
  const span = max > min ? max - min : 1;
  const px = new Uint16Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) px[(H - 1 - y) * W + x] = Math.round(((surface[y * W + x] - min) / span) * 65535);
  return { pixels: px, minM: min, maxM: max };
}

/** Surface as little-endian float32 bytes in world order (row 0 = south). */
export function rawFloat32(surface: Float32Array): Uint8Array {
  const out = new Uint8Array(surface.length * 4);
  const dv = new DataView(out.buffer);
  for (let i = 0; i < surface.length; i++) dv.setFloat32(i * 4, surface[i], true);
  return out;
}

/** Metadata that goes with a heightmap / raw export. */
export function heightmapMeta(w: WorldState, minM: number, maxM: number) {
  return {
    generator: 'Terra Genesis',
    name: w.meta.name,
    width: w.width,
    height: w.height,
    cellSizeM: w.cellSizeM,
    minElevationM: minM,
    maxElevationM: maxM,
    seaLevelM: w.seaLevelM,
    simTimeSeconds: w.simTimeSeconds,
    surface: 'bedrock + loose sediment (no water, ice or lava)',
    png: '16-bit greyscale, north at the top; elevation = min + value / 65535 × (max − min)',
    raw: 'float32 little-endian metres, index = y × width + x, x east, y north (first row = south edge)',
  };
}
