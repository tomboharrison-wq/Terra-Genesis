# One next executable task
ID: M03-C01
Goal: Material registry gains erosion properties (erodibility K, critical shear/threshold, density, porosity); world gains a suspended-sediment field `sedimentSuspendedM` (m of deposit-equivalent per cell) + sediment ledger; save format v3 (v2 migrates with zero suspended load).
Why now: M02 water is complete; erosion (spec E2, `sed -n 393,410p docs/MASTER_SPEC.md`) needs material properties and a conserved sediment inventory first.
Read only: src/engine/world.ts, src/terrain/materials.ts, src/sim/water/{waterSim,gpuWater}.ts, src/persistence/format.ts.
Change only: materials.ts, world.ts, new src/sim/sediment/{ledger,field}.ts, format.ts, tests/sediment-*.test.ts.
Acceptance: sediment ledger (eroded = suspended + deposited + exported) exact on synthetic transfers; v2 files load; no negative fields.
Do not touch: renderer, UI (except nothing), water solver numerics.
Done when: tests/typecheck/build pass, committed + pushed.
If interrupted: check which of registry/field/ledger/format exist with tests.
Next candidate: M03-C02 transport capacity + advection of suspended sediment with the water flux (CPU ref, then GPU).
