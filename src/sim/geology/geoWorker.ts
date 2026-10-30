import { computeSurface, createWorld, type BoundaryMode, type WorldState } from '../../engine/world';
import { ClimateField, type ClimateParams } from '../climate/climate';
import { GlacierSim, type GlacierParams } from '../glacier/glacierSim';
import { CoastSim, type CoastParams } from '../coast/coastSim';
import { LandscapeEvolution, type GeoParams } from './landscapeEvolution';
import type { MeanderState } from './meander';
import { runGeologic } from './run';

/** A request to run geological time on a copy of the world's terrain (posted by app/geoRunner). */
export interface GeoJob {
  id: number;
  width: number;
  height: number;
  cellSizeM: number;
  seaLevelM: number;
  boundary: BoundaryMode;
  bed: Float32Array;
  soil: Float32Array;
  material: Uint8Array;
  strataBounds: Float32Array;
  strataMaterial: Uint8Array;
  years: number;
  maxStepYears: number;
  params: GeoParams;
  /** The meandering lowland river, if any (returned updated). */
  meander: MeanderState | null;
  /** Glaciers (when glacier and climate params are both enabled): ice and the debris it carries. */
  climate: ClimateParams;
  glacier: GlacierParams;
  /** Coasts (when waves are on). */
  coast: CoastParams;
  ice: Float32Array;
  debris: Float32Array;
  moraine: Float32Array;
  glacialErosion: Float32Array;
}

let w: WorldState | null = null;
let geo: LandscapeEvolution | null = null;
let surface: Float32Array | null = null;
let climate: ClimateField | null = null;
let glacier: GlacierSim | null = null;
let coast: CoastSim | null = null;

self.onmessage = (e: MessageEvent<GeoJob>) => {
  const j = e.data;
  if (!w || w.width !== j.width || w.height !== j.height) {
    w = createWorld({ width: j.width, height: j.height, cellSizeM: j.cellSizeM, seed: 0 });
    geo = new LandscapeEvolution(w);
    surface = new Float32Array(j.width * j.height);
    climate = new ClimateField(j.width * j.height);
    glacier = new GlacierSim(w, surface, climate);
    coast = new CoastSim(w, surface);
  }
  w.cellSizeM = j.cellSizeM;
  w.seaLevelM = j.seaLevelM;
  w.water.boundary = j.boundary;
  w.bedrockElevationM.set(j.bed);
  w.looseSedimentThicknessM.set(j.soil);
  w.materialId.set(j.material);
  w.strataBoundsM.set(j.strataBounds);
  w.strataMaterial.set(j.strataMaterial);
  w.climate = j.climate;
  w.glacier = j.glacier;
  w.coast = j.coast;
  w.iceThicknessM.set(j.ice);
  w.iceDebrisM.set(j.debris);
  computeSurface(w, surface!);
  climate!.compute(w, surface!);
  const glacial = w.glacier.enabled && w.climate.enabled ? { sim: glacier!, climate: climate!, surface: surface!, moraine: j.moraine, eroded: j.glacialErosion } : null;
  const coastal = w.coast.wavesOn ? { sim: coast!, surface: surface! } : null;
  const stats = runGeologic(geo!, j.years, j.params, j.maxStepYears, j.meander, glacial, coastal);
  geo!.route(); // drainage and lakes of the landscape as it is now (for drawing rivers and lakes)
  const out = {
    id: j.id,
    bed: w.bedrockElevationM.slice(),
    soil: w.looseSedimentThicknessM.slice(),
    material: w.materialId.slice(),
    area: Float32Array.from(geo!.area),
    lake: Float32Array.from(geo!.lake),
    stats,
    meander: j.meander,
    ice: w.iceThicknessM.slice(),
    debris: w.iceDebrisM.slice(),
    moraine: j.moraine,
    glacialErosion: j.glacialErosion,
  };
  (self as unknown as { postMessage(m: unknown, transfer: Transferable[]): void }).postMessage(out, [
    out.bed.buffer,
    out.soil.buffer,
    out.material.buffer,
    out.area.buffer,
    out.lake.buffer,
    out.ice.buffer,
    out.debris.buffer,
    out.moraine.buffer,
    out.glacialErosion.buffer,
  ]);
};
