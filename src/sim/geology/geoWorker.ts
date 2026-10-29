import { createWorld, type BoundaryMode, type WorldState } from '../../engine/world';
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
}

let w: WorldState | null = null;
let geo: LandscapeEvolution | null = null;

self.onmessage = (e: MessageEvent<GeoJob>) => {
  const j = e.data;
  if (!w || w.width !== j.width || w.height !== j.height) {
    w = createWorld({ width: j.width, height: j.height, cellSizeM: j.cellSizeM, seed: 0 });
    geo = new LandscapeEvolution(w);
  }
  w.cellSizeM = j.cellSizeM;
  w.seaLevelM = j.seaLevelM;
  w.water.boundary = j.boundary;
  w.bedrockElevationM.set(j.bed);
  w.looseSedimentThicknessM.set(j.soil);
  w.materialId.set(j.material);
  w.strataBoundsM.set(j.strataBounds);
  w.strataMaterial.set(j.strataMaterial);
  const stats = runGeologic(geo!, j.years, j.params, j.maxStepYears, j.meander);
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
  };
  (self as unknown as { postMessage(m: unknown, transfer: Transferable[]): void }).postMessage(out, [out.bed.buffer, out.soil.buffer, out.material.buffer, out.area.buffer, out.lake.buffer]);
};
