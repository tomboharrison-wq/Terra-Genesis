# Project state
Updated: 2026-10-22, session 1 (cont.)
Branch / HEAD: main / see `git log -1` · remote: github.com/tomboharrison-wq/Terra-Genesis (pushed)
Current milestone: M04 — Geology layers, weathering, hillslopes, landslides (C01–C03 done)
Current chunk: M04-C04 — local curved-slip rotational slump prototype (local 3D geometry)
Status: READY

Verified working:
- M01 terrain editor · M02 water (CPU ref + GPU) · M03 erosion/transport/deposition (CPU ref + GPU).
- M04-C01 strata: per-cell columns by elevation (3 bounds, 4 lithologies); exposed rock derived; erosion,
  brushes, undo, save (format v4) all strata-aware; plateau preset = sandstone cap / mudstone / clay;
  cliff faces show layers per fragment.
- M04-C02 weathering: bedrock→regolith, ×erodibility×(1+wet)×exp(−soil/0.5 m); pending store beats float32.
- M04-C03 slope failure: loose avalanching above 33° (×(1−0.35·wet)), rockfall above lithology cliff angle
  (granite 80° … clay 45°), saturation proxy = water depth/1 cm or rain/20 mm·h⁻¹; Landslide event tool.
- gpu-check 7/7 (caprock: 0 lithology mismatches; cliff-failure: rockfall identical, weathering ±0.01 m³).
- e2e 20/20 (incl. landslide + undo).

Known failures / gaps:
- Real M4 GPU speed unmeasured. Saturation is a proxy (no soil-moisture field until M06).
- Generated mountain peaks can exceed their rock's cliff angle → immediate rockfall when erosion starts.
- Rotational slumping (curved slip, back-tilted block) not yet modelled (needs local 3D geometry, C04).

Relevant paths: src/engine/world.ts (strata), src/sim/sediment/sedimentSim.ts (creep/avalanche/rockfall/
weathering/transport), src/sim/water/gpuWater.ts (sediment pass), src/sim/slopes/landslide.ts,
src/renderer/shaders.ts (strata on cliffs), src/app/ErosionPanel.tsx
Last checks: typecheck PASS · npm test PASS (91) · build PASS · e2e PASS 20/20 · gpu-check PASS 7/7
Uncommitted changes: none
Next: read docs/NEXT_TASK.md; do not reread docs/MASTER_SPEC.md
