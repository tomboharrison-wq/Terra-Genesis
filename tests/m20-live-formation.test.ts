import { describe, expect, it } from 'vitest';
import { Engine } from '../src/engine/engine';
import { defaultOptions, generateWorld } from '../src/terrain/generate';
import { decodeWorld, encodeWorld } from '../src/persistence/format';
import { activeHeadlandInfo, activeWaterfallInfo } from '../src/sim/geology/coupledPatches';
import { detectLiveLandforms } from '../src/education/liveDetector';
import { FORMATIONS } from '../src/education/landforms/content';
import { lessonById } from '../src/education/lessons';

describe('M20: Coupled 3D Voxel Patches, Universal Live Landform Detector & 17-Formation Live 3D Wiring', () => {
  it('M20-C01a: coupled 3D waterfall patch embeds on an ordinary river landscape, undercuts, scours a plunge pool, collapses caprock, retreats, and couples to the heightfield', () => {
    const w = generateWorld(defaultOptions('river-basin', 2001, 64));
    const engine = new Engine(w);
    const patch = engine.enableEmbeddedWaterfall();
    expect(patch).not.toBeNull();
    const bedBefore = w.bedrockElevationM[patch!.cellIndex];

    // Run geological steps so the embedded 3D waterfall erodes, undercuts, and collapses caprock
    for (let k = 0; k < 12; k++) {
      engine.geoStep(5000);
    }

    const info = activeWaterfallInfo(w);
    expect(info).not.toBeNull();
    expect(info!.poolDepthM).toBeGreaterThan(0);
    expect(info!.erodedM3).toBeGreaterThan(0);
    expect(info!.collapsedM3).toBeGreaterThan(0);
    expect(info!.retreatM).toBeGreaterThan(0);
    expect(w.bedrockElevationM[patch!.cellIndex]).toBeLessThan(bedBefore);

    // Save/load round-trip preserves the embedded 3D waterfall state
    const restored = decodeWorld(encodeWorld(w)).world;
    expect(restored.meta.embeddedWaterfall).toEqual(w.meta.embeddedWaterfall);
  });

  it('M20-C01b: coupled 3D headland patch embeds on an ordinary coastal landscape and evolves through cave, arch, stack, and stump while coupling to the coast', () => {
    const w = generateWorld(defaultOptions('coastal-headland', 2002, 64));
    w.coast.wavesOn = true;
    const engine = new Engine(w);
    const patch = engine.enableEmbeddedHeadland();
    expect(patch).not.toBeNull();
    const bedBefore = w.bedrockElevationM[patch!.cellIndex];

    let sawCaveOrArch = false;
    for (let k = 0; k < 25; k++) {
      engine.geoStep(3000);
      const info = activeHeadlandInfo(w);
      if (info && (info.stage === 'cave' || info.stage === 'arch' || info.stage === 'stack' || info.stage === 'stump')) {
        sawCaveOrArch = true;
      }
      if (info?.stage === 'stump') break;
    }

    const finalInfo = activeHeadlandInfo(w)!;
    expect(sawCaveOrArch).toBe(true);
    expect(finalInfo.exportedM3).toBeGreaterThan(0);
    expect(w.bedrockElevationM[patch!.cellIndex]).toBeLessThan(bedBefore);

    const historyStages = patch!.headland.history.map((h) => h.stage);
    expect(historyStages).toContain('cave');
    expect(historyStages).toContain('arch');
  }, 180000); // ~55 s on a slower or busy machine (30 s was too tight)

  it('M20-C02: detectLiveLandforms automatically detects and measures river, meander, estuary, 3D waterfall, coastal, and glacial landforms on 3D worlds', () => {
    // 1. River-to-sea world with meanders, estuary, and coupled 3D waterfall
    const wRiver = generateWorld(defaultOptions('river-delta', 1701, 64));
    const eRiver = new Engine(wRiver);
    eRiver.enableLowlandMeander();
    eRiver.enableEmbeddedWaterfall();
    eRiver.geoStep(4000);

    const riverItems = detectLiveLandforms(eRiver);
    const riverIds = riverItems.map((x) => x.id);
    expect(riverIds).toContain('waterfall-3d');
    expect(riverIds).toContain('meander-belt');
    expect(riverIds).toContain('river-cliff-point-bar');
    for (const it of riverItems) {
      expect(Number.isFinite(it.xM)).toBe(true);
      expect(Number.isFinite(it.yM)).toBe(true);
      expect(it.process.length).toBeGreaterThan(30);
    }

    // 2. Coastal headland world with coupled 3D headland
    const wCoast = generateWorld(defaultOptions('coastal-headland', 1704, 64));
    wCoast.coast.wavesOn = true;
    const eCoast = new Engine(wCoast);
    eCoast.enableEmbeddedHeadland();
    eCoast.geoStep(2000);
    const coastItems = detectLiveLandforms(eCoast);
    const coastIds = coastItems.map((x) => x.id);
    expect(coastIds).toContain('headland-3d');
    expect(coastIds.some((id) => id.startsWith('coast-'))).toBe(true);

    // 3. Glaciated upland world
    const wGlacial = generateWorld(defaultOptions('alpine-glaciers', 1705, 64));
    const eGlacial = new Engine(wGlacial);
    eGlacial.setClimateParams({ enabled: true, seaLevelTempC: -1 });
    eGlacial.setGlacierParams({ enabled: true, slidingCoupling: 3, aspectBalance: 0.35, maxErosionMmYr: 10 });
    eGlacial.geoStep(6000);
    const glacialItems = detectLiveLandforms(eGlacial);
    expect(glacialItems.some((it) => it.category === 'glacial')).toBe(true);
  });

  it('M20-C04: every single one of the 17 GCSE formations in LandformShow is wired to a live 3D model lesson', () => {
    expect(FORMATIONS.length).toBe(17);
    for (const f of FORMATIONS) {
      expect(f.modelLesson).toBeDefined();
      const lesson = lessonById(f.modelLesson!);
      expect(lesson).toBeDefined();
      expect(lesson!.kind).toBe('emergent');
    }
  });
});
