import { defaultCoastParams, type CoastParams } from '../sim/coast/params';
import { defaultClimateParams, type ClimateParams } from '../sim/climate/climate';
import { defaultGlacierParams, type GlacierParams } from '../sim/glacier/glacierSim';
import { defaultVegetationParams, type VegetationParams } from '../sim/vegetation/vegetationSim';
import { defaultLavaParams, type LavaParams } from '../sim/lava/lavaSim';
import { defaultTectonicsParams, type TectonicsParams } from '../sim/tectonics/plates';
import { WORLD_FORMAT_VERSION, STRATA_BOUNDS, STRATA_LAYERS, setUniformStrata, defaultErosionParams, defaultWaterParams, type ErosionParams, type WaterParams, type WorldMeta, type WorldState } from '../engine/world';

/**
 * Terra Genesis world file (.tgw), format version 1:
 *   bytes 0..3   ASCII "TGW1"
 *   bytes 4..7   uint32 LE header length H
 *   bytes 8..8+H UTF-8 JSON header (FileHeader)
 *   padding to a 4-byte boundary, then raw little-endian field arrays at header offsets.
 * The whole file is gzip-compressed on disk / in IndexedDB (see compress/decompress).
 * v2 adds waterDepthM, waterFluxM3PerS and header.water. v1 files migrate with dry water.
 * v3 adds sedimentSuspendedM and header.erosion. Older files migrate with no suspended load.
 * v4 adds strataBoundsM / strataMaterial. Older files migrate to single-layer columns.
 * v10 adds lavaDepthM, lavaTempC, lavaKind and header.lava. Older files migrate without lava.
 * v9 adds plateId and header.tectonics. Older files migrate with one plate and tectonics off.
 * v8 adds vegCover and header.vegetation. Older files migrate bare.
 * v7 adds iceThicknessM, iceDebrisM and header.glacier. Older files migrate ice-free.
 * v6 adds snowSweM (snowpack). Older files migrate with no snow.
 * v5 adds header.climate. Older files migrate with climate off (uniform rain, as they ran).
 */
const MAGIC = 'TGW1';

type FieldName = 'bedrockElevationM' | 'looseSedimentThicknessM' | 'materialId' | 'waterDepthM' | 'waterFluxM3PerS' | 'sedimentSuspendedM' | 'strataBoundsM' | 'strataMaterial' | 'snowSweM' | 'iceThicknessM' | 'iceDebrisM' | 'vegCover' | 'plateId' | 'lavaDepthM' | 'lavaTempC' | 'lavaKind';
const FIELDS: { name: FieldName; type: 'f32' | 'u8'; perCell: number }[] = [
  { name: 'bedrockElevationM', type: 'f32', perCell: 1 },
  { name: 'looseSedimentThicknessM', type: 'f32', perCell: 1 },
  { name: 'materialId', type: 'u8', perCell: 1 },
  { name: 'waterDepthM', type: 'f32', perCell: 1 },
  { name: 'waterFluxM3PerS', type: 'f32', perCell: 4 },
  { name: 'sedimentSuspendedM', type: 'f32', perCell: 1 },
  { name: 'strataBoundsM', type: 'f32', perCell: STRATA_BOUNDS },
  { name: 'strataMaterial', type: 'u8', perCell: STRATA_LAYERS },
  { name: 'snowSweM', type: 'f32', perCell: 1 },
  { name: 'iceThicknessM', type: 'f32', perCell: 1 },
  { name: 'iceDebrisM', type: 'f32', perCell: 1 },
  { name: 'vegCover', type: 'f32', perCell: 1 },
  { name: 'plateId', type: 'u8', perCell: 1 },
  { name: 'lavaDepthM', type: 'f32', perCell: 1 },
  { name: 'lavaTempC', type: 'f32', perCell: 1 },
  { name: 'lavaKind', type: 'u8', perCell: 1 },
];

export interface FileHeader {
  app: 'terra-genesis';
  formatVersion: number;
  endianness: 'LE';
  width: number;
  height: number;
  cellSizeM: number;
  seaLevelM: number;
  seed: number;
  simTimeSeconds: number;
  meta: WorldMeta;
  water?: WaterParams;
  erosion?: ErosionParams;
  coast?: CoastParams;
  climate?: ClimateParams;
  glacier?: GlacierParams;
  vegetation?: VegetationParams;
  tectonics?: TectonicsParams;
  lava?: LavaParams;
  fields: { name: string; type: 'f32' | 'u8'; offset: number; byteLength: number }[];
  /** Free-form non-physical data (e.g. camera pose). */
  extras?: Record<string, unknown>;
}

const align4 = (n: number) => (n + 3) & ~3;

export function encodeWorld(w: WorldState, extras?: Record<string, unknown>): Uint8Array {
  const n = w.width * w.height;
  const fields: FileHeader['fields'] = [];
  let off = 0;
  for (const f of FIELDS) {
    const byteLength = n * f.perCell * (f.type === 'f32' ? 4 : 1);
    fields.push({ name: f.name, type: f.type, offset: off, byteLength });
    off = align4(off + byteLength);
  }
  const header: FileHeader = {
    app: 'terra-genesis',
    formatVersion: WORLD_FORMAT_VERSION,
    endianness: 'LE',
    width: w.width,
    height: w.height,
    cellSizeM: w.cellSizeM,
    seaLevelM: w.seaLevelM,
    seed: w.seed,
    simTimeSeconds: w.simTimeSeconds,
    meta: w.meta,
    water: w.water,
    erosion: w.erosion,
    coast: w.coast,
    climate: w.climate,
    glacier: w.glacier,
    vegetation: w.vegetation,
    tectonics: w.tectonics,
    lava: w.lava,
    fields,
    extras,
  };
  const hBytes = new TextEncoder().encode(JSON.stringify(header));
  const dataStart = align4(8 + hBytes.length);
  const out = new Uint8Array(dataStart + off);
  out.set(new TextEncoder().encode(MAGIC), 0);
  new DataView(out.buffer).setUint32(4, hBytes.length, true);
  out.set(hBytes, 8);
  for (const f of fields) {
    const arr = w[f.name as FieldName];
    out.set(new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength), dataStart + f.offset);
  }
  return out;
}

export function readHeader(bytes: Uint8Array): { header: FileHeader; dataStart: number } {
  if (bytes.length < 8 || new TextDecoder().decode(bytes.subarray(0, 4)) !== MAGIC) {
    throw new Error('Not a Terra Genesis world file');
  }
  const hLen = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(4, true);
  if (8 + hLen > bytes.length) throw new Error('Truncated world file header');
  const header = JSON.parse(new TextDecoder().decode(bytes.subarray(8, 8 + hLen))) as FileHeader;
  if (header.app !== 'terra-genesis') throw new Error('Unknown file application');
  if (header.formatVersion > WORLD_FORMAT_VERSION) {
    throw new Error(`World saved by a newer version (format ${header.formatVersion}); please update Terra Genesis`);
  }
  return { header, dataStart: align4(8 + hLen) };
}

export function decodeWorld(bytes: Uint8Array): { world: WorldState; extras?: Record<string, unknown> } {
  const { header: h, dataStart } = readHeader(bytes);
  const n = h.width * h.height;
  const has = (name: FieldName) => h.fields.some((x) => x.name === name);
  const get = (name: FieldName): ArrayBuffer => {
    const f = h.fields.find((x) => x.name === name);
    if (!f) throw new Error(`World file missing field ${name}`);
    const start = dataStart + f.offset;
    if (start + f.byteLength > bytes.length) throw new Error(`Truncated field ${name}`);
    // Copy into a fresh aligned buffer.
    return bytes.slice(start, start + f.byteLength).buffer;
  };
  const world: WorldState = {
    version: WORLD_FORMAT_VERSION,
    width: h.width,
    height: h.height,
    cellSizeM: h.cellSizeM,
    seaLevelM: h.seaLevelM,
    seed: h.seed,
    simTimeSeconds: h.simTimeSeconds,
    bedrockElevationM: new Float32Array(get('bedrockElevationM')),
    looseSedimentThicknessM: new Float32Array(get('looseSedimentThicknessM')),
    materialId: new Uint8Array(get('materialId')),
    strataBoundsM: has('strataBoundsM') ? new Float32Array(get('strataBoundsM')) : new Float32Array(n * STRATA_BOUNDS),
    strataMaterial: has('strataMaterial') ? new Uint8Array(get('strataMaterial')) : new Uint8Array(n * STRATA_LAYERS),
    // v1 → v2 migration: worlds without water start dry with default hydrology parameters.
    waterDepthM: has('waterDepthM') ? new Float32Array(get('waterDepthM')) : new Float32Array(n),
    waterFluxM3PerS: has('waterFluxM3PerS') ? new Float32Array(get('waterFluxM3PerS')) : new Float32Array(n * 4),
    water: { ...defaultWaterParams(), ...h.water, sources: (h.water?.sources ?? []).map((s) => ({ ...s })) },
    sedimentSuspendedM: has('sedimentSuspendedM') ? new Float32Array(get('sedimentSuspendedM')) : new Float32Array(n),
    snowSweM: has('snowSweM') ? new Float32Array(get('snowSweM')) : new Float32Array(n),
    iceThicknessM: has('iceThicknessM') ? new Float32Array(get('iceThicknessM')) : new Float32Array(n),
    iceDebrisM: has('iceDebrisM') ? new Float32Array(get('iceDebrisM')) : new Float32Array(n),
    vegCover: has('vegCover') ? new Float32Array(get('vegCover')) : new Float32Array(n),
    plateId: has('plateId') ? new Uint8Array(get('plateId')) : new Uint8Array(n),
    lavaDepthM: has('lavaDepthM') ? new Float32Array(get('lavaDepthM')) : new Float32Array(n),
    lavaTempC: has('lavaTempC') ? new Float32Array(get('lavaTempC')) : new Float32Array(n),
    lavaKind: has('lavaKind') ? new Uint8Array(get('lavaKind')) : new Uint8Array(n),
    erosion: { ...defaultErosionParams(), ...h.erosion },
    coast: { ...defaultCoastParams(), ...h.coast },
    climate: { ...defaultClimateParams(), ...h.climate },
    glacier: { ...defaultGlacierParams(), ...h.glacier },
    vegetation: { ...defaultVegetationParams(), ...h.vegetation },
    tectonics: { ...defaultTectonicsParams(), ...h.tectonics, plates: (h.tectonics?.plates ?? []).map((q) => ({ ...q })) },
    lava: { ...defaultLavaParams(), ...h.lava, vents: (h.lava?.vents ?? []).map((v) => ({ ...v })) },
    meta: h.meta,
  };
  if (!has('strataMaterial')) setUniformStrata(world); // v1–v3: one layer = the stored lithology
  if (
    world.strataBoundsM.length !== n * STRATA_BOUNDS ||
    world.strataMaterial.length !== n * STRATA_LAYERS ||
    world.bedrockElevationM.length !== n ||
    world.materialId.length !== n ||
    world.waterDepthM.length !== n ||
    world.waterFluxM3PerS.length !== n * 4 ||
    world.sedimentSuspendedM.length !== n ||
    world.snowSweM.length !== n ||
    world.iceThicknessM.length !== n ||
    world.iceDebrisM.length !== n ||
    world.vegCover.length !== n ||
    world.plateId.length !== n ||
    world.lavaDepthM.length !== n ||
    world.lavaTempC.length !== n ||
    world.lavaKind.length !== n
  )
    throw new Error('Field size mismatch');
  return { world, extras: h.extras };
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Blob([bytes]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

export const compress = (b: Uint8Array) => pipe(b, new CompressionStream('gzip'));

/** Decompress gzip; passes uncompressed TGW1 bytes through unchanged. */
export async function decompress(b: Uint8Array): Promise<Uint8Array> {
  if (b[0] === 0x1f && b[1] === 0x8b) return pipe(b, new DecompressionStream('gzip'));
  return b;
}

export async function worldToFileBytes(w: WorldState, extras?: Record<string, unknown>): Promise<Uint8Array> {
  return compress(encodeWorld(w, extras));
}

export async function worldFromFileBytes(b: Uint8Array) {
  return decodeWorld(await decompress(b));
}
