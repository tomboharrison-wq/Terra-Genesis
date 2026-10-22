# One next executable task
ID: M05-C04
Goal: Parameterised coastal-deposition scenarios built from the existing drift physics: (1) spit across a bay mouth → bar + lagoon, (2) offshore island → tombolo (sheltered lee collects drift), (3) recurved spit end after a wave-direction change. Each with a seeded preset and a numerical assertion (connected sand ridge above sea level; lagoon enclosed; sediment conserved).
Why now: C01–C03 provide sea level, waves, drift; spec E6 + J1 `coastal-sediment` fixture.
Read only: src/sim/coast/coastSim.ts, src/terrain/generate.ts, tests/coast.test.ts.
Change only: generate.ts (scenario presets), coastSim.ts (only if a physics gap is proven by a failing test), tests.
Acceptance: tests show bar/tombolo/recurve emerge from drift alone; e2e loads each preset.
Do not touch: water/sediment solvers.
Done when: tests/typecheck/build/e2e pass, committed + pushed.
If interrupted: scenario fixtures in tests first.
Next candidate: M05-C05 local 3D solid geometry: cave → arch → stack → stump (guided model, like the slump lab).
