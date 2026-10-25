import { Dialog } from './Dialog';
import { useUi } from '../state/uiStore';
import { CHALLENGES, challengeById } from '../challenges/challenges';
import { quitChallenge, retryChallenge, startChallenge } from './challengeRunner';

const fmtSpan = (s: number) =>
  s >= 86400 ? `${(s / 86400).toFixed(s >= 10 * 86400 ? 0 : 1)} days` : s >= 3600 ? `${(s / 3600).toFixed(1)} h` : `${Math.round(s / 60)} min`;

/** Challenge picker (spec F6). Starting one replaces the current world with the challenge's seeded start. */
export function ChallengesDialog() {
  const close = () => useUi.getState().set({ dialog: null });
  return (
    <Dialog title="Challenges" onClose={close}>
      <p className="hint small tight">
        Each challenge starts from the same seeded world and is scored only from what the simulation measures. Starting one replaces the current world — Save
        first if you want to keep it.
      </p>
      <ul className="challenge-list">
        {CHALLENGES.map((c) => (
          <li key={c.id}>
            <div>
              <b>{c.title}</b>
              <p className="small">{c.brief}</p>
              <p className="muted small">{c.rule}</p>
            </div>
            <button className="primary" onClick={() => startChallenge(c.id)}>
              Start
            </button>
          </li>
        ))}
      </ul>
    </Dialog>
  );
}

/** Live score card over the map while a challenge runs, and its result. */
export function ChallengeHud() {
  const c = useUi((s) => s.challenge);
  if (!c) return null;
  const def = challengeById(c.id);
  if (!def) return null;
  const left = def.timeLimitS === null ? null : Math.max(0, def.timeLimitS - c.elapsedS);
  return (
    <div className={`challenge-hud ${c.status}`} role="status" aria-live="polite">
      <div className="challenge-head">
        <b>{def.title}</b>
        <span className="muted small">
          {c.status === 'running' ? (left === null ? 'no time limit' : `${fmtSpan(left)} left`) : c.status === 'passed' ? 'Complete!' : 'Time is up'}
        </span>
      </div>
      <div className="meter" aria-hidden="true">
        <i style={{ width: `${Math.round(c.fraction * 100)}%` }} />
      </div>
      <p className="small tight">{c.text || 'Measuring…'}</p>
      {c.status !== 'running' && (
        <p className="small tight">
          {c.status === 'passed' ? 'Goal reached' : 'Goal not reached'} after {fmtSpan(c.elapsedS)} of simulated time. {def.rule}
        </p>
      )}
      <div className="row">
        <button className="small" onClick={retryChallenge}>
          Retry
        </button>
        <button className="small ghost" onClick={quitChallenge}>
          {c.status === 'running' ? 'Give up' : 'Close'}
        </button>
      </div>
    </div>
  );
}
