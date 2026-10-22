# One next executable task
ID: M02-C01
Goal: WorldState gains `waterDepthM` (Float32Array) + `rainfallMPerS`; a fixed-dt SimClock advances simTimeSeconds; rainfall adds water volume; a WaterLedger records added/removed/stored volume (m³).
Why now: M01 terrain is complete; hydrology is the first physics milestone (spec E1, lines ~374–392).
Read only: src/engine/world.ts, src/engine/engine.ts, src/persistence/format.ts, spec E1 + C4 (`sed -n 308,392p docs/MASTER_SPEC.md`).
Change only: src/engine/world.ts (+field), new src/sim/water/{field,ledger}.ts, new src/engine/clock.ts, format.ts (add field, bump WORLD_FORMAT_VERSION to 2 with v1 migration = zero water), tests/water.test.ts.
Acceptance tests: `npm test` — rain of R mm/h for T s on N cells adds exactly R/3.6e6*T*N*cs² m³ (ledger within 1e-6 rel); dry world stays dry; no negative/NaN depth; clock substeps identical for 1×60 Hz vs 4×15 Hz frames; v1 files still load.
Do not touch: renderer, brushes, UI (no Play button until M02-C05).
Done when: tests + typecheck + build pass, committed `feat(M02-C01): …`, docs updated.
If interrupted: check which of field/clock/ledger/format exist and have tests; continue from first missing.
Next candidate: M02-C02 — conservative pipe-flow water solver (downhill + depression tests).
