# One next executable task
ID: M05-C04b
Goal: One-line shoreline model for depositional coasts: shoreline position per alongshore cell, CERC flux
Q ∝ H^2.5 sin2α with high-angle instability, spit extension across bay mouths (bay-mouth bar enclosing a lagoon),
recurved tips under a second wave direction; write results back into the heightfield as real sand.
Why now: last E6 gap (bars/lagoons/recurves unreliable on the grid drift).
Read only: src/sim/coast/coastSim.ts (drift section), tests/coast.test.ts, spec E6 (`sed -n 431,446p docs/MASTER_SPEC.md`).
Acceptance: bar closes a 12-cell bay mouth leaving a lagoon (sea cells cut off from open sea); recurve when wave
direction alternates; sand conserved 1e-6.
Done when: tests/typecheck/build/e2e pass, committed + pushed. Then M06 (climate) per BACKLOG / spec Part J.
