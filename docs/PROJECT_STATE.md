# Project state
Updated: 2026-10-22, session 1 (cont.)
Branch / HEAD: main / see `git log -1` · remote: github.com/tomboharrison-wq/Terra-Genesis (pushed)
Current milestone: M08 — Volcanoes (M07 tectonics complete)
Current chunk: M08-C04 — volcanic island, caldera, erosion of new rock (see NEXT_TASK)
Status: READY

Verified working:
- M01 terrain · M02 water (CPU ref + GPU) · M03 erosion/deposition · M04 strata, weathering, slope failure,
  landslide tool, rotational slump lab (guided 2D).
- M05 coasts (src/sim/coast/coastSim.ts, CPU 600 s cadence): sea level, wave power/shelter/attenuation, cliff
  retreat by lithology, grid longshore drift (attached spits, tombolo). Guided labs (src/local/): cave→arch→stack→
  stump voxel lab (rock types, waves, scenarios), coastal slump cycle, one-line shoreline lab (bay-mouth bar +
  lagoon, recurved spits; not coupled to the world map — M05-C04c).
- M06 climate (src/sim/climate: lapse, seasons, orographic rain/shadow, evap) · snow (snowSweM v6, degree-day) ·
  glaciers (src/sim/glacier: SIA CG solver, abrasion, moraines, v7) · vegetation (src/sim/vegetation, v8, trees).
- M06-C05 biome presets (src/terrain/biomes.ts: temperate, alpine, rain-shadow, tundra; static spin-up of starting
  ice + equilibrium plants) and what-if compare (two cloned spin-ups, table + plant-difference overlay).
- M07-C01 plates (src/sim/tectonics/plates.ts, PlatesPanel, 'plates' overlay + arrows, profile plate strip): plateId
  (v9), rigid velocities, boundary classification, Gaussian belts (uplift / trench) moving rock + strata;
  C02: rifts as stepped fault blocks; transform slip shifts whole columns of the higher-id plate per cell.
  C03: subducting side trench, arc vents 2.5 belt widths inboard growing volcanic cones; Subduction lab (SVG).
  C04: Fold lab (src/local/folds) + c–c belts fold strata boundaries (surface unchanged).
  C05: Quake tool (sim/tectonics/earthquake.ts): W&C scaling, fault deformation, shaking overlay, undo incl. strata.
- M08-C01 lava (src/sim/lava/lavaSim.ts, VolcanoPanel, key V): lavaDepthM/TempC/Kind (v10) + vents; Bingham flux,
  η,τ ∝ e^{b(Te−T)}, radiation+convection cooling; sub-steps inside each water step (2–5 s, ⅛-difference cap);
  Engine.lavaHook solidifies on 60 s cadence → addTopRock (world.ts) volcanic layer. Glow via lavaGlow attribute.
  C02 tephra (src/sim/lava/tephra.ts): vent style lava/explosive/mixed; Mastin H; cinder exp(−r/150 m) + settleLoose
  (33°); fall footprint exp(−ρ), L = 150 m·H, wind-stretched; loose sediment + tephraM (v11) ash colour; 600 s cadence.
  C03 Engine.buildVolcano/episodePlan (runtime.runVolcanoBuild, one eruption per frame): real physics per eruption,
  rest years skipped (freezeAll); cinder ring (r/r₀)e^{−r/r₀} r₀ 60 m → crater; andesite η₀ 1e7; undo incl. tephraM.
- Generation settles slopes to dry stability (src/terrain/settle.ts) → worlds start in equilibrium.

Known failures / gaps:
- Water depth is float32: a closed basin lake over simulated years drifts ~% in the ledger (backlog M02-C07).
- Real M4 GPU speed unmeasured. Coastal processes are CPU-only (fine at 600 s cadence).
- On the world map, grid drift still cannot make bars/lagoons/recurves (they live in the shoreline lab).
- No depth refraction; bays develop slowly at default rates; drift total is a summed transfer figure.
- Mountains have no height limit (no isostasy); erosion must balance uplift. - Inland cells below sea level count as sea.
- No glacial U-shapes (plan-view SIA). Lava: no crust, steam, lava–ice melting; edges are walls. Ash lands instantly (no grain sizes / PDCs).

Relevant paths: src/sim/lava/lavaSim.ts, src/engine/engine.ts (stepper, lavaHook), src/app/VolcanoPanel.tsx,
TerrainScene (lava colour/glow), src/renderer/shaders.ts
Last checks: typecheck PASS · npm test PASS (206) · build PASS · e2e PASS 40/40 · gpu-check 10/10
Uncommitted changes: none
Next: read docs/NEXT_TASK.md; do not reread docs/MASTER_SPEC.md
