import { describe, expect, it } from 'vitest';
import { encodeWorld, decodeWorld, worldToFileBytes, worldFromFileBytes, readHeader } from '../src/persistence/format';
import { generateWorld, defaultOptions } from '../src/terrain/generate';
import { Engine } from '../src/engine/engine';

describe('world file format', () => {
  it('round-trips all physical fields bit-exactly (uncompressed)', () => {
    const w = generateWorld(defaultOptions('coastal-headland', 21, 50));
    w.simTimeSeconds = 1234.5;
    const back = decodeWorld(encodeWorld(w, { camera: { a: 1 } }));
    expect(back.world.bedrockElevationM).toEqual(w.bedrockElevationM);
    expect(back.world.looseSedimentThicknessM).toEqual(w.looseSedimentThicknessM);
    expect(back.world.materialId).toEqual(w.materialId);
    expect(back.world.meta).toEqual(w.meta);
    expect(back.world.simTimeSeconds).toBe(1234.5);
    expect(back.extras).toEqual({ camera: { a: 1 } });
  });

  it('round-trips through gzip and compresses', async () => {
    const w = generateWorld(defaultOptions('river-basin', 4, 128));
    const raw = encodeWorld(w);
    const file = await worldToFileBytes(w);
    expect(file[0]).toBe(0x1f);
    expect(file.length).toBeLessThan(raw.length);
    const back = await worldFromFileBytes(file);
    expect(back.world.bedrockElevationM).toEqual(w.bedrockElevationM);
  });

  it('edited world reloads and remains editable', async () => {
    const e = new Engine(generateWorld(defaultOptions('island', 8, 64)));
    e.beginStroke({ kind: 'raise', radiusM: 200, rate: 50, hardness: 0 }, 900, 900);
    e.strokeStep(900, 900, 1);
    e.endStroke();
    const back = await worldFromFileBytes(await worldToFileBytes(e.world));
    expect(back.world.bedrockElevationM).toEqual(e.world.bedrockElevationM);
    const e2 = new Engine(back.world);
    e2.beginStroke({ kind: 'lower', radiusM: 200, rate: 10, hardness: 0 }, 900, 900);
    e2.strokeStep(900, 900, 1);
    e2.endStroke();
    expect(e2.history.canUndo).toBe(true);
  });

  it('rejects garbage, truncation and newer versions', () => {
    expect(() => decodeWorld(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]))).toThrow(/Not a Terra Genesis/);
    const good = encodeWorld(generateWorld(defaultOptions('flat', 1, 16)));
    expect(() => decodeWorld(good.subarray(0, good.length - 10))).toThrow(/Truncated/);
    const { header } = readHeader(good);
    const json = JSON.stringify({ ...header, formatVersion: 99 });
    const hb = new TextEncoder().encode(json);
    const bad = new Uint8Array(8 + hb.length);
    bad.set(good.subarray(0, 4));
    new DataView(bad.buffer).setUint32(4, hb.length, true);
    bad.set(hb, 8);
    expect(() => decodeWorld(bad)).toThrow(/newer version/);
  });
});
