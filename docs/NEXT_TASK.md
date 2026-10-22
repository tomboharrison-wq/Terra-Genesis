# One next executable task
ID: M04-C04
Goal: Guided local model of a rotational slump: a small high-resolution 2D cross-section (or 3D local mesh) of a saturated cohesive cliff where a circular slip surface is found by minimum factor of safety (simplified Bishop/Fellenius), the detached block rotates backward along the arc, exposing a back scarp and building a toe; rendered as real geometry in an inset/local view, clearly labelled "guided model".
Why now: E4 requires it; it is also the core of the coastal slumping lesson (M10). C01–C03 global slope physics is done.
Read only: spec E4 (`sed -n 417,424p docs/MASTER_SPEC.md`), src/sim/slopes/landslide.ts, src/renderer/TerrainScene.ts.
Change only: new src/local/slump/{model,render}.ts, a tool/panel to open it, tests/slump.test.ts.
Acceptance: factor of safety decreases with saturation; failure only below FoS 1; block area conserved (no hovering geometry); scarp + toe present; tests pass.
Do not touch: global solvers.
Done when: tests/typecheck/build/e2e pass, committed + pushed.
If interrupted: check model.ts tests first, then rendering.
Next candidate: M05-C01 shoreline + controllable sea level.
