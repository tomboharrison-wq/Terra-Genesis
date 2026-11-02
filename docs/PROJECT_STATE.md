# Project state
Updated: 2026-11-02, M14
Branch / HEAD: main / see `git log -1` · remote: github.com/tomboharrison-wq/Terra-Genesis (pushed)
Current milestone: M14 hydrology trust (C01–C04 done)
Current chunk: M14-C05 validation and release
Status: READY

Verified working:
- M01 terrain · M02 water (CPU ref + GPU) · M03 erosion/deposition · M04 strata, weathering, slope failure,
  landslide tool, rotational slump lab (guided 2D).
- M05 coasts (src/sim/coast/coastSim.ts, CPU 600 s cadence): sea level, wave power/shelter/attenuation, cliff
  retreat by lithology, grid longshore drift (attached spits, tombolo). Guided labs (src/local/): cave→arch→stack→
  stump voxel lab, coastal slump cycle, one-line shoreline lab (bars, lagoons, recurves; not on world map — M05-C04c).
- M06 climate (lapse, seasons, orographic rain/shadow) · snow (v6) · glaciers (SIA, abrasion, moraines, v7) · plants (v8).
- M06-C05 biome presets (src/terrain/biomes.ts, spin-up) + what-if compare (two cloned spin-ups, plant-difference overlay).
- M07 plates (src/sim/tectonics/plates.ts, v9): boundaries, uplift/trench belts, rifts, transform column shifts,
  subduction arcs + Subduction lab, Fold lab, Quake tool (earthquake.ts, W&C scaling, undo incl. strata).
- M08 volcanoes (src/sim/lava/): lavaSim (Bingham flow, η,τ(T), cooling, solidify → addTopRock; v10), tephra.ts
  (Mastin plume, cinder ring + settleLoose 8-nbr, wind-stretched fall, tephraM v11), build.ts (shield/composite/
  island plans, rest years skipped; growIsland → 'volcanic-island' preset), caldera.ts (piston). VolcanoPanel (V).
- M09 data tools: measure.ts + MeasurePanel (pins, pairs, transect CSV); overlays.ts (data-gated defs, D8 flow,
  legends, inspector; TimeBar OverlayMenu); checkpoints.ts + CheckpointsDialog (exact restore, diff summary, cp-* overlays).
- M09-C04 challenges (src/challenges, app/challengeRunner.ts via runtime onSync/onWorldReplaced, ChallengeHud).
- M10 education: src/education (types, features.ts, lessons/), app/educationRunner.ts (per-stage world copies),
  EducationMode.tsx (panel, labels, GuidedStage, presentation, teacher links ?lesson=&stage=&level=), guided views
  GuidedRiver/GuidedGlacial/CoastalLessons/FoldSection; models src/local/{waterfall,meander,glacial}. 11 lessons, 5 modules.
- M11-C01 floods (src/sim/events/hazards.ts, engine hazard section, HazardsPanel, tool H): storm, sea surge
  (raised sea head in both solvers, surgeIn ledger), per-step peak depth (GPU max pass), 'flood' overlay, event log.
  C02 drought (low record, 'drought' overlay), Meteor tool J (sim/events/meteor.ts), comparison table.
  C03 exports (app/exportImages.ts, persistence/exports.ts) · C04 QA tests, version in Help.
- M12 Landform Show (src/education/landforms, src/app/landforms/*Scenes.tsx, LandformShow.tsx; ?landform=id) + Time-lapse.
- M13 geological time: sim/geology (landscapeEvolution, meander, run: glacial/coastal, geoWorker), app/geoRunner +
  GeoControls; lessons riverGeologic ×3, glacialGeologic, coastalGeologic (geoFeatures, glacialFeatures, scenarioWorlds).
- Mac app: desktop/ (Electron wrapper of dist/ via app://; package-mac.mjs → desktop/out zips).
- Generation settles slopes to dry stability (src/terrain/settle.ts) → worlds start in equilibrium.

Known failures / gaps:
- Groundwater is a CPU reference process; enabling the aquifer intentionally falls back from GPU so the
  authoritative solver remains complete. GPU water sync now has an explicit transaction and bounded
  float32 drift reconciliation with a visible diagnostic counter.
- Real GPU speed unmeasured; Firefox/WebKit and the Mac app on a real Mac untested. Map drift cannot make bars/lagoons/recurves (shoreline lab only).
- No depth refraction; bays develop slowly. Geo time: no waves; meanders only in lesson world; corries sub-grid.
- No isostasy. Inland cells below sea level count as sea.
- No map U-shapes (plan-view SIA). Lava: no crust/steam/ice melt. Ash lands instantly. Surge is a level rise, not a wave.

Last checks before M14: typecheck · npm test 281 · build · gpu-check 12/12 · e2e 62/62 — all PASS
M14 checks in progress: typecheck and focused hydrology/persistence/overlay tests PASS.
Uncommitted changes: M14 implementation (release chunk)
Next: run full test/build/e2e/gpu checks, commit and push M14.
