# One next executable task
ID: M04-C01
Goal: Layered stratigraphy: per-cell stack of up to N bedrock layers (material + thickness) below the surface so erosion exposes the next lithology; erodibility and colour follow the exposed layer; layered-plateau preset uses it.
Why now: M03 erosion works; spec E3/E4 (`sed -n 411,424p docs/MASTER_SPEC.md`) needs real layers for cap-rock/scarp retreat and the waterfall lesson later.
Read only: src/engine/world.ts, src/terrain/{materials,generate}.ts, src/sim/sediment/sedimentSim.ts, src/sim/water/gpuWater.ts (bed.a = erodibility), src/persistence/format.ts.
Change only: world.ts (+layer fields), generate.ts (plateau/headland layers), sedimentSim.ts + gpuWater.ts (erodibility from exposed layer), renderer palette, format v4, tests.
Acceptance: eroding through a hard cap exposes the weak layer (erodibility rises, colour changes); layers never negative; GPU matches CPU (gpu-check); v3 files load.
Do not touch: water solver numerics.
Done when: tests/typecheck/build/e2e/gpu-check pass, committed + pushed.
If interrupted: check which of fields/generation/erosion coupling/GPU/format exist with tests.
Next candidate: M04-C02 weathering + creep tuning; M04-C03 saturation-triggered landslides.
