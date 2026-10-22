# One next executable task
ID: M05-C01
Goal: Sea level becomes a live control (slider in a Coast panel) that re-derives the coastline (sea mask) for water + sediment on CPU and GPU, with the shoreline drawn crisply; ocean shading improved (depth colour already from heightmap). Sea-level change ledgers water exchange correctly.
Why now: M04 done; coasts (spec E6, `sed -n 431,446p docs/MASTER_SPEC.md`) start from a controllable shoreline.
Read only: src/engine/engine.ts, src/sim/water/{waterSim,gpuWater}.ts (sea = z < seaLevel), src/renderer/{TerrainScene,shaders,waterLayer}.ts.
Change only: engine (setSeaLevel), renderer sea plane update, new src/app/CoastPanel.tsx, tests.
Acceptance: raising sea level floods low land (sea mask grows), lowering exposes shelf; water/sediment ledgers still close; GPU and CPU agree; e2e check.
Do not touch: erosion numerics.
Done when: tests/typecheck/build/e2e/gpu-check pass, committed + pushed.
If interrupted: engine setter + tests first, then renderer, then UI.
Next candidate: M05-C02 wave energy/incidence and lithology-dependent cliff retreat.
