# Project state
Updated: 2026-10-22, session 1
Branch / HEAD: main / see `git log -1` (no remote configured)
Current milestone: M01 — Editable 3D terrain (COMPLETE except real-device perf check)
Current chunk: M02-C01 — water field, rainfall, fixed sim clock, water ledger
Status: READY

Verified working (browser = headless Chromium/SwiftShader via `npm run e2e`):
- 8 seeded presets, deterministic (tests/terrain.test.ts); New World dialog with seed/size/cell/relief/sea/roughness.
- Smooth 3D mesh, alternating diagonals, lithology+sediment+slope colouring, sea-level surface with depth shading, diorama skirts.
- Orbit/pan/zoom/top/oblique/fit; brush strokes captured before OrbitControls (no conflict); Space/⌥ to orbit mid-sculpt.
- Brushes raise/lower/smooth/flatten/paint lithology/add+strip sediment edit bedrock/sediment physically, dt-independent.
- Undo/redo per stroke (exact restore, e2e verified). Dirty-rect mesh updates.
- Save: IndexedDB slots + autosave/restore, .tgw export/import (gzip, versioned). Round-trip bit-exact.

Known failures / gaps:
- Real M4/Safari frame rate NOT measured (headless throttles rAF; SwiftShader ~450 ms/frame forced-sync, no growth = no leak).
- Ridged mountain peaks slightly needle-like (pre-erosion deferred to M03).
- Bundle 740 KB (three.js); no code-splitting yet.

Architecture / relevant paths: src/engine/{world,engine}.ts, src/terrain/*, src/tools/{brush,history}.ts,
src/renderer/TerrainScene.ts, src/persistence/{format,idb}.ts, src/app/* (runtime.ts = glue), tests/*.test.ts
Last checks: npm run typecheck PASS, npm test PASS (43), npm run build PASS, npm run e2e PASS (11 checks)
Uncommitted changes: none
Next: read docs/NEXT_TASK.md; do not reread docs/MASTER_SPEC.md
