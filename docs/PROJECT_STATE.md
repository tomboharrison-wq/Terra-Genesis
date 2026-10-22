# Project state
Updated: 2026-10-22, session 1 (cont.)
Branch / HEAD: main / see `git log -1` · remote: github.com/tomboharrison-wq/Terra-Genesis (pushed)
Current milestone: M05 — Coasts (M04 complete)
Current chunk: M05-C01 — shoreline identification, controllable sea level, realistic visual ocean
Status: READY

Verified working:
- M01 terrain editor · M02 water (CPU ref + GPU) · M03 erosion/transport/deposition (CPU ref + GPU).
- M04-C01 strata: per-cell columns by elevation (3 bounds, 4 lithologies); exposed rock derived; erosion,
  brushes, undo, save (format v4) all strata-aware; plateau preset = sandstone cap / mudstone / clay;
  cliff faces show layers per fragment.
- M04-C02 weathering: bedrock→regolith, ×erodibility×(1+wet)×exp(−soil/0.5 m); pending store beats float32.
- M04-C03 slope failure: loose avalanching above 33° (×(1−0.35·wet)), rockfall above lithology cliff angle
  (granite 80° … clay 45°), saturation proxy = water depth/1 cm or rain/20 mm·h⁻¹; Landslide event tool.
- M04-C04 Slump lab (guided model): searched slip circle, Fellenius FoS with pore pressure, rigid rotation,
  equal-area toe lobe, back scarp/tilt; SVG cross-section with labels (Landslide panel → Open slump lab).
- gpu-check 7/7 (caprock: 0 lithology mismatches; cliff-failure: rockfall identical, weathering ±0.01 m³).
- e2e 20/20 (incl. landslide + undo).

Known failures / gaps:
- Real M4 GPU speed unmeasured. Saturation is a proxy (no soil-moisture field until M06).
- Generated mountain peaks can exceed their rock's cliff angle → immediate rockfall when erosion starts.
- Slump lab is 2D cross-section only (not coupled to the 3D map); FoS uses teaching soil strengths.

Relevant paths: src/engine/world.ts (strata), src/sim/sediment/sedimentSim.ts (creep/avalanche/rockfall/
weathering/transport), src/sim/water/gpuWater.ts (sediment pass), src/sim/slopes/landslide.ts,
src/renderer/shaders.ts (strata on cliffs), src/app/ErosionPanel.tsx, src/local/slump/model.ts, src/app/SlumpLab.tsx
Last checks: typecheck PASS · npm test PASS (97) · build PASS · e2e PASS 20/20 · gpu-check PASS 7/7
Uncommitted changes: none
Next: read docs/NEXT_TASK.md; do not reread docs/MASTER_SPEC.md
