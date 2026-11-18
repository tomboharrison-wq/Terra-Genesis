export interface AudioSettings {
  enabled: boolean;
  master: number;
  sfx: number;
  music: number;
  classroomMute: boolean;
}

export function effectiveAudioLevels(settings: AudioSettings, classroom: boolean) {
  const muted = !settings.enabled || (classroom && settings.classroomMute);
  return {
    master: muted ? 0 : Math.max(0, Math.min(1, settings.master)),
    sfx: Math.max(0, Math.min(1, settings.sfx)),
    music: Math.max(0, Math.min(1, settings.music)),
  };
}

let context: AudioContext | null = null;
let masterGain: GainNode | null = null;
let sfxGain: GainNode | null = null;
let musicGain: GainNode | null = null;

function createGraph() {
  if (context) return;
  context = new AudioContext();
  masterGain = context.createGain();
  sfxGain = context.createGain();
  musicGain = context.createGain();
  sfxGain.connect(masterGain);
  musicGain.connect(masterGain);
  masterGain.connect(context.destination);

  // Filtered wind noise provides a quiet landscape bed without downloaded audio assets.
  const noiseBuffer = context.createBuffer(1, context.sampleRate * 3, context.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < data.length; i++) {
    last = last * 0.985 + (Math.random() * 2 - 1) * 0.015;
    data[i] = last;
  }
  const wind = context.createBufferSource();
  wind.buffer = noiseBuffer;
  wind.loop = true;
  const windFilter = context.createBiquadFilter();
  windFilter.type = 'lowpass';
  windFilter.frequency.value = 650;
  const windGain = context.createGain();
  windGain.gain.value = 0.34;
  wind.connect(windFilter).connect(windGain).connect(musicGain);
  wind.start();

  // A soft sustained chord acts as unobtrusive presentation music.
  for (const [hz, level] of [[110, 0.028], [164.81, 0.018], [220, 0.012]] as const) {
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = 'sine';
    osc.frequency.value = hz;
    gain.gain.value = level;
    osc.connect(gain).connect(musicGain);
    osc.start();
  }
}

export async function enableAudio(settings: AudioSettings, classroom: boolean) {
  createGraph();
  if (context?.state === 'suspended') await context.resume();
  syncAudio(settings, classroom);
}

export function syncAudio(settings: AudioSettings, classroom: boolean) {
  if (!context || !masterGain || !sfxGain || !musicGain) return;
  const v = effectiveAudioLevels(settings, classroom);
  const t = context.currentTime;
  masterGain.gain.setTargetAtTime(v.master, t, 0.04);
  sfxGain.gain.setTargetAtTime(v.sfx * 0.22, t, 0.04);
  musicGain.gain.setTargetAtTime(v.music * 0.18, t, 0.08);
}

export type SoundEffect = 'tool' | 'water' | 'event' | 'success';

export function playSfx(kind: SoundEffect) {
  if (!context || !sfxGain || masterGain?.gain.value === 0) return;
  const now = context.currentTime;
  const osc = context.createOscillator();
  const gain = context.createGain();
  const frequency = kind === 'water' ? 420 : kind === 'event' ? 90 : kind === 'success' ? 660 : 240;
  osc.type = kind === 'event' ? 'sawtooth' : 'sine';
  osc.frequency.setValueAtTime(frequency, now);
  osc.frequency.exponentialRampToValueAtTime(Math.max(45, frequency * (kind === 'success' ? 1.35 : 0.62)), now + 0.16);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(kind === 'event' ? 0.5 : 0.24, now + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.19);
  osc.connect(gain).connect(sfxGain);
  osc.start(now);
  osc.stop(now + 0.2);
}
