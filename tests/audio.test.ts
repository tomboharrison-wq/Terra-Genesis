import { describe, expect, it } from 'vitest';
import { effectiveAudioLevels, type AudioSettings } from '../src/app/audio';

describe('M18-C09 audio controls', () => {
  const settings: AudioSettings = { enabled: true, master: 0.7, sfx: 0.5, music: 0.25, classroomMute: true };

  it('keeps master, effects and music as separate bounded controls', () => {
    expect(effectiveAudioLevels(settings, false)).toEqual({ master: 0.7, sfx: 0.5, music: 0.25 });
    expect(effectiveAudioLevels({ ...settings, master: 2, sfx: -1 }, false)).toEqual({ master: 1, sfx: 0, music: 0.25 });
  });

  it('is silent until enabled and honours classroom mute', () => {
    expect(effectiveAudioLevels({ ...settings, enabled: false }, false).master).toBe(0);
    expect(effectiveAudioLevels(settings, true).master).toBe(0);
    expect(effectiveAudioLevels({ ...settings, classroomMute: false }, true).master).toBe(0.7);
  });
});
