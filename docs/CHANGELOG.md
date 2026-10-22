# Changelog

## M00-C01 — Tooling
- Vite + React + TS strict + Vitest + Three; Netlify config; continuity docs.

## M00-C02 … M01-C06 — Editable 3D terrain (session 1)
- WorldState (bedrock, loose sediment, lithology; SI units) + Engine with dirty regions and per-stroke undo/redo.
- 8 seeded presets: river basin, mountain range, island, archipelago, coastal headlands, layered plateau, continental, flat.
- Three.js diorama renderer: smooth lit terrain, sea-level surface with depth colour, sky, shadows, brush ring.
- Brushes: raise, lower, smooth, flatten, geology paint, add/strip soil. Inspector shows real cell values.
- Save/load in browser (IndexedDB, autosave), .tgw export/import. Scouts-palette UI.

## M02-C01..C02 — Water engine (no UI yet)
- Water depth + flux fields, rain/sources/infiltration/evaporation with exact volume ledger, fixed-step clock, save format v2.
- Local-inertial flow solver: downhill flow, lakes settle level, spill over saddles, drain to sea/open edges.

## M02-C03..C06 — Water you can see and run
- GPU (WebGL2) water solver validated against the CPU reference; automatic CPU fallback.
- Water drawn from real depth/velocity: lakes, flowing streams with flow streaks and foam; depth and flow-speed maps with legends.
- Play/Pause/Step/Speed time bar with simulated clock; Add water, Drain and Spring tools; rainfall, infiltration, evaporation and edge controls; live water budget.
- New worlds are drainage-conditioned (hollows filled with alluvium) so rain organises into rivers. River-basin preset starts with 60 mm/h rain.

## M03 — Erosion, sediment transport and deposition
- Flowing water now erodes soil then bedrock (weak rock faster than hard), carries sediment (muddy water) and deposits it where flow slackens and on the sea floor — valleys incise, fans and deltas grow.
- Runs on the GPU alongside the water; CPU reference and GPU match to 0.01 mm. Sediment budget always balances.
- Erosion panel: on/off, geomorphic acceleration (labelled), bedrock hardness, optional hillslope creep, sediment budget.
- Change map (red = eroded, blue = deposited) against a resettable reference; Profile tool draws cross-sections.
- New preset: River to sea.

## M04-C01..C03 — Rock layers, weathering and slope failure
- Rock now has layers: cut through a hard cap and the weaker rock beneath is exposed and erodes faster; cliffs show their layers.
- Bare rock weathers into soil (weak rock and wet ground faster). Steep debris avalanches, over-steep cliffs collapse into rubble — both easier when saturated.
- Landslide tool (Events): click a slope to saturate it and watch it fail; undoable.

## M04-C04 — Rotational slump lab
- A cross-section "lab" (Landslide panel → Open rotational slump lab): choose material, cliff height, face angle and saturation; it finds the critical curved slip surface and its factor of safety, and when it drops below 1 animates the block rotating back, exposing a back scarp and building a toe. Labelled as a guided model.

## M05-C01..C03 — Coasts: sea level, waves, drift
- Coast tool: sea-level slider (drown valleys or expose the shelf), wave height/period/direction with live wave power.
- Waves erode cliffs — exposed weak rock fastest, sheltered coasts least, slowed by a widening wave-cut platform; cliffs collapse behind; debris goes offshore. Wave attack map.
- Longshore drift moves beach sand along the shore with oblique waves; spits start to grow where the coast turns.
- New worlds start with settled, stable slopes (talus aprons) instead of collapsing on the first step.
- Coastal headlands preset rebuilt: straight coast, chalk/clay bands, waves on — bays form in the clay.

## M05-C04 (partial) — Wave shadow, onshore sand, tombolos
- Waves now bend around islands and headlands (weaker, angled waves in their shadow). Shoaling waves bring shelf sand ashore and the surf zone keeps beaches smooth.
- Behind an offshore island, sand converges and a salient grows towards it (the start of a tombolo).
- Not yet: spits that grow into land and curve, or bars closing bays — next task.

## M05-C04a — Spits
- Beach sand now keeps moving in the swash zone even after it emerges, and drift cannot turn sharp corners: at the end of a coast it builds an emergent sand spit attached to the land.
- Not yet: bars closing bays into lagoons, cleanly recurved spit tips.

## M05-C05 — Cave, arch, stack and stump lab
- New guided 3D model (Coast panel → "Open cave, arch, stack and stump lab"): a 1 m voxel chalk headland with a joint is attacked by waves at sea level and weathered above it; rock left unsupported falls.
- Stages are detected from the rock's shape (sea passing through = arch, rock cut off from the mainland above high water = stack), shown as a labelled stage strip with the step each was reached.
- Orbitable 3D view, play/pause/step/reset, speed and joint-weakness controls, eroded/fallen volume readouts.

## M05-C06a — Coastal slumping cycle
- Slump lab gains a "Coastal cycle" mode: slumped material rests at the cliff foot and props the cliff up until waves carry it away; then waves cut the toe, the face steepens and the next slump follows.
- Year-by-year factor-of-safety chart with slump markers, toe-debris and cliff-retreat readouts; material, height, saturation and wave-energy controls.

## M05-C06b — Arch lab: rock, waves and classroom scenarios
- Choose the rock (chalk, sandstone, granite, basalt, mudstone, clay) and wave height/period; or "Use this world's coast" to take the world's waves and commonest cliff rock.
- Rock strength is physical in the model: how wide an overhang it can hold and how tall a face weak rock can stand. Clay retreats without caves or arches; granite takes far longer even under Atlantic swell.
- Four classroom scenarios, each with a question.

## M05-C04b — Beaches, spits and bars lab
- New guided plan-view model (Coast panel → "Open beaches, spits and bars lab"): a one-line shoreline model in which waves drawn from a climate drift sand along the coast.
- A spit grows across a bay mouth until it closes as a bar, leaving a lagoon; at a coast end the spit grows into open water, and mixed wave directions curl its tip into a recurve.
- Controls for coast shape, share of waves from each side, high-angle waves and updrift sand supply; lagoon area, spit length and sand in/out readouts.

## M06-C01 — Climate
- New Climate tool (K): temperature falls with height (adjustable lapse rate), a time-of-year slider or seasons that follow simulated time, and a prevailing wind.
- Rain is heavier on slopes the wind blows up and lighter in the rain shadow behind high ground; the rainfall setting is the map average, so total rain is unchanged.
- Evaporation rises with temperature and stops below freezing. Temperature and rainfall map colours with legends; the inspector shows local temperature and rain.
- Runs on both the GPU and CPU water solvers with exact water budgets; climate settings are saved (older saves load with climate off).
