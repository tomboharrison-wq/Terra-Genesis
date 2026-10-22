# Project state
Updated: 2026-10-22, session 1 (cont.)
Branch / HEAD: main / see `git log -1` · remote: github.com/tomboharrison-wq/Terra-Genesis (pushed)
Current milestone: M03 — Erosion, sediment transport, deposition
Current chunk: M03-C01 — bedrock + loose sediment layer & material property registry for erosion
Status: READY

Verified working:
- M01 editable terrain: 8 seeded presets, brushes, undo/redo, save/load (.tgw v2), see tests/*.test.ts.
- M02 water: rain/springs/infiltration/evaporation + exact ledger; local-inertial solver (CPU reference
  src/sim/water/waterSim.ts, GPU port gpuWater.ts on the renderer's WebGL2 context, CPU fallback).
- GPU vs CPU: `npm run gpu-check` PASS (smooth fixtures ≤0.09 mm; turbulent mean 0.013 mm, vol 0.02%).
- Water rendered from solver textures (waterLayer.ts); overlays depth/flow speed; TimeBar play/step/speed.
- Generated terrain is drainage-conditioned (priority-flood fill with alluvium, 0.2% gradient).
- river-catchment fixture: 24% of rain drained in 3 h, top 5% cells carry 71% of discharge.

Known failures / gaps:
- Real M4 Safari/Chrome speed NOT measured (SwiftShader: ~3 min sim/s; budget 10 ms/frame).
- Bitwise frame-rate independence holds for the CPU solver; GPU dt uses synced stats (reproducible, not bitwise).
- Inland cells below sea level are treated as sea. Water tools are not undoable (by design: snapshots).
- Low-gradient valley fills flood as broad sheets under heavy rain (physical, but looks sheet-like).

Relevant paths: src/engine/{engine,clock,world}.ts, src/sim/water/*, src/renderer/{TerrainScene,waterLayer}.ts,
src/app/{TimeBar,WaterPanel,Viewport}.tsx, src/terrain/conditioning.ts
Last checks: typecheck PASS · npm test PASS (69) · build PASS · e2e PASS 16/16 · gpu-check PASS 3/3
Uncommitted changes: none
Next: read docs/NEXT_TASK.md; do not reread docs/MASTER_SPEC.md
