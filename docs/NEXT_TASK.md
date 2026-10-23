# One next executable task
ID: M09-C03
Goal: Checkpoints, before/after comparison and differential maps (spec F3: "Save snapshots … physical history
is restored via snapshots, not by integrating time backwards … side-by-side comparison / height-difference
overlays"). Named in-memory checkpoints (world clone + time + label, a few, with memory estimate shown);
restore a checkpoint (replaceWorld, keeps camera); "compare with checkpoint": difference overlay of ground
(erosion/deposition), water depth, plants, ice between now and a chosen checkpoint, with legend and inspector,
plus a summary table (volumes moved, area changed, max change). Optional side-by-side split view is planned only
if cheap. Persist checkpoints in IndexedDB slots? (decide; label clearly if session-only).
Read only: engine replaceWorld/setReference/referenceSurface, persistence/idb, renderer/overlays.ts, cloneWorld.
Acceptance: restore gives identical arrays to the checkpoint; difference volumes equal sums of cell
differences; e2e: checkpoint, sculpt/erode, compare shows change, restore returns exact checksum.
Done when: tests/typecheck/build/e2e pass, committed + pushed.
