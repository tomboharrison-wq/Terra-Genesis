# Project state
Updated: 2026-10-22, session 1 (cont.)
Branch / HEAD: main / see `git log -1` · remote: github.com/tomboharrison-wq/Terra-Genesis (pushed)
Current milestone: M04 — Geology layers, weathering, hillslopes, landslides
Current chunk: M04-C01 — layered geology / material paint, exposure after erosion, visual stratification
Status: READY

Verified working:
- M01 terrain editor; M02 water (CPU ref + WebGL2 GPU, ledger, rendering, time controls, tools).
- M03 erosion: suspended transport with water discharges, capacity C=K·q·S, loose-then-bedrock erosion by
  lithology, deposition, sea-floor settling (deltas), optional hillslope creep (default off), GPU sediment pass.
- gpu-check 5/5 incl. erosion fixtures (bed ≤0.01 mm vs CPU, identical eroded volume, closures ~1e-7).
- e2e 19/19: GPU water + erosion, budgets close in browser, eroded terrain + suspended load survive reload.
- UI: Erosion panel (toggle, ×acceleration, bedrock factor, creep, sediment budget), change map (±5 cm
  neutral), turbid water, Profile tool (cross-section chart: surface / reference / water; table view).
- Presets: River basin (rain+erosion), River to sea (delta demo), 7 others.

Known failures / gaps:
- Real M4 GPU speed unmeasured (SwiftShader only). Change map shows cell-scale scour/bar alternation in channels.
- Single grain size; no bedload, armouring, lateral bank erosion or meander dynamics (needs local model, spec E5).
- Hillslope creep smooths generator micro-relief at high acceleration (hence default off).
- Inland cells below sea level are treated as sea.

Relevant paths: src/sim/sediment/sedimentSim.ts, src/sim/water/gpuWater.ts (water+sediment passes),
src/engine/engine.ts, src/renderer/{TerrainScene,waterLayer}.ts, src/app/{ErosionPanel,ProfilePanel}.tsx
Last checks: typecheck PASS · npm test PASS (79) · build PASS · e2e PASS 19/19 · gpu-check PASS 5/5
Uncommitted changes: none
Next: read docs/NEXT_TASK.md; do not reread docs/MASTER_SPEC.md
