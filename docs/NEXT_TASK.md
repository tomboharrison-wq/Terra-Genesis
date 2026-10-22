# One next executable task
ID: M07-C01
Goal: Kinematic plates (spec E9; no mantle solver). Plate map: per-cell plate id (format v9) from seeded
Voronoi-like regions or user-painted; each plate a rigid velocity (mm/yr, direction). Boundaries classified from
relative motion (divergent / convergent / transform) per boundary cell. Tectonic step on a slow cadence in
geomorphic time (yearsPerSimHour, like glaciers): convergent boundaries uplift bedrock in a band (rate ∝ normal
convergence, wider/higher for continental), divergent subside/rift, isostatic-free simple rules, all as real
bedrock changes ledgered (uplift volume). Plates panel + boundary overlay + a cross-section view along the
profile tool line showing plates and motion arrows (labelled schematic).
Read only: spec E9 (`sed -n '/^## E9/,/^## E10/p' docs/MASTER_SPEC.md`), src/engine/engine.ts hooks,
src/app/ProfilePanel.tsx, TerrainScene overlays.
Acceptance: two plates converging raise a ridge along their boundary at the expected rate; diverging lower a
rift; transform: no vertical change; uplift ledger = Δ bedrock volume; deterministic; save/load.
Done when: tests/typecheck/build/e2e pass, committed + pushed.
