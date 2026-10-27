# Backlog (active first). Full roadmap table: MASTER_SPEC.md Part J.

| ID | Outcome | Status |
|---|---|---|
| D-C01 | Mac desktop app (Electron wrapper, Apple Silicon + Intel zips, ad-hoc signed, install guide) | DONE |
| D-C02 | Mac app: Apple Developer ID signing + notarisation (no first-open warning), auto-update, Windows build; confirm on a real Mac | TODO |
| M12-C01 | Landform Show: all 27 Edexcel GCSE Topic 1 landforms (1.4a/b, 1.8a/b/c, 1.12a/b/c) as 17 animated formations — stages with KS3/GCSE text, on-screen process annotations, time-lapse clock (0.25–16×), process glossary, exam steps, teacher links ?landform=; simulator Time-lapse button | DONE |
| M12-C02 | Landform Show: teacher feedback round (accuracy review by a geography teacher, extra stages where needed, printable stage sheets) | TODO |
| M04-C06 | Worlds are settled dry at generation, so the first heavy rain makes weak scarps fail en masse (plateau: 80 M m³ in an hour). Decide: settle to wet stability, or a gentle first-rain warm-up, or keep and explain | TODO |
| M11-C04 | Final QA: WCAG contrast test (Play button fixed), named buttons/focus/Escape e2e, two-column tool rail on short screens, v1–v11 saves load, slot round trip, frame-rate independence (bit-identical at 60/20/uneven fps), build version in Help, Help text brought up to date | DONE |
| M10-C06 | Lessons still to add: headlands & bays (emergent), coastal slumping, subduction / plate boundaries, glacier retreat | TODO |
| M11-C06 | Tsunami as a travelling long wave (sea cells in the solver, wave speed √(gh), run-up) instead of a level surge | TODO |
| M11-C05 | Slow test: climate 'seasons advance' takes ~36 s for a quarter year at the 10 s max step (60 s timeout; fails under heavy CPU load) | TODO |
| M11-C07 | Complex craters: central peak, terraces, breccia lens; airburst for small stony bodies | TODO |
| M11-C03 | Export dialog: project .tgw, view PNG, top-down map PNG (overlay colours, legend, scale bar, north), 16-bit heightmap PNG (own encoder, min/max tEXt), float32 .raw + .json | DONE |
| M11-C02 | Meteor tool (pi-scaling crater, (R/r)³ ejecta, volume conserved incl. off-map, undoable, logged); drought (rain off, evaporation set, lowest-water record CPU+GPU, drought overlay); comparison table; event log kept across checkpoint restore | DONE |
| M11-C01 | Floods: storm (rain for hours, restored after) and sea surge (simplified tsunami: raised sea head floods via the solver); per-step peak depth (CPU + GPU pass); flood-extent overlay; summary; checkpoint before; event log | DONE |
| M10-C05 | Presentation (bigger text, high contrast, map-only), teacher links to a stage, curriculum-terminology + KS3 readability + projection contrast tests | DONE |
| M10-C04 | Volcano types (emergent build + labels), glacial trough & hanging valley, corrie/arête/tarn (guided), fold mountains (fold-lab section) | DONE |
| M10-C03 | Coastal lessons: cave→arch→stack→stump (voxel model run to stage), spit, bar & lagoon (shoreline model) | DONE |
| M10-C02 | Guided river lessons: waterfall/gorge retreat model and meander/oxbow (sine-generated curve, cut-off, bend section) | DONE |
| M10-C01 | Education Mode: lesson contract, classroom layout, stage states restored exactly, real-feature labels (drainage basin lesson) | DONE |
| M09-C04 | Challenges from measured metrics: river to sea, delta, volcanic island, wear down plateau (seeded, live score, retry) | DONE |
| M09-C03 | Checkpoints (session, ≤6, exact restore keeping camera), compare: summary table + ground/water/plant/ice difference overlays | DONE |
| M09-C02 | Overlay menu (data-gated) + legends + inspector reading: elevation, slope, aspect, D8 flow accumulation, geology, ice, plants, ash (+ existing change/climate/waves/plates/shaking/compare) | DONE |
| M09-C01 | Measure tool (pins A–F: real cell values, distance/bearing/rise/gradient), transect layers (rock/soil/ice/lava/water), VE label, CSV export | DONE |
| M08-C04 | Volcanic island preset (Surtseyan explosive → lava cap), caldera piston collapse (undoable), crater lake, plants on ash not bare lava | DONE |
| M08-C03 | Volcano builds: repeated eruptions (shield = basalt lava; composite = andesite explosive/lava alternating), crater ring, rest years compressed, undoable | DONE |
| M08-C02 | Explosive / mixed eruption styles: Mastin plume height, cinder cone at repose, Pyle-style ash thinning stretched downwind, tephra ledger | DONE |
| M08-C01 | Vent tool + Bingham lava flow (T-dependent viscosity/yield, radiative cooling, quench in water) + solidify to volcanic rock layer | DONE |
| M07-C05 | Earthquake tool (W&C scaling, normal/reverse/strike-slip, shaking map, landslides, undo) | DONE |
| M07-C04 | Fold mountains: guided fold lab (length + area conserved, thrust, erosion) + map strata folding | DONE |
| M07-C03 | Subduction trench + arc volcanoes (o–c, o–o islands) + guided subduction cross-section lab | DONE |
| M07-C02 | Rift fault blocks (normal scarps) + transform slip shifting whole columns | DONE |
| M07-C01 | Kinematic plates: map, motions, boundary uplift/rift/trench, overlay, profile strip | DONE |
| M06-C05 | Biome presets (temperate, alpine, rain shadow, tundra) + what-if compare | DONE |
| M06-C04 | Vegetation: suitability, growth/dieback, erosion shield, trees | DONE |
| M06-C03b | Guided U-shaped valley / corrie / arête cross-sections | DONE (as M10-C04 guided glacial lessons) |
| M06-C03 | Glaciers: mass balance, implicit SIA flow, abrasion, debris + moraines, meltwater | DONE |
| M02-C07 | Float64 (or compensated) water-depth accumulation: deep closed lakes drift ~% over simulated years | TODO |
| M06-C02 | Snowpack (SWE) below 0 °C, degree-day melt, snow cover rendering | DONE |
| M01-C08 | Mountain preset: soften needle peaks (pre-erosion / slope cap) | TODO |
| M06-C01 | Climate: temperature, season, lapse rate, rain shadow, spatial rainfall/evaporation | DONE |
| M05-C04c | Couple shoreline model to the world heightfield (bars/spits as real terrain) | TODO |
| M05-C04b | One-line shoreline lab: spits, bay-mouth bars, lagoons, recurves | DONE |
| M05-C06b | Arch lab rock types, wave climate, world coast, classroom scenarios | DONE |
| M05-C06a | Coastal slump cycle (toe debris buttress, waves unload toe, repeat slumps) | DONE |
| M05-C05 | Local 3D cave → arch → stack → stump guided model | DONE |
| M05-C04a | Beach-face drift, emergent attached spits | DONE |
| M05-C04 | Wave field, onshore transport, surf smoothing, tombolo (partial) | PARTIAL |
| M05-C03 | Longshore drift, spit seeds | DONE |
| M05-C02 | Wave power, shelter, attenuation, cliff retreat, wave-attack map | DONE |
| M05-C01 | Controllable sea level | DONE |
| M04-C04 | Rotational slump lab (guided 2D model) | DONE |
| M04-C03 | Avalanching, rockfall, saturation proxy, Landslide tool | DONE |
| M04-C02 | Weathering with pending store | DONE |
| M04-C01 | Layered stratigraphy, exposure by erosion, strata on cliffs | DONE |
| M03-C06 | River-to-sea preset, profile tool, e2e erosion checks | DONE |
| M03-C04..C05 | GPU sediment pass, change map, turbid water, erosion UI | DONE |
| M03-C01..C03 | Sediment fields/ledger, transport, erosion/deposition (CPU ref) | DONE |
| M02-C06 | River-catchment fixture, e2e water checks, drainage conditioning | DONE |
| M02-C05 | TimeBar, water tools/panel, overlays, inspector water | DONE |
| M02-C04 | Water rendering from solver textures | DONE |
| M02-C03 | GPU water step (WebGL2), validated vs CPU reference | DONE |
| M02-C02 | Local-inertial pipe solver; downhill/bowl/saddle/still-lake tests (spill + outlets covered) | DONE |
| M02-C01 | Water field, rainfall, sources/losses, clock, ledger, format v2 | DONE |
| M01-C07 | Real M4 Safari/Chrome frame-rate check (needs user device); code-split three | PARTIAL |
| M03 … | Erosion/sediment | DONE (M03); pre-erosion of needle peaks → M01-C08 |
| M01-C06 | Presets, reproducibility, save/reload, polished UI | DONE |
| M01-C05 | Smooth/flatten/material paint + undo/redo | DONE |
| M01-C04 | Raise/lower + dirty-region mesh updates | DONE |
| M01-C03 | Camera controls, no brush conflict | DONE |
| M01-C02 | Procedural terrain, smooth mesh, colours | DONE |
| M01-C01 | WorldState contract, rng/noise, axes | DONE |
| M00-C02 | App shell + Three scene | DONE |
| M00-C01 | Tooling + continuity files | DONE |
