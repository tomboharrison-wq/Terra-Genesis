# Project state
Updated: 2026-10-22, session 1 (cont.)
Branch / HEAD: main / see `git log -1` · remote: github.com/tomboharrison-wq/Terra-Genesis (pushed)
Current milestone: M07 — Plate tectonics (C01 done; M06 climate complete)
Current chunk: M07-C02 — rifts and transform faults (see NEXT_TASK)
Status: READY

Verified working:
- M01 terrain · M02 water (CPU ref + GPU) · M03 erosion/deposition · M04 strata, weathering, slope failure,
  landslide tool, rotational slump lab (guided 2D).
- M05 coasts (src/sim/coast/coastSim.ts, CPU 600 s cadence): sea level, wave power/shelter/attenuation, cliff
  retreat by lithology, grid longshore drift (attached spits, tombolo). Guided labs (src/local/): cave→arch→stack→
  stump voxel lab (rock types, waves, scenarios), coastal slump cycle, one-line shoreline lab (bay-mouth bar +
  lagoon, recurved spits; not coupled to the world map — M05-C04c).
- M06-C01 climate (src/sim/climate/climate.ts, Engine.setClimateParams, ClimatePanel, temperature/rainfall overlays):
  T = T0 + season − lapse·z; rain factor = saturating windward uplift × upwind-barrier shadow, mean 1 over land;
  evap ∝ exp(0.065ΔT), 0 below 0 °C. CPU + GPU (climate texture; GPU evaporation counted in state.a). Format v5.
- M06-C02 snow: world.snowSweM (format v6); snowfall below 0 °C, degree-day melt; stored volume = water + snow;
  CPU float64 mirror, GPU snow texture (r pack, g fallen, b melted since sync, folded in float64). White cover.
- M06-C03 glaciers (src/sim/glacier/glacierSim.ts, Engine.glacierHook, Climate panel): ice + debris fields (v7);
  linear mass balance about a climate ELA; semi-implicit SIA (CG, dt·D/cs² ≤ 100) moving ice by donor-limited
  transfers (exact); edge outflow; abrasion ∝ sliding → debris → moraines; meltwater at real-time share.
- M06-C04 vegetation (src/sim/vegetation/vegetationSim.ts, renderer/treeLayer.ts): cover → suitability (warmth,
  yearly rain, soil, slope; none in sea/ice/lakes), grow 0.15/yr, die 0.4/yr; erosion × (1 − 0.8c) CPU + GPU
  (climate tex .a). Green tint + instanced tree symbols. Format v8.
- M06-C05 biome presets (src/terrain/biomes.ts: temperate, alpine, rain-shadow, tundra; static spin-up of starting
  ice + equilibrium plants) and what-if compare (two cloned spin-ups, table + plant-difference overlay).
- M07-C01 plates (src/sim/tectonics/plates.ts, PlatesPanel, 'plates' overlay + arrows, profile plate strip): plateId
  (v9), rigid velocities, boundary classification, Gaussian belts (uplift / trench / rift) moving rock + strata.
- Generation settles slopes to dry stability (src/terrain/settle.ts) → worlds start in equilibrium.

Known failures / gaps:
- Water depth is float32: a closed basin lake over simulated years drifts ~% in the ledger (backlog M02-C07).
- Real M4 GPU speed unmeasured. Coastal processes are CPU-only (fine at 600 s cadence).
- On the world map, grid drift still cannot make bars/lagoons/recurves (they live in the shoreline lab).
- No depth refraction; bays develop slowly at default rates; drift total is a summed transfer figure.
- Mountains have no height limit (no isostasy); erosion must balance uplift. - Inland cells below sea level count as sea. Glaciers do not carve U-shaped cross-sections (plan-view SIA).

Relevant paths: src/sim/climate/climate.ts, src/sim/water/{waterSim,gpuWater,gpuSelfTest}.ts (snow + climate
forcing), src/engine/engine.ts (setClimateParams, advanceSeason), src/app/ClimatePanel.tsx, TerrainScene (snow, overlays)
Last checks: typecheck PASS · npm test PASS (173) · build PASS · e2e PASS 34/34 · gpu-check 10/10
Uncommitted changes: none
Next: read docs/NEXT_TASK.md; do not reread docs/MASTER_SPEC.md
