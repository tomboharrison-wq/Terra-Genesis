# Test results (latest first)

## 2026-10-22 M02 complete
- typecheck PASS · npm test PASS 69 (water forcing/ledger, clock determinism, pipe solver: downhill, open edge, level bowl ≤2 cm, still lake ≤1 mm, saddle spill, symmetry, long storm; engine integration; conditioning; river-catchment)
- npm run gpu-check PASS 3/3 (slope ≤0.088 mm, bowl ≤0.001 mm, catchment mean 0.013 mm / vol 0.02%; closures ~1e-7..1e-6)
- npm run e2e PASS 16/16 incl. GPU backend, play advances, in-browser budget closure 5e-6, spring tool, water restored after reload.
- Visual: docs/reference/m02-*.png (river basin after 4 h rain, flow-speed overlay). Real-GPU FPS unverified.

## 2026-10-22 M01 complete
- npm run typecheck PASS · npm test PASS (43 tests: world, determinism, noise, axes, generation ×8 presets, heightfield/raycast, brushes, frame-rate independence, undo/redo, file format) · npm run build PASS
- npm run e2e (headless Chromium + SwiftShader) PASS 11/11: inspector, raise, undo exact, redo, smooth, orbit-no-edit, autosave reload exact, slots, new world, no console errors.
- Visual: reviewed screenshots of river basin, island, headlands, plateau, mountain range (docs/reference/). Fixed headland 1-cell cliff steps and over-bright chalk.
- Perf: no leak (scene children/geometries/textures/programs constant over 5 regenerations; forced-sync render time flat). Real-GPU FPS unverified.

## 2026-10-22 M00-C01
- npm run typecheck PASS · npm test PASS (1) · npm run build PASS
