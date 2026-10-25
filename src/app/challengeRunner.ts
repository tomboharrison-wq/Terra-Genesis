import { useUi } from '../state/uiStore';
import { challengeById, makeBaseline, type Baseline } from '../challenges/challenges';
import { engine, newWorld, onSync, onWorldReplaced, syncSim } from './runtime';

/**
 * Runs the active challenge (spec F6): seeded start, a start checkpoint for retries, and scoring from the
 * world on every UI sync. The baseline (start surface, sea mask, zone, sea-inflow samples) lives here.
 */
let baseline: Baseline | null = null;
let startCheckpoint = -1;
let starting = false;

export function startChallenge(id: string): void {
  const def = challengeById(id);
  if (!def) return;
  starting = true;
  newWorld(def.setup);
  starting = false;
  engine.setPlaying(false);
  baseline = makeBaseline(engine, def);
  startCheckpoint = engine.takeCheckpoint(`Start: ${def.title}`).id;
  useUi.getState().set({
    dialog: null,
    challenge: { id, status: 'running', text: '', fraction: 0, elapsedS: 0 },
  });
  evaluateChallenge();
}

export function retryChallenge(): void {
  const c = useUi.getState().challenge;
  const def = c && challengeById(c.id);
  if (!c || !def) return;
  starting = true;
  const ok = engine.restoreCheckpoint(startCheckpoint);
  starting = false;
  if (!ok) return startChallenge(c.id);
  engine.setPlaying(false);
  baseline = makeBaseline(engine, def);
  useUi.getState().set({ challenge: { ...c, status: 'running', elapsedS: 0 } });
  evaluateChallenge();
  syncSim();
}

export function quitChallenge(): void {
  baseline = null;
  useUi.getState().set({ challenge: null });
}

// A different world was loaded: the challenge cannot continue on it.
onWorldReplaced((keepCamera) => {
  if (!starting && !keepCamera && useUi.getState().challenge) quitChallenge();
});
onSync(() => evaluateChallenge());

/** Score the challenge from the current world (called from syncSim). */
export function evaluateChallenge(): void {
  const c = useUi.getState().challenge;
  if (!c || c.status !== 'running' || !baseline) return;
  const def = challengeById(c.id);
  if (!def) return;
  const t = engine.world.simTimeSeconds;
  const last = baseline.seaOut[baseline.seaOut.length - 1];
  if (t > last.t) baseline.seaOut.push({ t, v: engine.water.ledger.seaOut });
  if (baseline.seaOut.length > 4000) baseline.seaOut.splice(0, baseline.seaOut.length - 4000);
  const p = def.measure(engine, baseline);
  const elapsed = t - baseline.startSimS;
  const timeUp = def.timeLimitS !== null && elapsed >= def.timeLimitS;
  const status = p.pass ? 'passed' : timeUp ? 'failed' : 'running';
  useUi.getState().set({
    challenge: {
      id: c.id,
      status,
      text: p.text,
      fraction: Math.min(1, p.value / p.target),
      elapsedS: elapsed,
    },
  });
  if (status !== 'running') {
    engine.setPlaying(false);
    useUi.getState().toast(status === 'passed' ? `Challenge complete: ${def.title}` : `Time is up: ${def.title}`, status === 'passed' ? 'success' : 'info');
  }
}
