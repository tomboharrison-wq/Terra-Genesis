/**
 * Fixed-step simulation clock (spec C4). Real frame time × speed accrues as "sim-time debt";
 * the solver consumes it in steps whose size depends only on world state, so the same total
 * elapsed sim time yields the same sequence of steps regardless of frame rate.
 * Work per frame is capped by a wall-clock budget; unpaid debt beyond one frame is dropped
 * (the achieved speed is reported) so the app never spirals.
 */
export interface Stepper {
  /** Stable step size for the current state (s). */
  stableDt(): number;
  step(dt: number): void;
}

export class SimClock {
  playing = false;
  /** Requested simulated seconds per real second. */
  speed = 60;
  private debt = 0;
  /** Achieved simulated seconds per real second (EMA). */
  achievedSpeed = 0;
  lastSteps = 0;

  constructor(public budgetMs = 10) {}

  /** Advance by a real frame of `realDt` seconds. Returns simulated seconds advanced. */
  tick(s: Stepper, realDt: number, now: () => number = () => performance.now()): number {
    if (!this.playing || realDt <= 0) {
      this.lastSteps = 0;
      return 0;
    }
    this.debt += realDt * this.speed;
    const simDone = this.consume(s, now);
    const inst = simDone / realDt;
    this.achievedSpeed += (inst - this.achievedSpeed) * 0.1;
    return simDone;
  }

  /** Run exactly `seconds` of simulated time ignoring the budget (tests, Step button). */
  advanceExactly(s: Stepper, seconds: number): number {
    this.debt += seconds;
    return this.consume(s, () => 0);
  }

  private consume(s: Stepper, now: () => number): number {
    const t0 = now();
    let done = 0;
    let steps = 0;
    for (;;) {
      const dt = s.stableDt();
      if (this.debt < dt) break;
      s.step(dt);
      this.debt -= dt;
      done += dt;
      steps++;
      if (now() - t0 > this.budgetMs) {
        // Over budget: drop the backlog beyond one step so we do not spiral.
        this.debt = Math.min(this.debt, dt);
        break;
      }
    }
    this.lastSteps = steps;
    return done;
  }

  reset() {
    this.debt = 0;
    this.achievedSpeed = 0;
  }
}
