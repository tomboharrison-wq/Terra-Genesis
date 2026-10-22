# One next executable task
ID: M05-C04b
Goal: One-line shoreline model (Ashton & Murray-style CEM) for sandy coasts: shoreline as a polyline (or per-column shoreline position) with alongshore flux Q(θ) = K·H^{5/2}·sin(2(θ_wave − θ_shore)) and continuity dX/dt = −(1/D)·dQ/ds; spits extend at coast ends, recurve with wave-angle changes, and bay-mouth bars close lagoons. Couple to the heightfield by rasterising the sandy shore band each coastal update.
Why now: grid drift (coastSim.ts) yields tombolos/salients but not emergent spits/bars (documented in tests/coast.test.ts).
Read only: src/sim/coast/coastSim.ts, tests/coast.test.ts, spec E6 (`sed -n 431,446p docs/MASTER_SPEC.md`).
Change only: new src/sim/coast/shoreline.ts, coupling in coastSim.ts, tests.
Acceptance: spit grows from a coast end and becomes land; changing wave direction recurves its tip; a bar closes a bay mouth enclosing a lagoon; sand conserved.
Do not touch: water/sediment solvers.
Done when: tests/typecheck/build/e2e pass, committed + pushed.
If interrupted: shoreline.ts unit tests first.
Next candidate: M05-C05 local 3D cave → arch → stack → stump guided model.
