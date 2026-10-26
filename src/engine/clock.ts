/**
 * Fixed-step simulation clock (spec C4). Real frame time × speed accrues as "sim-time debt";
 * the solver consumes it in steps whose size depends only on world state, so the same total
 * elapsed sim time yields the same sequence of steps regardless of frame rate.
 * Work per frame is capped by a wall-clock budget; unpaid debt beyond one frame is dropped
 * (the achieved speed is reported) so the app never spirals. GPU steps are queued cheaply and run
 * later, so the CPU budget alone cannot see a slow graphics chip: an adaptive step cap per frame
 * shrinks when real frames get slow and grows back when they are quick, keeping the page responsive
 * at any requested speed.
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

  /** Upper limit of the adaptive per-frame step cap. */
  maxStepsPerFrame = 64;
  /** Current per-frame step cap (adapts to the real frame time). */
  stepCap = 64;

  constructor(public budgetMs = 10) {}

  /** Advance by a real frame of `realDt` seconds. Returns simulated seconds advanced. */
  tick(s: Stepper, realDt: number, now: () => number = () => performance.now()): number {
    if (!this.playing || realDt <= 0) {
      this.lastSteps = 0;
      return 0;
    }
    // Frames slower than 10 fps: take fewer steps next time; frames faster than 20 fps: allow a few more.
    if (realDt > 0.1) this.stepCap = Math.max(1, Math.floor(this.stepCap * 0.6));
    else if (realDt < 0.05) this.stepCap = Math.min(this.maxStepsPerFrame, this.stepCap + 2);
    this.debt += realDt * this.speed;
    const simDone = this.consume(s, now, this.stepCap);
    const inst = simDone / realDt;
    this.achievedSpeed += (inst - this.achievedSpeed) * 0.1;
    return simDone;
  }

  /** Run exactly `seconds` of simulated time ignoring the budget (tests, Step button). */
  advanceExactly(s: Stepper, seconds: number): number {
    this.debt += seconds;
    return this.consume(s, () => 0, Infinity);
  }

  private consume(s: Stepper, now: () => number, cap: number): number {
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
      if (now() - t0 > this.budgetMs || steps >= cap) {
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
