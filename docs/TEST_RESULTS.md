# Test results (latest first)

## 2026-10-22 M04-C01..C03
- typecheck PASS · npm test PASS 91 (strata: layer lookup, brush exposure + undo, paint layer, cap-rock 1.38× erosion, plateau, format v4; weathering; avalanche to repose; clay cliff fails / granite stands; wet pile flatter; landslide conserve + undo; gentle ground stable)
- gpu-check PASS 7/7 (caprock 0 lithology mismatches; cliff-failure rockfall CPU=GPU 65,999.2 m³)
- e2e PASS 20/20 (+ landslide undoable). Visual: docs/reference/m04-*.png

## 2026-10-22 M03 complete
- typecheck PASS · npm test PASS 79 (sediment: no-forcing, ledger + solids conservation, two-rocks, sediment-fan, delta-mouth, long storm, creep, format v3; engine erosion integration)
- gpu-check PASS 5/5 (erosion-slope / erosion-delta: bed maxΔ 0.01 mm, eroded volume identical CPU/GPU, sediment closure ≤3.6e-7)
- e2e PASS 19/19 (+ GPU erosion to sea, browser sediment closure 1.7e-8, eroded terrain restored after reload)
- Creep study (96², ×300, 6 h): creep 0 → 9.6% of land changed >5 cm, grid noise 0.57; any creep ≥2e-5 → ~80%, noise 2–3. Default creep off.
- Visual: docs/reference/m03-*.png. Real-GPU FPS unverified.

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
