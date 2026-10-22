# Test results (latest first)

## 2026-10-22 M01 complete
- npm run typecheck PASS · npm test PASS (43 tests: world, determinism, noise, axes, generation ×8 presets, heightfield/raycast, brushes, frame-rate independence, undo/redo, file format) · npm run build PASS
- npm run e2e (headless Chromium + SwiftShader) PASS 11/11: inspector, raise, undo exact, redo, smooth, orbit-no-edit, autosave reload exact, slots, new world, no console errors.
- Visual: reviewed screenshots of river basin, island, headlands, plateau, mountain range (docs/reference/). Fixed headland 1-cell cliff steps and over-bright chalk.
- Perf: no leak (scene children/geometries/textures/programs constant over 5 regenerations; forced-sync render time flat). Real-GPU FPS unverified.

## 2026-10-22 M00-C01
- npm run typecheck PASS · npm test PASS (1) · npm run build PASS
