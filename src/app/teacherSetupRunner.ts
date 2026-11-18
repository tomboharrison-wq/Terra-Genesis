import { TEACHER_SETUPS } from '../education/teacherSetups';
import { defaultOptions, generateWorld } from '../terrain/generate';
import { setGeoMode } from './geoRunner';
import { engine, syncSim } from './runtime';
import { useUi } from '../state/uiStore';

export function teacherSetupLink(id: string): string {
  const u = new URL(location.href);
  u.search = '';
  u.hash = '';
  u.searchParams.set('teacher', id);
  return u.toString();
}

/** Load a deterministic classroom setup from a share link. */
export function launchTeacherSetupById(id: string): boolean {
  const setup = TEACHER_SETUPS.find((s) => s.id === id);
  if (!setup) return false;
  const ui = useUi.getState();
  const size = ui.classroom ? 128 : 256;
  const w = generateWorld(defaultOptions(setup.presetId, setup.seed, size));
  w.meta.name = `${setup.title.replace(/^\d+\.\s*/, '')} (Seed ${setup.seed})`;
  engine.replaceWorld(w);
  if (setup.presetId === 'river-delta') {
    setGeoMode(true);
    engine.enableLowlandMeander();
  } else if (setup.presetId === 'coastal-headland') engine.world.coast.wavesOn = true;
  else if (setup.presetId === 'alpine-glaciers') {
    engine.setClimateParams({ enabled: true, seaLevelTempC: -1 });
    engine.setGlacierParams({ enabled: true, slidingCoupling: 3, aspectBalance: 0.3, maxErosionMmYr: 10 });
  } else if (setup.presetId === 'rain-shadow') engine.setClimateParams({ enabled: true });
  syncSim();
  ui.toast(`Loaded shared lesson preset: ${setup.title}`, 'success');
  return true;
}
