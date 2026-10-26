import { describe, expect, it } from 'vitest';
import { engine, setTimeLapse, TIME_LAPSE } from '../src/app/runtime';
import { useUi } from '../src/state/uiStore';

describe('simulator time-lapse', () => {
  it('switches on the fastest speed and maximum landscape acceleration, then restores the user settings', () => {
    const w = engine.world;
    engine.setSpeed(600);
    engine.setErosionParams({ speedup: 25 });
    engine.setGlacierParams({ yearsPerSimHour: 10 });
    engine.setVegetationParams({ yearsPerSimHour: 5 });
    setTimeLapse(true);
    expect(useUi.getState().timeLapse).toBe(true);
    expect(engine.clock.speed).toBe(TIME_LAPSE.speed);
    expect(w.erosion.speedup).toBe(TIME_LAPSE.speedup);
    expect(w.glacier.yearsPerSimHour).toBe(TIME_LAPSE.years);
    expect(w.vegetation.yearsPerSimHour).toBe(TIME_LAPSE.years);
    expect(engine.clock.playing).toBe(true);
    setTimeLapse(false);
    expect(useUi.getState().timeLapse).toBe(false);
    expect(engine.clock.speed).toBe(600);
    expect(w.erosion.speedup).toBe(25);
    expect(w.glacier.yearsPerSimHour).toBe(10);
    expect(w.vegetation.yearsPerSimHour).toBe(5);
    engine.setPlaying(false);
  });
});
