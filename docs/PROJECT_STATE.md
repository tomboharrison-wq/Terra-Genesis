# Project state
Updated: 2026-10-25, session 1 (cont.)
Branch / HEAD: main / see `git log -1` · remote: github.com/tomboharrison-wq/Terra-Genesis (pushed)
Current milestone: M11 — Disasters, exports, final QA (M10 Education Mode complete)
Current chunk: M11-C02 — meteor, drought, event comparison (see NEXT_TASK)
Status: READY

Verified working:
- M01 terrain · M02 water (CPU ref + GPU) · M03 erosion/deposition · M04 strata, weathering, slope failure,
  landslide tool, rotational slump lab (guided 2D).
- M05 coasts (src/sim/coast/coastSim.ts, CPU 600 s cadence): sea level, wave power/shelter/attenuation, cliff
  retreat by lithology, grid longshore drift (attached spits, tombolo). Guided labs (src/local/): cave→arch→stack→
  stump voxel lab, coastal slump cycle, one-line shoreline lab (bars, lagoons, recurves; not on world map — M05-C04c).
- M06 climate (lapse, seasons, orographic rain/shadow) · snow (v6) · glaciers (SIA, abrasion, moraines, v7) · plants (v8).
- M06-C05 biome presets (src/terrain/biomes.ts, spin-up) + what-if compare (two cloned spin-ups, plant-difference overlay).
- M07-C01 plates (src/sim/tectonics/plates.ts, PlatesPanel, 'plates' overlay + arrows, profile plate strip): plateId
  (v9), rigid velocities, boundary classification, Gaussian belts (uplift / trench) moving rock + strata;
  C02: rifts as stepped fault blocks; transform slip shifts whole columns of the higher-id plate per cell.
  C03: subducting side trench, arc vents 2.5 belt widths inboard growing volcanic cones; Subduction lab (SVG).
  C04: Fold lab (src/local/folds) + c–c belts fold strata boundaries (surface unchanged).
  C05: Quake tool (sim/tectonics/earthquake.ts): W&C scaling, fault deformation, shaking overlay, undo incl. strata.
- M08 volcanoes (src/sim/lava/): lavaSim (Bingham flow, η,τ(T), cooling, solidify → addTopRock; v10), tephra.ts
  (Mastin plume, cinder ring + settleLoose 8-nbr, wind-stretched fall, tephraM v11), build.ts (shield/composite/
  island plans, rest years skipped; growIsland → 'volcanic-island' preset), caldera.ts (piston). VolcanoPanel (V).
- M09 data tools: measure.ts + MeasurePanel (pins, pairs, transect CSV); overlays.ts (data-gated defs, D8 flow,
  legends, inspector; TimeBar OverlayMenu); checkpoints.ts + CheckpointsDialog (exact restore, diff summary, cp-* overlays).
- M09-C04 challenges (src/challenges, app/challengeRunner.ts via runtime onSync/onWorldReplaced, ChallengeHud).
- M10 education: src/education (types, features.ts, lessons/), app/educationRunner.ts (per-stage world copies),
  EducationMode.tsx (panel, labels, GuidedStage, presentation, teacher links ?lesson=&stage=&level=), guided views
  GuidedRiver/GuidedGlacial/CoastalLessons/FoldSection; models src/local/{waterfall,meander,glacial}. 11 lessons, 5 modules.
- M11-C01 floods (src/sim/events/hazards.ts, engine hazard section, HazardsPanel 'Floods' H): storm, sea surge
  (raised sea head in both solvers, surgeIn ledger), per-step peak depth (GPU max pass), 'flood' overlay, event log.
- Generation settles slopes to dry stability (src/terrain/settle.ts) → worlds start in equilibrium.

Known failures / gaps:
- Water depth is float32: a closed basin lake over simulated years drifts ~% in the ledger (backlog M02-C07).
- Real M4 GPU speed unmeasured. Map drift cannot make bars/lagoons/recurves (shoreline lab only).
- No depth refraction; bays develop slowly at default rates; drift total is a summed transfer figure.
- Mountains have no height limit (no isostasy); erosion must balance uplift. - Inland cells below sea level count as sea.
- No map U-shapes (plan-view SIA). Lava: no crust/steam/ice melt. Ash lands instantly. Surge is a level rise, not a wave.

Relevant paths: src/sim/events/hazards.ts, src/engine/engine.ts (hazards), src/app/HazardsPanel.tsx
Last checks: typecheck PASS · npm test 246 PASS · build PASS (M10) · e2e + gpu-check of M11-C01 build PENDING
Uncommitted changes: none
Next: read docs/NEXT_TASK.md; do not reread docs/MASTER_SPEC.md
