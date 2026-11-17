# Project state
Updated: 2026-11-17, M16 validation & hardening + M13-C05b/C06c/C08c physical realism & GCSE Evidence Layer
Branch / HEAD: main / see `git log -1` · remote: github.com/tomboharrison-wq/Terra-Genesis
Current milestone: M16 & GCSE Physical/Educational Complete (all 7 reviewer recommendations implemented and tested)
Current chunk: M16 Hardening, M13-C05b Meanders & Estuaries, GCSE Evidence Layer, M13-C08c Coasts, Bradshaw River Courses, M13-C06c Glaciers, 6 Classroom Investigations — ALL DONE
Status: READY

Verified working:
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
- `npm run build` (`tsc --noEmit && vite build`): PASS
- `tests/m16-hardening.test.ts` (13/13), `tests/geo-glacial.test.ts`, `tests/meander.test.ts`, `tests/coast.test.ts`, `tests/glacier.test.ts`: PASS
Uncommitted changes: none
Next: Ready for teacher/student classroom deployment on GitHub Pages / Cloudflare Pages.
