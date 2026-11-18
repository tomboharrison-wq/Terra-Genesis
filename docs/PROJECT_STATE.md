# Project state
Updated: 2026-11-18, M18 spec completion and simulation depth
Branch / HEAD: main / see `git log -1` · remote: github.com/tomboharrison-wq/Terra-Genesis
Current milestone: M18 Spec Completion and Simulation Depth (IN PROGRESS)
Current chunk: M18-C11 deployment and live verification
Status: VALIDATED, READY TO DEPLOY

Verified working:
- M18-C01 compact adaptive map labels, independent label visibility, and corrected scientific-trust wording.
- M18-C02 compensated Float64 CPU water depth with Float32 render/save/GPU compatibility.
- M18-C03 detailed shoreline model coupled to authoritative, conserved world sediment.
- M18-C04 interactive local 3D waterfall with state-derived overhang, collapse blocks, plunge pool and gorge walls.
- M18-C05 authoritative ridge, valley, plateau, depression, slope, channel and embankment brushes with masks and pen pressure.
- M18-C06 ten climate-derived biome classes with distinct cover limits, terrain colours, tree forms and a categorical overlay.
- M18-C07 classroom before/after split view from exact checkpoint and current-world cells, with measured changes.
- M18-C08 ground-following first-person explore, automatic flyover, cinematic orbit and focus-point cameras.
- M18-C09 opt-in procedural ambience and effects with separate levels and automatic Classroom-mode mute.
- M18-C10 full-resolution GLB, live-view WebM, Minecraft WorldPainter and fixed-seed lesson-link exports.
- M18-C11 validation: 318/318 unit tests, strict typecheck, production build and 12/12 real-Chrome GPU comparisons pass; focused Chrome checks cover repaired guided/animated views and all new exports.
- M01 terrain · M02 water (CPU ref + GPU) · M03 erosion/deposition · M04 strata, weathering, slope failure,
  landslide tool, rotational slump lab (guided 2D).
- M05 & M13-C08c coasts (`src/sim/coast/coastSim.ts`): sea level, wave power/shelter/attenuation, seabed-controlled
  wave refraction (`refractionFactor` focusing wave energy on convex headlands and dispersing in bays), cliff retreat by
  lithology, cross-shore constructive beach berms (`buildBayBeaches`) building up to +1.8 m above `seaLevelM` in sheltered
  bays, map-scale headland `cave → arch → stack → stump` progression (`findHeadlandFeatures`), and grid longshore drift.
- M06 & M13-C06c climate, snow, glaciers & plants (`src/sim/glacier/glacierSim.ts`, `src/education/glacialFeatures.ts`):
  SIA with pre-allocated scratch buffers, rotational slip corrie over-deepening in steep cirque hollows, arêtes and
  pyramidal peaks, hanging valleys, terminal/lateral/recessional moraines, plus lowland `drumlin` and perched `erratic`
  detection.
- M07 plates (`src/sim/tectonics/plates.ts`, v9): boundaries, uplift/trench belts, rifts, transform column shifts,
  subduction arcs + Subduction lab, Fold lab, Quake tool (`earthquake.ts`, W&C scaling, undo incl. strata).
- M08 volcanoes: lava, tephra, shield/composite/island builds and caldera; VolcanoPanel (V).
- M09 data tools: measures, overlays, checkpoints, comparison overlays, and **River courses (Bradshaw)** tab in
  `ProfilePanel.tsx` (`analyzeRiverCourses` in `src/education/geoFeatures.ts`: source-to-mouth long profile, Upper/Middle/Lower
  cross-profiles, Bradshaw metrics table, and live measured on-map labels).
- M10 & GCSE Evidence Layer (`src/education/evidence.ts`, `src/app/EvidenceDialog.tsx`): 6 structured classroom
  investigations (`Rivers`, `Coasts`, `Glaciers`, `Slopes`, `Tectonics`, `Climate`) following `Predict → Run → Observe →
  Measure → Explain`, generating before/after maps, cross-section profile comparisons, measured metrics tables, process
  sequences, key vocabulary, a data-backed 6-mark GCSE exam paragraph, and an exportable Evidence Sheet PNG.
- M11 hazards & exports · M12 Landform Show + Time-lapse.
- M13 & M13-C05b geological time (`src/sim/geology/meander.ts`, `src/sim/geology/run.ts`): arbitrary-world lowland river
  & floodplain detection (`detectLowlandMeander`), Johannesson-Parker lateral migration, neck cut-offs & oxbow lakes,
  overbank levees, tidal estuary funnel widening (`estuary: true`, `estuaryMetrics`), coupled glacial + coastal and
  coastal + meandering evolution, plus live on-map labels (`arbitraryMeanderLabels`).
- M16 visual & performance overhaul (`src/renderer/`, `tests/m16-hardening.test.ts`): triplanar procedural rock/soil
  shaders, Beer-Lambert water absorption & caustics, 4-layer diorama side walls, 3D cumulus clouds & rain shafts,
  in-place quality switching (`performance` / `balanced` / `high`), topographic contours, sun & vertical exaggeration
  controls, and `tests/m16-hardening.test.ts` (13 dedicated regression & benchmark tests).

Known failures / gaps:
- Groundwater is a CPU reference process; enabling the aquifer intentionally falls back from GPU so the
  authoritative solver remains complete.
- No lithospheric isostasy.

Verification checks:
- Full unit suite: 318/318 tests across 58 files PASS
- Strict TypeScript and production Vite build PASS
- Real Chrome GPU parity suite: 12/12 PASS
- Full browser suite reached 62/64; both presentation-only failures were repaired and focused Chrome reruns PASS with no console errors
Uncommitted changes: none
Next: Push and verify GitHub Pages / Cloudflare Pages.
