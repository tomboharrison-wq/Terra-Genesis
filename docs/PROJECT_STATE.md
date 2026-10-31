# Project state
Updated: 2026-10-31
Branch / HEAD: dev (work) → main (deploys: Netlify + GitHub Pages) · see `git log -1`
Current milestone: M13 geological time (C01–C08, C04b, C05b, C07 done); optional backlog
Current chunk: see NEXT_TASK
Status: READY

Verified working:
- M01 terrain · M02 water (CPU ref + GPU) · M03 erosion/deposition · M04 strata, weathering, slope failure,
  landslide tool, rotational slump lab (guided 2D).
- M05 coasts (src/sim/coast/coastSim.ts, CPU 600 s cadence): sea level, wave power/shelter/attenuation, cliff
  retreat by lithology, grid longshore drift (attached spits, tombolo). Guided labs (src/local/): cave→arch→stack→
  stump voxel lab, coastal slump cycle, one-line shoreline lab (bars, lagoons, recurves; not on world map — M05-C04c).
- M06 climate (lapse, seasons, orographic rain/shadow) · snow (v6) · glaciers (SIA, abrasion, moraines, v7) · plants (v8).
- M06-C05 biome presets (terrain/biomes.ts, spin-up) + what-if compare.
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
- M13 geological time: sim/geology (landscapeEvolution incl. ξ–q deposition, meander + meanderReach, run, geoWorker),
  app/geoRunner + GeoControls; lessons riverGeologic ×3, glacialGeologic, coastalGeologic. Recorded lesson runs:
  public/lesson-runs (`npm run record-lessons`; hash + fingerprint checked, live fallback). Worksheets: app/lessonSheet.ts.
- Mac app: desktop/ (Electron wrapper of dist/ via app://; package-mac.mjs → desktop/out zips).
- Generation settles slopes to wet stability (terrain/settle.ts); mountain slopes capped at criticalSlopeDeg.

Known failures / gaps:
- Water depth is float32: a closed basin lake over simulated years drifts ~% in the ledger (backlog M02-C07).
- Real GPU speed, Firefox/WebKit and the Mac app on a real Mac untested. Bars/lagoons/recurves only in the shoreline lab.
- No depth refraction; beaches stay thin. Geo time: corries sub-grid; no estuaries; real-GPU timings unmeasured.
- No isostasy. Inland cells below sea level count as sea.
- Plan-view SIA (no true U-shapes). Lava: no crust/steam. Ash lands instantly. Surge is a level rise, not a wave.

Last checks: see docs/TEST_RESULTS.md (latest first)
Uncommitted changes: none
Next: read docs/NEXT_TASK.md; do not reread docs/MASTER_SPEC.md
