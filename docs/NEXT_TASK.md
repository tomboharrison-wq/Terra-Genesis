# One next executable task
ID: M09-C04
Goal: Scenario / challenge evaluation from actual world metrics (spec F6 "Challenge mode (defer until core physics
works)" — read MASTER_SPEC F6 only). A small set of challenges whose goals are measured from the simulation, not
guessed: e.g. "Make a river reach the sea" (connected flow path from a source to sea, via flow accumulation /
water depth), "Build a delta" (sediment deposited at a river mouth > X m³), "Form an oxbow / waterfall" only if
detectable honestly (else omit), "Grow an island above sea", "Stop a landslide" (slope stability), "Keep a
village dry in a flood" (water depth at a marked point < X). Each: setup (preset/seed + markers), live metric
with units, pass condition, time limit in simulated time, result screen with the measured numbers. Use
checkpoints for retry. Only challenges with robust metrics.
Read only: MASTER_SPEC F6, terrain/measure.ts, renderer/overlays.ts (flowAccumulation), engine checkpoints.
Acceptance: unit tests per metric on hand-built worlds (pass and fail cases); e2e runs one challenge to pass.
Done when: tests/typecheck/build/e2e pass, committed + pushed.
