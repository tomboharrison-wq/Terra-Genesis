import { describe, expect, it } from 'vitest';
import { decodeWorld, encodeWorld, readHeader, type FileHeader } from '../src/persistence/format';
import { validateWorld, WORLD_FORMAT_VERSION } from '../src/engine/world';
import { Engine } from '../src/engine/engine';
import { generateWorld, defaultOptions } from '../src/terrain/generate';

/** What each format version added (fields and header sections), per the format.ts history. */
const ADDED: Record<number, { fields: string[]; header: (keyof FileHeader)[] }> = {
  1: { fields: ['bedrockElevationM', 'looseSedimentThicknessM', 'materialId'], header: [] },
  2: { fields: ['waterDepthM', 'waterFluxM3PerS'], header: ['water'] },
  3: { fields: ['sedimentSuspendedM'], header: ['erosion'] },
  4: { fields: ['strataBoundsM', 'strataMaterial'], header: ['coast'] },
  5: { fields: [], header: ['climate'] },
  6: { fields: ['snowSweM'], header: [] },
  7: { fields: ['iceThicknessM', 'iceDebrisM'], header: ['glacier'] },
  8: { fields: ['vegCover'], header: ['vegetation'] },
  9: { fields: ['plateId'], header: ['tectonics'] },
  10: { fields: ['lavaDepthM', 'lavaTempC', 'lavaKind'], header: ['lava'] },
  11: { fields: ['tephraM'], header: [] },
};

/** Rewrite a current file as version `v` would have written it (only the fields and sections it knew). */
function downgrade(bytes: Uint8Array, v: number): Uint8Array {
  const { header, dataStart } = readHeader(bytes);
  const keepF = new Set<string>();
  const keepH = new Set<string>();
  for (let k = 1; k <= v; k++) {
    ADDED[k].fields.forEach((f) => keepF.add(f));
    ADDED[k].header.forEach((h) => keepH.add(h));
  }
  const h: Record<string, unknown> = { ...header, formatVersion: v };
  for (let k = v + 1; k <= 11; k++) for (const s of ADDED[k].header) if (!keepH.has(s)) delete h[s];
  const align4 = (n: number) => (n + 3) & ~3;
  const parts: { f: FileHeader['fields'][number]; data: Uint8Array }[] = [];
  let off = 0;
  for (const f of header.fields)
    if (keepF.has(f.name)) {
      parts.push({ f: { ...f, offset: off }, data: bytes.subarray(dataStart + f.offset, dataStart + f.offset + f.byteLength) });
      off = align4(off + f.byteLength);
    }
  h.fields = parts.map((p) => p.f);
  const hb = new TextEncoder().encode(JSON.stringify(h));
  const start = align4(8 + hb.length);
  const out = new Uint8Array(start + off);
  out.set(new TextEncoder().encode('TGW1'), 0);
  new DataView(out.buffer).setUint32(4, hb.length, true);
  out.set(hb, 8);
  for (const p of parts) out.set(p.data, start + p.f.offset);
  return out;
}

describe('M11-C04 saving: every older format version still loads', () => {
  it('v1 … v11 files decode to valid, runnable worlds with migrated defaults', () => {
    expect(WORLD_FORMAT_VERSION).toBe(11);
    const w = generateWorld(defaultOptions('river-basin', 7, 64));
    w.water.rainMPerS = 1e-6;
    w.waterDepthM.fill(0.2);
    w.snowSweM.fill(0.01);
    const bytes = encodeWorld(w);
    for (let v = 1; v <= 11; v++) {
      const back = decodeWorld(downgrade(bytes, v)).world;
      expect(validateWorld(back), `v${v}`).toEqual([]);
      expect(Array.from(back.bedrockElevationM)).toEqual(Array.from(w.bedrockElevationM));
      expect(back.waterDepthM[0], `v${v} water`).toBe(v >= 2 ? Math.fround(0.2) : 0);
      expect(back.snowSweM[0], `v${v} snow`).toBe(v >= 6 ? Math.fround(0.01) : 0);
      if (v < 5) expect(back.climate.enabled).toBe(false);
      if (v < 9) expect(back.tectonics.enabled).toBe(false);
      const e = new Engine(back);
      e.advance(60);
      expect(Number.isFinite(e.water.storedVolume()), `v${v} runs`).toBe(true);
    }
  });

  it('a file from a newer version is refused with a clear message', () => {
    const bytes = encodeWorld(generateWorld(defaultOptions('flat', 1, 32)));
    const { header } = readHeader(bytes);
    const h = new TextEncoder().encode(JSON.stringify({ ...header, formatVersion: 99 }));
    const out = new Uint8Array(8 + h.length);
    out.set(new TextEncoder().encode('TGW1'));
    new DataView(out.buffer).setUint32(4, h.length, true);
    out.set(h, 8);
    expect(() => decodeWorld(out)).toThrow(/newer version/);
  });
});
