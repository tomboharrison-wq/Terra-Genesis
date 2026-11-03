# Project state
Updated: 2026-11-03, M13-C04b
Branch / HEAD: main / see `git log -1` · remote: github.com/tomboharrison-wq/Terra-Genesis (pushed)
Current milestone: M13 geological time (C04b done)
Current chunk: M13-C05b arbitrary-world meanders and estuary
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
- M08 volcanoes: lava, tephra, shield/composite/island builds and caldera; VolcanoPanel (V).
- M09 data tools: measures, overlays, checkpoints and comparison overlays.
- M09-C04 challenges (src/challenges, app/challengeRunner.ts via runtime onSync/onWorldReplaced, ChallengeHud).
- M10 education: classroom mode, 11 lessons, guided river/glacial/coastal/fold views and Landform Show.
- M11-C01 floods (src/sim/events/hazards.ts, engine hazard section, HazardsPanel, tool H): storm, sea surge
  (raised sea head in both solvers, surgeIn ledger), per-step peak depth (GPU max pass), 'flood' overlay, event log.
  C02 drought (low record, 'drought' overlay), Meteor tool J (sim/events/meteor.ts), comparison table.
  C03 exports (app/exportImages.ts, persistence/exports.ts) · C04 QA tests, version in Help.
- M12 Landform Show (src/education/landforms, src/app/landforms/*Scenes.tsx, LandformShow.tsx; ?landform=id) + Time-lapse.
- M13 geological time: river, glacier and coastal evolution in a Web Worker with classroom lessons; optional
  transport-limited sediment capacity now lays excess load on channels and adjacent low ground in any world.
- Mac app: desktop/ Electron wrapper of `dist/`; generation settles slopes to dry stability.

Known failures / gaps:
- Groundwater is a CPU reference process; enabling the aquifer intentionally falls back from GPU so the
  authoritative solver remains complete. GPU water sync now has an explicit transaction and bounded
  float32 drift reconciliation with a visible diagnostic counter.
- Real GPU speed unmeasured; Firefox/WebKit and the Mac app on a real Mac untested. Map drift cannot make bars/lagoons/recurves (shoreline lab only).
- No depth refraction; bays develop slowly. Geo time: no waves; arbitrary-world meanders/estuaries remain the next
  gap; corries sub-grid.
- No isostasy. Inland cells below sea level count as sea.
- No map U-shapes (plan-view SIA). Lava: no crust/steam/ice melt. Ash lands instantly.

Last checks before M14: typecheck · npm test 281 · build · gpu-check 12/12 · e2e 62/62 — all PASS
M14 checks: typecheck PASS · npm test 283 PASS · production build PASS · GitHub Pages workflow PASS.
M15 checks: typecheck PASS · npm test 286 PASS · production build PASS; GPU/e2e remain host-blocked by absent
Chromium and M15 deliberately uses CPU-authoritative event physics.
The local GPU/e2e scripts were not runnable in this environment because `/opt/pw-browsers/chromium` is absent;
the prior baseline had gpu-check 12/12 and e2e 62/62.
M13-C04b checks: npm test 287 PASS · typecheck PASS · production build PASS. Full suite includes a deterministic
ordinary-world fan/floodplain deposition and mass-balance acceptance test. GPU/e2e are not applicable to the
geological-time CPU/Web Worker process; the host still lacks `/opt/pw-browsers/chromium`.
Uncommitted changes: none
Next: M13-C05b; do not reread docs/MASTER_SPEC.md
