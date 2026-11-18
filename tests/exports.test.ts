import { describe, expect, it } from 'vitest';
import { createWorld } from '../src/engine/world';
import { crc32, decodePng, encodePng, heightmap16, heightmapMeta, rawFloat32 } from '../src/persistence/exports';
import { terrainMeshData } from '../src/persistence/terrainMesh';
import { minecraftHeightmap, minecraftMetadata, minecraftY } from '../src/persistence/minecraft';

describe('M11-C03 exports', () => {
  it('CRC-32 matches the standard check value', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
  });

  it('16-bit heightmap PNG round-trips every value, north at the top, with metadata text', async () => {
    const W = 37;
    const H = 23;
    const z = new Float32Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) z[y * W + x] = -40 + 3.7 * x + 11 * y + Math.sin(x * y);
    const hm = heightmap16(z, W, H);
    const png = await encodePng(W, H, 'grey16', hm.pixels, { 'Terra-Genesis': 'heightmap', minM: String(hm.minM) });
    const d = await decodePng(png);
    expect(d.crcOk).toBe(true);
    expect([d.width, d.height, d.depth, d.colourType]).toEqual([W, H, 16, 0]);
    expect(Array.from(d.pixels)).toEqual(Array.from(hm.pixels));
    expect(d.text.minM).toBe(String(hm.minM));
    // Top-left pixel is the north-west corner of the world; elevation recovered within 1/65535 of the range.
    const span = hm.maxM - hm.minM;
    const back = hm.minM + (d.pixels[0] / 65535) * span;
    expect(Math.abs(back - z[(H - 1) * W])).toBeLessThan(span / 65535 + 1e-6);
    expect(d.pixels.includes(0) && d.pixels.includes(65535)).toBe(true);
  });

  it('RGBA PNG round-trips; float32 raw is exact and little-endian in world order', async () => {
    const px = new Uint8Array(5 * 3 * 4).map((_, i) => (i * 37) & 255);
    const d = await decodePng(await encodePng(5, 3, 'rgba8', px));
    expect(Array.from(d.pixels)).toEqual(Array.from(px));
    const z = Float32Array.from([1.5, -2.25, 1234.125, 0]);
    const raw = rawFloat32(z);
    expect(raw.length).toBe(16);
    expect(Array.from(new Float32Array(raw.buffer))).toEqual(Array.from(z)); // host is little-endian
    const meta = heightmapMeta(createWorld({ width: 16, height: 16, cellSizeM: 30, seed: 1 }), -2.25, 1234.125);
    expect(meta).toMatchObject({ width: 16, height: 16, cellSizeM: 30, minElevationM: -2.25 });
    expect(meta.raw).toMatch(/y north/);
  });

  it('builds a full-resolution, correctly scaled GLB terrain mesh payload', () => {
    const w = createWorld({ width: 5, height: 4, cellSizeM: 30, seed: 1 });
    const surface = new Float32Array(20);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 5; x++) surface[y * 5 + x] = 100 + 2 * x + 3 * y;
    const mesh = terrainMeshData(w, surface);
    expect(mesh.positions).toHaveLength(20 * 3);
    expect(mesh.indices).toHaveLength(4 * 3 * 6);
    expect(mesh.positions[0]).toBe(0);
    expect(mesh.positions[1]).toBe(100);
    expect(Math.abs(mesh.positions[2])).toBe(0);
    expect(Array.from(mesh.positions.slice(-3))).toEqual([120, 117, -90]);
    expect(Math.max(...mesh.indices)).toBe(19);
    expect(mesh.colours.every((v) => Number.isFinite(v) && v >= 0 && v <= 1)).toBe(true);
  });

  it('maps real sea level to Minecraft Y=63 and writes a north-up WorldPainter map', async () => {
    const w = createWorld({ width: 3, height: 2, cellSizeM: 20, seed: 1, seaLevelM: 100 });
    const surface = Float32Array.from([100, 101, 102, 110, 120, 130]);
    expect(minecraftY(100, 100)).toBe(63);
    expect(minecraftY(-1000, 100)).toBe(-64);
    expect(minecraftY(1000, 100)).toBe(319);
    const values = minecraftHeightmap(w, surface);
    expect(values[0]).toBeGreaterThan(values[3]);
    const png = await decodePng(await encodePng(3, 2, 'grey16', values));
    expect(Array.from(png.pixels)).toEqual(Array.from(values));
    expect(minecraftMetadata(w)).toMatchObject({ seaLevelY: 63, minecraftMinY: -64, northAtTop: true });
  });
});
