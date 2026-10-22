# One next executable task
ID: M07-C02
Goal: Faults (spec E9: divergent rifting with normal faulting; transform with persistent lateral offset).
(1) Divergent boundaries: replace the smooth rift trough with fault-bounded blocks — a central graben dropping,
step faults (normal-fault scarps) at set spacing parallel to the boundary, shoulders slightly uplifted.
(2) Transform boundaries: accumulate slip (mm/yr × years) and, when it exceeds a cell, shift the terrain
columns (bedrock, sediment, strata, water) on one side by one cell along the fault — rivers and ridges crossing
the fault become visibly offset; exact conservation (columns moved, not created). (3) Fault lines drawn on the
map; ledger of slip. Tests: offset of a straight ridge after N cells of slip; conservation; graben depth ∝ time.
Read only: src/sim/tectonics/plates.ts, spec E9.
Done when: tests/typecheck/build/e2e pass, committed + pushed.
