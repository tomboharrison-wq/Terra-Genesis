# One next executable task
ID: M02-C03
Goal: Run the water step on the GPU (WebGL2 float render targets, ping-pong) so 256² reaches ≥1 h sim time per real second; CPU WaterSim stays the tested reference.
Why now: benchmark: CPU route ≈20 ms/step at 256², dt≈1 s → ~50× too slow for visible river formation.
Read only: src/sim/water/waterSim.ts (reference algorithm, local-inertial pipes), src/engine/clock.ts, src/renderer/TerrainScene.ts.
Change only: new src/sim/water/gpuWater.ts (+ shaders), engine wiring, tests comparing GPU vs CPU on fixtures in headless Chromium (scripts/), docs.
Acceptance: GPU vs CPU depth max-abs diff < 1 cm on bowl/slope fixtures after 600 s; ledger closes < 1e-3 (GPU reduction); feature-detect EXT_color_buffer_float, fall back to CPU at lower speed.
Do not touch: terrain brushes, persistence format.
Done when: e2e passes, tests/typecheck/build pass, committed.
If interrupted: check gpuWater.ts existence + which shader passes work.
Next candidate: M02-C04 water rendering from real depth/velocity; M02-C05 Play/Pause/Step/Speed + rain brush UI.
