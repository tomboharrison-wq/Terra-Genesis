# One next executable task
ID: M05-C05
Goal: Guided local 3D model (like the slump lab): a headland block with a vertical joint/fault of weakness, eroded by waves at sea level; erosion concentrated along the weakness enlarges a cave on both sides until they connect (arch with a real opening), the arch roof thins and collapses (stack), the stack is undercut and reduced to a stump. Real 3D geometry (voxel/SDF + surface extraction), staged and animated, labelled for teaching.
Why now: spec E6/G3 requirement; heightfields cannot represent openings.
Read only: spec E6 cave paragraph (`sed -n 441,442p docs/MASTER_SPEC.md`), src/local/slump/model.ts + src/app/SlumpLab.tsx (pattern).
Change only: new src/local/arch/{model,mesh}.ts, src/app/ArchLab.tsx, tests/arch.test.ts.
Acceptance: opening exists (a path of empty voxels through the headland at the arch stage — topology test), stack disconnected from mainland, stump below high-water, volume removed = volume eroded ledger, deterministic stages.
Do not touch: global solvers.
Done when: tests/typecheck/build/e2e pass, committed + pushed.
If interrupted: model.ts + topology tests first, then mesh + UI.
Backlog: M05-C04b one-line shoreline model (bars/lagoons/recurves).
