import { cloneWorld, computeSurface, type WorldState } from './world';
import { makeCheckpoint, MAX_CHECKPOINTS, type Checkpoint } from './checkpoints';
import type { HeightfieldView } from '../terrain/heightfield';
import { sampleBilinear } from '../terrain/heightfield';
import { applyBrush, type BrushParams } from '../tools/brush';
import { History, StrokeRecorder } from '../tools/history';
import { unionRect, type CellRect } from '../utils/rect';
import { WaterSim } from '../sim/water/waterSim';
import { GpuWater } from '../sim/water/gpuWater';
import { SedimentSim } from '../sim/sediment/sedimentSim';
import { triggerLandslide, type LandslideResult } from '../sim/slopes/landslide';
import { CoastSim, type CoastParams } from '../sim/coast/coastSim';
import { SimClock, type Stepper } from './clock';
import { ClimateField, YEAR_S, type ClimateParams } from '../sim/climate/climate';
import { GlacierSim, type GlacierParams } from '../sim/glacier/glacierSim';
import { VegetationSim, type VegetationParams } from '../sim/vegetation/vegetationSim';
import { compareClimate, type ClimateChange, type CompareResult } from '../terrain/biomes';
import { generatePlates, TectonicsSim, type Plate, type TectonicsParams } from '../sim/tectonics/plates';
import { earthquake, type QuakeOptions, type QuakeResult } from '../sim/tectonics/earthquake';
import { LavaSim, type LavaKind, type LavaVent } from '../sim/lava/lavaSim';
import { episodePlan, runEruption, type VolcanoType } from '../sim/lava/build';
import { caldera, type CalderaOptions, type CalderaResult } from '../sim/lava/caldera';
import type { EruptionStyle } from '../sim/lava/tephra';
import { floodSummary, surgeHeight, type FloodSummary, type HazardEvent } from '../sim/events/hazards';
import { MM_PER_H, type ErosionParams, type WaterParams, type WaterSource } from './world';

export type { VolcanoType } from '../sim/lava/build';

/** A volcano being built eruption by eruption (call step() once per frame until it returns false). */
export interface VolcanoBuild {
  readonly total: number;
  done: number;
  step(): boolean;
}

export type EngineEvent =
  | { type: 'world-replaced'; keepCamera?: boolean }
  | { type: 'terrain-changed'; rect: CellRect }
  | { type: 'history-changed' }
  | { type: 'water-params-changed' }
  | { type: 'sim-state-changed' }
  | { type: 'sea-level-changed' }
  | { type: 'climate-changed' };

/**
 * Owns the authoritative WorldState, its derived surface cache, edit history and dirty
 * regions. UI and renderer communicate with the world only through this object.
 */
export class Engine {
  world!: WorldState;
  surface!: Float32Array;
  readonly history = new History();
  private dirty: CellRect | null = null;
  private listeners = new Set<(e: EngineEvent) => void>();
  private stroke: { rec: StrokeRecorder; params: BrushParams } | null = null;
  /** CPU water solver: tested reference, fallback backend, ledger and stats owner. */
  water!: WaterSim;
  /** CPU sediment solver (reference/fallback; owns the sediment ledger). */
  sediment!: SedimentSim;
  /** Coastal processes (slow cadence, CPU). */
  coast!: CoastSim;
  /** Climate fields (temperature, rain / evaporation factors) derived from world.climate. */
  climate!: ClimateField;
  /** Glaciers (slow cadence, CPU, accelerated glacier time). */
  glacier!: GlacierSim;
  /** Vegetation (slow cadence, CPU, accelerated plant time). */
  vegetation!: VegetationSim;
  /** Plate tectonics (slow cadence, CPU, accelerated tectonic time). */
  tectonics!: TectonicsSim;
  /** Lava flows from vents (real simulated time, steps with the water solver). */
  lava!: LavaSim;
  private climateDirty = false;
  private climateClock = 0;
  private seasonDay = -1;
  /** Surface at the last "set reference" (for the erosion/deposition change map). */
  referenceSurface!: Float32Array;
  private cpuStepper!: Stepper;
  /** Optional GPU backend (attached by the renderer when WebGL2 float targets exist). */
  gpu: GpuWater | null = null;
  private gpuContext: WebGL2RenderingContext | null = null;
  readonly clock = new SimClock(10);
  /** Increments whenever water state on the CPU mirror or GPU changes (renderer polls it). */
  waterRevision = 0;
  private groundDirty = false;
  private syncTimer = 0;
  /** Real seconds between GPU→CPU syncs while running (inspector, stats, ledger). */
  syncInterval = 0.25;

  constructor(world: WorldState) {
    this.setWorld(world);
  }

  private setWorld(world: WorldState) {
    this.world = world;
    this.surface = new Float32Array(world.width * world.height);
    computeSurface(world, this.surface);
    this.dirty = null;
    this.water = new WaterSim(world, this.surface);
    this.sediment = new SedimentSim(world, this.surface, this.water);
    this.coast = new CoastSim(world, this.surface);
    this.climate = new ClimateField(world.width * world.height);
    this.climate.compute(world, this.surface);
    this.water.climate = this.climate;
    this.glacier = new GlacierSim(world, this.surface, this.climate);
    this.vegetation = new VegetationSim(world, this.surface, this.climate);
    this.tectonics = new TectonicsSim(world, this.surface);
    this.lava = new LavaSim(world, this.surface);
    this.lava.airC = this.climate.temperatureC;
    this.lava.sea = this.water.sea;
    this.glacier.budgetMs = typeof window === 'undefined' ? Infinity : 40; // keep the page responsive
    this.climateDirty = false;
    this.seasonDay = Math.floor(world.climate.seasonPhase * 365);
    this.referenceSurface = this.surface.slice();
    this.compareResult = null;
    this.lastQuake = null;
    this.hazard = null;
    this.flood = null;
    this.hazardLog = [];
    if (this.compareCheckpoint && !this.sameWorld(this.compareCheckpoint)) this.compareCheckpoint = null;
    const water = this.water;
    const sediment = this.sediment;
    this.cpuStepper = {
      stableDt: () => water.stableDt(),
      step: (dt) => {
        water.step(dt);
        sediment.step(dt);
      },
    };
    this.clock.playing = false;
    this.clock.reset();
    this.groundDirty = false;
    if (this.gpuContext) this.attachGpu(this.gpuContext);
    this.waterRevision++;
  }

  // ---------- water backend ----------

  get stepper(): Stepper {
    const hz = this.hazard;
    const base0 = this.gpu ?? this.cpuStepper;
    // A flood event runs on the solver's own clock, so the storm / surge timing is exact per step.
    const base: Stepper =
      hz && !hz.done
        ? {
            stableDt: () => base0.stableDt(),
            step: (dt) => {
              this.hazardStep(hz, dt);
              base0.step(dt);
            },
          }
        : base0;
    const lava = this.lava;
    if (!lava.active) return base;
    // Lava shares the water clock, sub-stepping inside each water step at its own stable step.
    return {
      stableDt: () => Math.min(base.stableDt(), 60),
      step: (dt) => {
        base.step(dt);
        lava.advance(dt);
      },
    };
  }

  get erosionActive(): boolean {
    return this.world.erosion.enabled;
  }

  get backend(): 'gpu' | 'cpu' {
    return this.gpu ? 'gpu' : 'cpu';
  }

  /** Attach a GPU backend on the given context; returns false (CPU fallback) if unsupported. */
  attachGpu(gl: WebGL2RenderingContext): boolean {
    this.detachGpu();
    this.gpuContext = gl;
    try {
      if (!GpuWater.isSupported(gl)) return false;
      this.gpu = new GpuWater(gl, this.world, this.surface, this.water, this.sediment);
      return true;
    } catch (err) {
      console.warn('GPU water unavailable, using CPU', err);
      this.gpu = null;
      return false;
    }
  }

  /** Sync GPU state to the CPU mirror and drop the GPU backend (e.g. renderer disposal). */
  detachGpu(): void {
    if (this.gpu) {
      if (!this.gpu.disposed) this.syncWater();
      this.gpu.dispose();
    }
    this.gpu = null;
    this.gpuContext = null;
  }

  /** Make the CPU mirror current (before save, inspect, CPU-side edits). */
  syncWater(): void {
    if (!this.gpu) return;
    // Pending CPU terrain edits must reach the GPU before reading its bed back.
    this.flushGround();
    if (this.gpu.syncToCpu()) this.markRenderDirtyAll();
  }

  /** Terrain changed by the simulation: renderer must rebuild; GPU already has it. */
  private markRenderDirtyAll() {
    this.climateDirty = true;
    const r = { x0: 0, y0: 0, x1: this.world.width, y1: this.world.height };
    this.dirty = unionRect(this.dirty, r);
    this.emit({ type: 'terrain-changed', rect: r });
  }

  /** Advance simulation by one real frame. Returns simulated seconds advanced. */
  tick(realDt: number): number {
    this.flushGround();
    const done = this.clock.tick(this.stepper, realDt);
    this.climateClock += realDt;
    if (this.climateDirty && this.world.climate.enabled && this.climateClock >= 3) this.refreshClimate(true);
    if (done > 0) {
      this.world.simTimeSeconds += done;
      this.waterRevision++;
      this.advanceSeason(done);
      this.coastHook(done);
      this.glacierHook(done);
      this.vegetationHook(done);
      this.tectonicsHook(done);
      this.lavaHook();
      this.hazardHook();
      if (this.gpu) {
        this.syncTimer += realDt;
        if (this.syncTimer >= this.syncInterval) {
          this.syncTimer = 0;
          this.syncWater();
        }
      } else if (this.erosionActive) {
        this.markRenderDirtyAll();
      }
    }
    return done;
  }

  /** Advance exactly `seconds` of simulated time (Step button / tests), ignoring budget. */
  advance(seconds: number): number {
    this.flushGround();
    // Long advances run in segments so GPU accumulators are folded before float32 round-off grows.
    let done = 0;
    let left = seconds;
    while (left > 0) {
      const seg = this.gpu ? Math.min(left, 600) : left;
      const d = this.clock.advanceExactly(this.stepper, seg);
      done += d;
      this.advanceSeason(d);
      this.coastHook(d);
      this.glacierHook(d);
      this.vegetationHook(d);
      this.tectonicsHook(d);
      this.lavaHook();
      this.hazardHook();
      left -= seg;
      if (this.gpu && left > 0) this.gpu.syncToCpu();
      if (d === 0) break;
    }
    this.world.simTimeSeconds += done;
    this.syncWater();
    if (!this.gpu && this.erosionActive) this.markRenderDirtyAll();
    this.waterRevision++;
    return done;
  }

  /** Run coastal processes when their cadence is due (pull GPU state, update, push back). */
  private coastHook(simSeconds: number) {
    if (!this.coast.accumulate(simSeconds)) return;
    if (this.gpu) this.gpu.syncToCpu();
    const changed = this.coast.update(this.world.erosion.speedup);
    if (changed > 0) {
      this.water.refreshSea();
      this.groundDirty = true;
      this.markRenderDirtyAll();
    }
  }

  /**
   * Change climate parameters. Season-only changes refresh temperature/evaporation; anything else
   * (wind, orographic, enabling) recomputes the rain pattern too.
   */
  setClimateParams(p: Partial<ClimateParams>): void {
    const seasonal = Object.keys(p).every(
      (k) => k === 'seasonPhase' || k === 'seasonsRun' || k === 'seaLevelTempC' || k === 'seasonalAmpC' || k === 'lapseRateCPerKm',
    );
    this.syncWater(); // fold GPU evaporation/rain accumulated under the old factors first
    Object.assign(this.world.climate, p);
    this.seasonDay = Math.floor(this.world.climate.seasonPhase * 365);
    this.refreshClimate(!seasonal);
    this.emit({ type: 'water-params-changed' });
  }

  /** Recompute climate fields (rain pattern when `rain`) and push them to the GPU. */
  private refreshClimate(rain: boolean) {
    if (rain) this.climate.compute(this.world, this.surface);
    else this.climate.computeTemperature(this.world, this.surface);
    if (rain) {
      this.climateDirty = false;
      this.climateClock = 0;
    }
    this.gpu?.uploadClimate();
    this.emit({ type: 'climate-changed' });
  }

  /** Seasons follow simulated (not geomorphic) time; fields refresh once per simulated day. */
  private advanceSeason(simSeconds: number) {
    const c = this.world.climate;
    if (!c.seasonsRun || simSeconds <= 0) return;
    c.seasonPhase = (c.seasonPhase + simSeconds / YEAR_S) % 1;
    const day = Math.floor(c.seasonPhase * 365);
    if (day !== this.seasonDay) {
      this.seasonDay = day;
      if (c.enabled) this.refreshClimate(false);
    }
  }

  /** Run glaciers when their cadence is due (pull GPU state, update, push water and ground back). */
  private glacierHook(simSeconds: number) {
    if (!this.glacier.accumulate(simSeconds)) return;
    if (this.gpu) this.gpu.syncToCpu();
    const melt = this.glacier.update();
    if (!melt) return;
    const d = this.world.waterDepthM;
    const A = this.world.cellSizeM * this.world.cellSizeM;
    let added = 0;
    for (let i = 0; i < melt.length; i++)
      if (melt[i] > 0 && !this.water.sea[i]) {
        const nd = Math.fround(d[i] + melt[i]);
        added += nd - d[i];
        d[i] = nd;
      }
    this.water.ledger.glacierMeltIn += added * A;
    this.water.refreshSea();
    this.gpu?.uploadWater();
    this.groundDirty = true;
    this.climateDirty = true;
    this.markRenderDirtyAll();
  }

  /** Grow / die back plants when their cadence is due; push the erosion factor to the GPU. */
  private vegetationHook(simSeconds: number) {
    if (!this.vegetation.accumulate(simSeconds)) return;
    if (this.gpu) this.gpu.syncToCpu(); // standing water and soil depth must be current
    if (!this.vegetation.update()) return;
    this.gpu?.uploadClimate();
    this.vegetationRevision++;
    this.markRenderDirtyAll();
  }

  /** Move plates when their cadence is due (pull GPU bed, deform bedrock, push back). */
  private tectonicsHook(simSeconds: number) {
    if (!this.tectonics.accumulate(simSeconds)) return;
    if (this.gpu) this.gpu.syncToCpu();
    if (!this.tectonics.update()) return;
    if (this.tectonics.lastShifts > 0) {
      // Transform faults moved whole columns (water, snow, plants included).
      this.gpu?.uploadWater();
      this.vegetationRevision++;
    }
    this.water.refreshSea();
    this.groundDirty = true;
    this.markRenderDirtyAll();
  }

  /** Increments whenever lava moves or vents change (renderer redraws the lava region). */
  lavaRevision = 0;
  private lavaWasActive = false;

  /** Redraw flowing lava; turn frozen lava into rock on its cadence (pull GPU state first). */
  private lavaHook() {
    const lava = this.lava;
    if (!lava.active && !this.lavaWasActive) return;
    this.lavaWasActive = lava.active;
    const region = lava.region;
    if (region) {
      this.dirty = unionRect(this.dirty, region);
      this.emit({ type: 'terrain-changed', rect: region });
    }
    this.lavaRevision++;
    const solid = lava.solidifyDue() || !lava.active;
    const teph = lava.tephraDue();
    if (!solid && !teph) return;
    if (this.gpu) this.gpu.syncToCpu();
    if (teph) {
      lava.windFromDeg = this.world.climate.windFromDeg;
      const t = lava.layTephra();
      if (t) {
        this.markDirty(t);
        this.water.refreshSea();
      }
    }
    if (!solid) return;
    const r = lava.solidify();
    this.gpu?.uploadWater(); // snow melted under hot lava
    this.vegetationRevision++;
    if (r) this.markDirty(r);
  }

  /** Open a vent at world (xM, yM). */
  addVent(xM: number, yM: number, rateM3PerS: number, kind: LavaKind, durationS: number, style: EruptionStyle = 'lava'): LavaVent {
    const w = this.world;
    const x = Math.min(w.width - 1, Math.max(0, Math.round(xM / w.cellSizeM)));
    const y = Math.min(w.height - 1, Math.max(0, Math.round(yM / w.cellSizeM)));
    const v = this.lava.addVent(x, y, rateM3PerS, kind, durationS, style);
    this.lavaRevision++;
    this.emit({ type: 'water-params-changed' });
    return v;
  }

  /**
   * Build a volcano at (xM, yM) from `episodes` eruptions of the given type. Each eruption runs the
   * real lava / tephra physics for its duration plus 2 h of flow; the years of rest between eruptions
   * are skipped (labelled time compression: remaining lava is cooled to rock, water and erosion do not
   * run). Undoable as one edit. Pauses the clock.
   */
  buildVolcano(xM: number, yM: number, type: VolcanoType, episodes: number): VolcanoBuild {
    this.setPlaying(false);
    this.syncWater();
    const w = this.world;
    const x = Math.min(w.width - 1, Math.max(0, Math.round(xM / w.cellSizeM)));
    const y = Math.min(w.height - 1, Math.max(0, Math.round(yM / w.cellSizeM)));
    const all = { x0: 0, y0: 0, x1: w.width, y1: w.height };
    const rec = new StrokeRecorder(w, `Build ${type} volcano`);
    rec.capture(all);
    const lava = this.lava;
    const build: VolcanoBuild = {
      total: episodes,
      done: 0,
      step: () => {
        if (build.done >= build.total) return false;
        const vent = y * w.width + x;
        runEruption(lava, w, x, y, episodePlan(type, build.done, this.surface[vent] < w.seaLevelM));
        build.done++;
        const finished = build.done >= build.total;
        if (finished) {
          const cmd = rec.finish();
          if (cmd) {
            this.history.push(cmd);
            this.emit({ type: 'history-changed' });
          }
        }
        computeSurface(w, this.surface);
        this.water.refreshSea();
        this.vegetationRevision++;
        this.lavaRevision++;
        this.markDirty(all);
        return !finished;
      },
    };
    return build;
  }

  /** High-level wind speed carrying volcanic ash (m/s). */
  setAshWind(ms: number): void {
    this.world.lava.windSpeedMS = ms;
    this.emit({ type: 'water-params-changed' });
  }

  removeVent(id: number): void {
    this.lava.removeVent(id);
    this.lavaRevision++;
    this.emit({ type: 'water-params-changed' });
  }

  setTectonicsParams(p: Partial<TectonicsParams>): void {
    Object.assign(this.world.tectonics, p);
    this.tectonics.classify();
    this.plateRevision++;
    this.emit({ type: 'water-params-changed' });
  }

  /** Change one plate's motion or kind. */
  setPlate(id: number, p: Partial<Plate>): void {
    const pl = this.world.tectonics.plates.find((q) => q.id === id);
    if (!pl) return;
    Object.assign(pl, p);
    this.tectonics.classify();
    this.plateRevision++;
    this.emit({ type: 'water-params-changed' });
  }

  /** Divide the map into n new plates (seeded). */
  newPlates(n: number, seed: number): void {
    this.syncWater();
    this.world.tectonics.plates = generatePlates(this.world, n, seed, this.surface);
    // Belts scale with the map (the model compresses plate-scale geology onto a small map).
    const extent = Math.max(this.world.width, this.world.height) * this.world.cellSizeM;
    this.world.tectonics.beltWidthM = Math.round((0.12 * extent) / 100) * 100;
    this.tectonics.classify();
    this.plateRevision++;
    this.emit({ type: 'water-params-changed' });
    this.emit({ type: 'climate-changed' }); // overlay refresh
  }

  /** Increments when plates or their motions change (overlay / profile redraw). */
  plateRevision = 0;

  /** Last "what if?" comparison (its plant-cover difference drives the 'compare' overlay). */
  compareResult: CompareResult | null = null;

  /** Run a climate "what if?" comparison on copies of the current world (the world is unchanged). */
  compareClimate(change: ClimateChange): CompareResult {
    this.syncWater();
    this.compareResult = compareClimate(this.world, change);
    this.emit({ type: 'climate-changed' });
    return this.compareResult;
  }

  /** Increments whenever plant cover changes (renderer rebuilds trees). */
  vegetationRevision = 0;

  setVegetationParams(p: Partial<VegetationParams>): void {
    Object.assign(this.world.vegetation, p);
    this.gpu?.uploadClimate();
    this.emit({ type: 'water-params-changed' });
  }

  setGlacierParams(p: Partial<GlacierParams>): void {
    Object.assign(this.world.glacier, p);
    this.emit({ type: 'water-params-changed' });
  }

  setCoastParams(p: Partial<CoastParams>): void {
    Object.assign(this.world.coast, p);
    this.emit({ type: 'water-params-changed' });
  }

  private flushGround() {
    if (!this.groundDirty) return;
    this.groundDirty = false;
    if (this.gpu) this.gpu.uploadGround();
    else this.water.refreshSea();
  }

  setPlaying(playing: boolean): void {
    this.clock.playing = playing;
    if (!playing) this.syncWater();
    this.emit({ type: 'sim-state-changed' });
  }

  setSpeed(simSecondsPerSecond: number): void {
    this.clock.speed = simSecondsPerSecond;
    this.emit({ type: 'sim-state-changed' });
  }

  setErosionParams(p: Partial<ErosionParams>): void {
    // Bed fields must be current on the CPU before erosion turns off (GPU stops syncing bed).
    if (p.enabled === false) this.syncWater();
    Object.assign(this.world.erosion, p);
    if (p.enabled) this.groundDirty = true;
    this.emit({ type: 'water-params-changed' });
  }

  /**
   * Change sea level (m). Land below the new level becomes sea (its surface water joins the sea
   * and is ledgered; suspended sediment there settles next step); exposed shelf becomes land.
   */
  setSeaLevel(m: number): void {
    this.syncWater();
    this.world.seaLevelM = m;
    this.water.refreshSea();
    this.groundDirty = true;
    this.waterRevision++;
    this.emit({ type: 'sea-level-changed' });
    this.markRenderDirtyAll();
  }

  /** Snapshot the current surface as the reference for the erosion/deposition change map. */
  setReference(): void {
    this.syncWater();
    this.referenceSurface = this.surface.slice();
    this.markRenderDirtyAll();
  }

  setWaterParams(p: Partial<WaterParams>): void {
    Object.assign(this.world.water, p);
    this.emit({ type: 'water-params-changed' });
  }

  /** CPU-side water edit wrapped in GPU sync/upload. */
  private editWater<T>(fn: () => T): T {
    this.syncWater();
    const r = fn();
    if (this.gpu) this.gpu.uploadWater();
    this.waterRevision++;
    return r;
  }

  /** Add (depth > 0) or remove (depth < 0) water in a disc around world (xM, yM). Returns m³. */
  addWater(xM: number, yM: number, radiusM: number, depthM: number): number {
    const cs = this.world.cellSizeM;
    return this.editWater(() => this.water.addWaterDisc(xM / cs, yM / cs, radiusM / cs, depthM));
  }

  clearWater(): void {
    this.editWater(() => this.water.clearWater());
  }

  addSource(xM: number, yM: number, rateM3PerS: number): WaterSource {
    const w = this.world;
    const id = w.water.sources.reduce((m, s) => Math.max(m, s.id), 0) + 1;
    const src: WaterSource = {
      id,
      x: Math.min(w.width - 1, Math.max(0, Math.round(xM / w.cellSizeM))),
      y: Math.min(w.height - 1, Math.max(0, Math.round(yM / w.cellSizeM))),
      rateM3PerS,
    };
    w.water.sources.push(src);
    this.emit({ type: 'water-params-changed' });
    return src;
  }

  removeSource(id: number): void {
    this.world.water.sources = this.world.water.sources.filter((s) => s.id !== id);
    this.emit({ type: 'water-params-changed' });
  }

  on(fn: (e: EngineEvent) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(e: EngineEvent) {
    for (const fn of this.listeners) fn(e);
  }

  get heightfield(): HeightfieldView {
    const w = this.world;
    return { width: w.width, height: w.height, cellSizeM: w.cellSizeM, z: this.surface };
  }

  replaceWorld(world: WorldState, keepCamera = false): void {
    this.stroke = null;
    const gl = this.gpuContext;
    this.detachGpu();
    this.gpuContext = gl;
    this.setWorld(world);
    this.history.clear();
    this.emit({ type: 'world-replaced', keepCamera });
    this.emit({ type: 'history-changed' });
    this.emit({ type: 'sim-state-changed' });
  }

  // ---------- checkpoints (spec F3) ----------

  /** In-memory snapshots of the whole world (this session only). */
  checkpoints: Checkpoint[] = [];
  /** Checkpoint the difference overlays compare against, or null. */
  compareCheckpoint: Checkpoint | null = null;
  private nextCheckpointId = 1;

  /** Snapshot the world now. The oldest is dropped beyond MAX_CHECKPOINTS. */
  takeCheckpoint(label: string): Checkpoint {
    this.syncWater();
    const cp = makeCheckpoint(this.world, this.nextCheckpointId++, label);
    this.checkpoints.push(cp);
    while (this.checkpoints.length > MAX_CHECKPOINTS) {
      const old = this.checkpoints.shift()!;
      if (this.compareCheckpoint === old) this.compareCheckpoint = null;
    }
    this.emit({ type: 'climate-changed' }); // overlay menu / panels refresh
    return cp;
  }

  /** Put the world back exactly as it was at the checkpoint (time included). Keeps the camera. */
  restoreCheckpoint(id: number): boolean {
    const cp = this.checkpoints.find((c) => c.id === id);
    if (!cp) return false;
    const playing = this.clock.playing;
    const speed = this.clock.speed;
    this.replaceWorld(cloneWorld(cp.world), true);
    this.clock.speed = speed;
    if (playing) this.setPlaying(true);
    return true;
  }

  /** A checkpoint of this world (same map, same creation) — the only kind a difference makes sense for. */
  sameWorld(cp: Checkpoint): boolean {
    const w = this.world;
    return (
      cp.world.width === w.width && cp.world.height === w.height && cp.world.cellSizeM === w.cellSizeM && cp.world.meta.createdAtIso === w.meta.createdAtIso
    );
  }

  deleteCheckpoint(id: number): void {
    this.checkpoints = this.checkpoints.filter((c) => c.id !== id);
    if (this.compareCheckpoint?.id === id) this.compareCheckpoint = null;
    this.emit({ type: 'climate-changed' });
  }

  /** Choose the checkpoint for the difference overlays (null = none). */
  compareWith(id: number | null): void {
    this.syncWater();
    const cp = id === null ? null : (this.checkpoints.find((c) => c.id === id) ?? null);
    this.compareCheckpoint = cp && this.sameWorld(cp) ? cp : null;
    this.emit({ type: 'climate-changed' });
  }

  sampleSurface(xM: number, yM: number): number {
    return sampleBilinear(this.heightfield, xM, yM);
  }

  get strokeActive(): boolean {
    return this.stroke !== null;
  }

  beginStroke(params: BrushParams, xM: number, yM: number, label: string = params.kind): void {
    this.syncIfGpuErodes();
    const p = { ...params };
    if (p.kind === 'flatten' && p.targetM === undefined) p.targetM = this.sampleSurface(xM, yM);
    this.stroke = { rec: new StrokeRecorder(this.world, label), params: p };
  }

  /** Apply the active stroke at (xM, yM) for dt seconds of brush time. */
  strokeStep(xM: number, yM: number, dt: number): void {
    if (!this.stroke) return;
    this.syncIfGpuErodes();
    const rect = applyBrush(this.world, this.surface, xM, yM, this.stroke.params, dt, this.stroke.rec.capture);
    if (rect) this.markDirty(rect);
  }

  endStroke(): void {
    if (!this.stroke) return;
    const cmd = this.stroke.rec.finish();
    this.stroke = null;
    if (cmd) {
      this.history.push(cmd);
      this.emit({ type: 'history-changed' });
    }
  }

  /** Caldera collapse: the summit drops into an emptied magma chamber (undoable as one edit). */
  caldera(o: CalderaOptions): CalderaResult {
    this.syncWater();
    const rec = new StrokeRecorder(this.world, 'Caldera collapse');
    const res = caldera(this.world, this.surface, o, rec.capture);
    const cmd = rec.finish();
    if (cmd) {
      this.history.push(cmd);
      this.emit({ type: 'history-changed' });
    }
    this.water.refreshSea();
    this.markDirty(res.rect);
    return res;
  }

  // ---------- flood hazards (storm, sea surge; sim/events/hazards.ts) ----------

  /** The current or last flood event (null before the first one in this world). */
  hazard: HazardEvent | null = null;
  /** Flood record of the current / last event: deepest water per cell, and the water when it began. */
  flood: { peak: Float32Array; start: Float32Array; label: string } | null = null;
  /** Events in this world, with the simulated time they began and their result. */
  hazardLog: { simS: number; text: string }[] = [];
  private nextHazardId = 1;
  private hazardChanged = false;

  /** Storm: `rainMmH` over the whole map for `hours`, then the old rain; records `afterHours` more while it drains. */
  startStorm(rainMmH: number, hours: number, afterHours = 6): HazardEvent {
    return this.startHazard({
      kind: 'storm',
      rainMmH,
      activeS: hours * 3600,
      recordS: (hours + afterHours) * 3600,
      label: `Storm ${rainMmH} mm/h for ${hours} h`,
    });
  }

  /** Sea surge: the sea stands `heightM` higher for `minutes` (simplified tsunami), recorded `afterMinutes` more. */
  startSurge(heightM: number, minutes: number, afterMinutes = 60): HazardEvent {
    return this.startHazard({
      kind: 'surge',
      surgeM: heightM,
      activeS: minutes * 60,
      recordS: (minutes + afterMinutes) * 60,
      rampS: Math.min(600, minutes * 15),
      label: `Sea surge ${heightM} m for ${minutes} min`,
    });
  }

  private startHazard(o: Partial<HazardEvent> & Pick<HazardEvent, 'kind' | 'activeS' | 'recordS' | 'label'>): HazardEvent {
    this.stopHazard();
    this.syncWater();
    const w = this.world;
    const hz: HazardEvent = {
      id: this.nextHazardId++,
      startS: w.simTimeSeconds,
      elapsedS: 0,
      rainMmH: 0,
      prevRainMPerS: w.water.rainMPerS,
      rainRestored: false,
      surgeM: 0,
      rampS: 0,
      done: false,
      ...o,
    };
    const start = w.waterDepthM.slice();
    for (let i = 0; i < start.length; i++) if (this.water.sea[i]) start[i] = 0;
    this.water.peakDepth = start.slice();
    this.gpu?.uploadPeak();
    this.flood = { peak: this.water.peakDepth, start, label: hz.label };
    if (hz.kind === 'storm') w.water.rainMPerS = hz.rainMmH * MM_PER_H;
    this.hazard = hz;
    this.hazardLog.push({ simS: hz.startS, text: `${hz.label} began` });
    this.emit({ type: 'water-params-changed' });
    this.emit({ type: 'climate-changed' }); // overlay menu: flood extent available
    return hz;
  }

  /** Per solver step: advance the event clock, set the surge, end the storm rain and the recording on time. */
  private hazardStep(hz: HazardEvent, dt: number) {
    if (hz.done) return;
    hz.elapsedS += dt;
    if (hz.kind === 'surge') this.water.surgeM = surgeHeight(hz, hz.elapsedS);
    // (tolerance: the step sizes rarely sum exactly to the set duration)
    if (hz.kind === 'storm' && !hz.rainRestored && hz.elapsedS >= hz.activeS - 1e-6) {
      this.world.water.rainMPerS = hz.prevRainMPerS;
      hz.rainRestored = true;
      this.hazardChanged = true;
    }
    if (hz.elapsedS >= hz.recordS - 1e-6) this.finishHazard(hz);
  }

  private finishHazard(hz: HazardEvent) {
    hz.done = true;
    this.water.surgeM = 0;
    if (hz.kind === 'storm' && !hz.rainRestored) {
      this.world.water.rainMPerS = hz.prevRainMPerS;
      hz.rainRestored = true;
    }
    this.hazardChanged = true;
  }

  /** End the current event now (rain back to normal, sea back down); the flood record is kept. */
  stopHazard(): void {
    const hz = this.hazard;
    if (!hz || hz.done) return;
    this.syncWater();
    this.finishHazard(hz);
    this.hazardHook();
  }

  /** After stepping: when an event ended, fold the GPU peak record, stop recording and log the result. */
  private hazardHook() {
    if (!this.hazardChanged) return;
    this.hazardChanged = false;
    const hz = this.hazard;
    if (hz?.done && this.water.peakDepth) {
      this.syncWater();
      this.water.peakDepth = null;
      const f = this.floodSummary()!;
      this.hazardLog.push({
        simS: hz.startS + hz.elapsedS,
        text: `${hz.label} ended: ${(f.areaM2 / 1e6).toFixed(3)} km² flooded, deepest ${f.peakDepthM.toFixed(1)} m`,
      });
    }
    this.emit({ type: 'water-params-changed' });
  }

  /** Flood extent of the current / last event (call syncWater first while one is running). */
  floodSummary(): FloodSummary | null {
    return this.flood ? floodSummary(this.flood.peak, this.flood.start, this.world.cellSizeM) : null;
  }

  /** Last earthquake (its shaking map drives the 'shaking' overlay). */
  lastQuake: QuakeResult | null = null;

  /** Earthquake event: persistent fault deformation (+ optional landslides), undoable as one edit. */
  earthquake(o: QuakeOptions): QuakeResult {
    this.syncWater();
    const rec = new StrokeRecorder(this.world, `M${o.mw.toFixed(1)} earthquake`);
    const res = earthquake(this.world, this.surface, o, rec.capture);
    const cmd = rec.finish();
    if (cmd) {
      this.history.push(cmd);
      this.emit({ type: 'history-changed' });
    }
    this.lastQuake = res;
    this.markDirty(res.rect);
    if (this.gpu) this.gpu.uploadWater(); // strike-slip moved water columns
    this.vegetationRevision++;
    this.emit({ type: 'climate-changed' }); // overlay refresh
    return res;
  }

  /**
   * Landslide event at (xM, yM): saturate and weaken a zone, let it fail (undoable as one edit).
   */
  landslide(xM: number, yM: number, radiusM: number, weakening = 0.5): LandslideResult {
    this.syncWater();
    const rec = new StrokeRecorder(this.world, 'Landslide');
    const res = triggerLandslide(this.world, this.surface, { xM, yM, radiusM, weakening, iterations: 120 }, rec.capture);
    const cmd = rec.finish();
    if (cmd) {
      this.history.push(cmd);
      this.markDirty(res.rect);
      this.emit({ type: 'history-changed' });
    }
    return res;
  }

  /** GPU erosion keeps changing the bed: pull it before a CPU-side terrain edit. */
  private syncIfGpuErodes() {
    if (this.gpu && this.erosionActive && this.clock.playing) this.syncWater();
  }

  undo(): void {
    if (this.stroke) this.endStroke();
    this.syncIfGpuErodes();
    const r = this.history.undo(this.world);
    if (r) this.afterBulkEdit(r);
  }

  redo(): void {
    if (this.stroke) this.endStroke();
    this.syncIfGpuErodes();
    const r = this.history.redo(this.world);
    if (r) this.afterBulkEdit(r);
  }

  private afterBulkEdit(r: CellRect) {
    computeSurface(this.world, this.surface, r);
    this.markDirty(r);
    this.emit({ type: 'history-changed' });
  }

  markDirty(rect: CellRect): void {
    this.climateDirty = true;
    this.dirty = unionRect(this.dirty, rect);
    this.groundDirty = true;
    this.emit({ type: 'terrain-changed', rect });
  }

  /** Renderer takes and clears accumulated dirty region once per frame. */
  takeDirty(): CellRect | null {
    const d = this.dirty;
    this.dirty = null;
    return d;
  }
}
