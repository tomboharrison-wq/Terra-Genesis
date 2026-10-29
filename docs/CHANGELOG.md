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

## M06-C02 — Snow
- With climate on, rain falls as snow wherever it is below 0 °C and builds a snowpack; above 0 °C it melts (adjustable melt rate per °C per day) into streams.
- Snow shows as white on the map from the simulated snowpack; the inspector shows snow depth (as water), and the Climate panel shows snow stored, area covered, fallen and melted.
- Snow is counted as stored water, so the water budget still balances; it runs on both the GPU and CPU and is saved with the world.

## M06-C03 — Glaciers
- Glaciers (Climate panel → Glaciers): ice builds above the snowline (equilibrium line, set by the climate), flows downhill under its own weight, and melts below it, feeding meltwater to the rivers.
- Sliding ice erodes its bed; the rock is carried in the ice and dropped as moraines where the ice melts away. Ice is drawn as blue-white (grey where it carries debris) and raises the visible surface.
- Glacier time runs faster than water time (default 10 years per simulated hour) and is shown with any lag; ice volume, area, thickness, sliding speed, erosion and moraine readouts; saved with the world.
- Honest limit: map-scale ice flow deepens the centre of a V-shaped valley rather than carving a U; a guided U-valley/corrie lab is planned.

## M06-C04 — Plants
- Plants (Climate panel → Plants) spread where it is warm enough (warmest month above 6 °C, so there is a treeline), wet enough (a yearly rainfall setting, more on windward slopes) and there is soil on gentle ground — never in the sea, on bare rock or under ice. They grow over decades and die back faster when conditions worsen.
- Plant cover protects soil: river erosion is reduced by up to 80 % (on both GPU and CPU).
- The ground turns greener and trees appear (conifers where it is cool, broadleaf where warm), drawn as symbols; the inspector shows plant cover.

## M06-C05 — Biome presets and "what if?"
- Four new worlds: Temperate valley (forested), Alpine glaciers (ice above the snowline, forest below), Rain-shadow desert (wet windward forest, dry lee) and Tundra (sparse plants, ice caps). Each starts with its climate set and mature plants (and starting ice) already in place.
- Climate panel → What if?: compare the world now with 2 °C warmer / colder or 30 % wetter / drier — plant cover, forest, treeline, snowline and ice side by side, plus a map of where plants would gain or lose. Your world is not changed.

## M07-C01 — Moving plates
- New Earth → Plates tool (E): divide the map into 2–8 plates, then set each plate's type (continental or oceanic), speed (mm/yr) and direction.
- Where plates collide the ground rises into a mountain belt (wider where two continents meet); where an ocean plate meets a continent a trench forms on the ocean side; where plates pull apart a rift valley sinks; where they slide past there is no vertical change. Rock layers move with the rock.
- Runs in tectonic time (thousands of years per simulated hour). Plate colours with boundaries coloured by type and motion arrows on the map; the Profile cross-section shows the plates crossed and their motion.

## M07-C02 — Faults
- Rifts now sink as fault-bounded blocks: a central graben, stepped blocks and slightly raised shoulders, separated by fault scarps.
- Where plates slide past each other, the slip builds up and the moving plate's ground shifts sideways one cell at a time — rock, soil, water, snow, ice and plants together — so ridges and rivers crossing the fault end up offset. The Plates panel reports the slip and offsets.

## M07-C03 — Subduction and volcanic arcs
- Where an ocean plate sinks under a continent (or one ocean plate under another), a trench deepens on the sinking side and a line of volcanoes grows inland on the other plate, built of new volcanic rock; two ocean plates make volcanic islands.
- New Subduction zone cross-section (Plates panel): the sinking slab, earthquakes along it, melting where the slab reaches 100 km depth and the volcano above — change the speed, the slab's dip and the type of plate on top, and play the motion.

## M07-C04 — Fold mountains
- New Fold mountains cross-section (Plates panel): squeeze a pile of rock layers between two continents and watch them buckle into anticlines and synclines and thicken; allow a thrust fault to carry rock up and over; erode the top to see the bands of old and young rock exposed. Each layer keeps its length and its area.
- On the map, colliding continents now fold their rock layers too, so wearing down the range exposes folded bands.

## M07-C05 — Earthquakes
- New Earth → Quake tool (Q): choose the fault type (normal, reverse/thrust or strike-slip), magnitude and direction, then click the map. The rupture length and slip follow real-world averages for that magnitude; one side of the fault drops or rises (or slides sideways), the rock layers move with it, and strong shaking can set off landslides on steep slopes. Undo puts it all back.
- Show shaking strength colours the map by how strongly the ground shook; an optional short camera shake is for effect only.

## M08-C01 — Volcanoes: lava
- New Earth → Volcano tool (V): click the map to open a vent and pick runny basalt or sticky andesite, the eruption rate and how long it lasts. Press Play and the lava flows downhill in real time, fills hollows, slows as it cools and sets into a new layer of volcanic rock (soil it buries becomes a rock layer underneath). Hot lava glows, burns plants and melts snow.
- Sticky lava has a strength: it only moves where it is thick and the slope steep, so it piles up; runny lava spreads in thin sheets. The panel keeps a volume check: erupted = still molten + turned to rock.
- Hover shows lava thickness and temperature. Saves keep lava and vents (file format v10).

## M08-C02 — Volcanoes: ash and cinder
- The Volcano tool has an eruption style: lava only, explosive, or mixed. Explosive eruptions blast magma into ash and cinder. Cinder piles up round the vent into a steep cone that stands at the angle of repose (33°); ash falls from an eruption column (its height from the eruption rate, Mastin 2009) and thins with distance, stretched downwind by an ash-wind speed you can set (direction from Climate).
- Ash is loose, so rain and rivers can wash it away. It buries plants, shows grey on the map, and hovering shows its depth. The panel keeps a volume check: erupted = landed on the map + blown off the edge. Saves keep ash (file format v11).

## M08-C03 — Volcanoes: shield and composite volcanoes
- The Volcano tool can now build a whole volcano: choose "Build a shield volcano" or "Build a composite volcano" and the number of eruptions, then click the map. Every eruption runs the real lava and ash physics; the long rests between eruptions are skipped (labelled time compression). A progress bar shows each eruption; Ctrl+Z removes the whole volcano.
- Shields (runny basalt lava, eruption after eruption) come out broad and gentle — about 2° on a flat plain. Composite volcanoes (sticky andesite, explosive and lava eruptions taking turns) come out steep with a summit crater, steepest near the top and flattening into an ash apron, rather than straight-sided pyramids. On hilly ground the runny lava runs down the valleys instead, as real lava does.
- Cinder now lands in a ring round the vent, so explosive eruptions leave a crater. Sticky andesite lava now travels further (stiffness 10⁷ Pa·s, within the real range), so its flows build a cone rather than a pillar. Lava calculations are faster (larger minimum time step, still stable).

## M08-C04 — Volcanoes: islands and calderas (volcano milestone complete)
- New world preset "Volcanic island": a new island is grown by real eruptions from a vent on a 60 m deep sea floor. Under water the magma shatters explosively and builds a cinder cone to the surface; once the vent is above the waves, lava flows cap it — as at Surtsey (1963).
- The Volcano tool can build a volcanic island anywhere at sea, and has a "Caldera collapse" option: choose its width and drop, click a summit, and the summit falls in as a block along a ring fault, rock layers and all. Rain then gathers in it as a crater lake. Undoable.
- Cinder cones are now round rather than square-sided (loose material slides to all eight neighbours).
- Plants return on ash within decades of plant time, but not on bare new lava until weathering has made soil.

## M09-C01 — Measuring: pins, distances and better cross-sections
- New Measure tool (M): click to drop pins A–F. Each pin lists the real values at that spot — elevation, slope, which way the ground faces, rock, soil depth, water depth, speed and flow, temperature and rain (with climate on), plant cover, snow, ice, ash and lava — updating as the world changes. Between pins: distance, compass bearing, height difference and gradient. One click draws the cross-section from the first pin to the last.
- The cross-section now shows the layers (bedrock, soil, ice, lava and water), labels its axes with units, states how much the heights are stretched (vertical exaggeration), and can be downloaded as a CSV file for a spreadsheet.

## M09-C02 — Map overlays with legends
- One "Map overlay" menu in the time bar replaces the separate Change-map button. It lists only overlays that have real data in this world, grouped: Terrain (elevation, slope, aspect, geology), Water (flow accumulation, erosion/deposition), Climate (temperature, rainfall), Ice & life (ice thickness, plant cover), Volcanic (ash depth), Earth (plates, earthquake shaking), Coast (wave attack), What if? (plant difference).
- Every overlay has a legend in real units, and the inspector line shows its value under the cursor (e.g. "3,600 m² drains through here", "faces SE (118°)", "20 cm of ash").
- New: elevation colours land by height and the sea by depth; flow accumulation shows how much land drains through each point (rivers stand out); aspect colours slopes by the way they face (ground under 0.5° counts as flat). Aspect colours pass the colour-blind safety checks.

## M09-C03 — Checkpoints and before/after
- New Checkpoints button (top bar): take named snapshots of the whole world, restore any of them exactly (the world goes back, it is never run backwards; the camera stays put), and compare now with a snapshot.
- Comparing shows a summary in real units — time passed, ground lowered and raised (m³), area changed, biggest drop and rise, change in standing water, ice and plant-covered area — and maps the change: four new "Since checkpoint" overlays (ground, water, plants, ice) with legends and inspector readings.
- Checkpoints last for the session (up to six; memory use is shown). Use Save to keep a world.

## M09-C04 — Challenges
- New Challenges button: four goals, each starting from the same seeded world and scored only from what the simulation measures — River to the sea (at least 10 m³/s reaching the sea, 2-hour average, rain ≤ 20 mm/h), Build a delta (500,000 m³ of new ground on the old sea floor in 5 days), Make a volcanic island (0.1 km² of new land standing 30 m above the sea), Wear down the plateau (100 million m³ removed from the plateau top in 10 days, starting dry). A live score card shows progress and time left; Retry restores the exact start.

## M10-C01 — Education Mode
- New Lessons button opens Education Mode: a full-screen classroom layout (tools hidden, large projector-readable text) with a lesson panel — objective, stages, KS3 or GCSE explanations, Previous / Next / Reset, labels on or off, "predict" questions with Show answer, an exam question with a model answer and a common mistake.
- First lesson, "The drainage basin", is a real simulation: its labels (watershed, source, tributary, confluence, main river, mouth) are found from the model's own flow directions on the landscape, Next really runs two hours of rain, and Previous shows the exact earlier state.

## M10-C02 — River lessons: waterfalls and meanders
- "How a waterfall and gorge form": a guided cross-section — hard rock over soft rock, undercutting, a growing overhang and plunge pool, collapse, and repeated retreat leaving a gorge (illustrative rates).
- "Meanders and oxbow lakes": a guided plan view using the curve real meanders follow — erosion on the outside of bends (river cliff), deposition on the inside (slip-off slope, with a cross-section), the neck narrowing, cut-off in a flood, an oxbow lake that silts up into a meander scar.
- Guided lessons are clearly marked "Guided model" so they are never mistaken for the simulation.

## M10-C03 to C05 — More lessons, and classroom presentation (Education Mode complete)
- Coasts: "Caves, arches, stacks and stumps" runs the real chalk-headland model to each stage (drag to turn it); "Longshore drift and spits" and "Bars and lagoons" run the shoreline model over the years.
- Volcanoes: "Shield and composite volcanoes" builds both side by side with the real eruption physics and labels their measured heights; the slope map shows the difference.
- Glaciation: "U-shaped valleys and hanging valleys" (V-valley → glacier → U-shaped trough, misfit river, hanging valley, moraine) and "Corries and arêtes" (corries cut back into a ridge; arête; tarns).
- Tectonics: "Fold mountains at collision margins" (folding, thrusting, erosion exposing anticline cores) using the fold lab's model.
- Presentation: Bigger text, High contrast (solid black and white), Hide panel (map or model only), and "Copy link to this stage" — a link that opens the lesson straight at that stage and level (simulation lessons run the earlier stages to get there).
- Checked by tests: every module uses its GCSE terminology, KS3 sentences stay short, and lesson text sizes and colour contrast suit a projector.

## M11-C01 — Floods: storms and sea surges
- New Floods tool (H): start a storm (rain mm/h for some hours, then the rain goes back to what it was) or a sea surge (the sea stands up to 20 m higher for a set time, rising and falling smoothly).
- Both run through the real water model. The sea surge floods whatever land the higher sea can reach and drains back; it is clearly labelled a simplified tsunami (no travelling wave, breaking or backwash).
- The deepest water reached on every cell is recorded at every solver step. The "Flood extent" map shows where water rose by 0.3 m or more (full rivers and lakes do not count as flooded), with the area flooded and the deepest water.
- A checkpoint is taken before each event so you can restore it, change something (such as building a levee) and run the same event again. An event log records each event with its simulated time and result.

## M11-C02 — Droughts, meteors and comparing events
- Hazards tool (H) now also runs a drought: no rain, and water evaporates at a rate you choose for a number of days. The lowest water on every cell is recorded; the drought map shows how much each lake and river lost and where it dried up.
- New Meteor tool (J): pick a stony, iron or icy impactor, its size, speed and angle; the panel predicts the crater and the energy. Clicking the map digs a crater sized by the impact-scaling laws used by scientists and throws the rock out as a blanket that thins with distance and builds the rim. Undo removes it.
- A comparison table lists finished events side by side (area flooded, dried up or cratered, and what was measured). The log is kept when you restore a checkpoint, so you can run the same event again after changing something.

## M11-C03 — Exports
- The Export button opens a list of five downloads: the project file (.tgw, opens again with Import); an image of the 3D view; a top-down map image in the chosen map colouring, with title, legend, scale bar and north arrow; a 16-bit heightmap PNG for GIS and 3D programs (lowest and highest heights stored inside the file); and exact elevation data as 32-bit floats with a .json description.

## M11-C04 — Final checks (part 1)
- The Play button is easier to read: dark text on the green button (the light text did not meet contrast guidelines).
- The tool bar now fits on a 900-pixel-high screen: on shorter screens it shows the tools in two columns instead of scrolling.
- The Meteor tool no longer shows the unrelated water and erosion panels underneath it, and its crater figures no longer overlap the text below.
- Worlds saved by every earlier version of Terra Genesis still open.

## M11-C04 — Final checks (complete)
- Help now describes everything that is simulated (it still said erosion was "next") and states the known limits.
- Help shows the build version (commit and build time), so you can check the live site is the latest build.
- Checked: the simulation gives bit-identical results at 60, 20 or uneven frame rates; a saved slot loads back exactly; worlds from every earlier save-file version open.
- Terra Genesis now has every planned milestone (M01–M11). Remaining ideas are listed in the backlog.

## M12-C01 — Landform Show (every GCSE landform, one click) and Time-lapse
- New **Landforms** button (top bar): every landform named in Edexcel GCSE Geography A Topic 1 — coasts (1.4), rivers (1.8) and glaciated uplands (1.12), 27 in all, grouped into 17 formations. Click one and its formation plays at once, step by step, as a labelled animated diagram.
- Each step has a caption in KS3 or GCSE wording, on-screen arrows and annotations for the processes happening at that moment (pebbles hurled at cliffs, air squeezed into cracks, the zigzag of longshore drift, swirling rocks in a plunge pool, freeze-thaw in a corrie back wall, rocks plucked from a roche moutonnée…), and the processes in use are highlighted — click one for its definition.
- A time-lapse clock shows how many years have passed (e.g. ≈ 2,000 years for a cliff to retreat, 50,000 years for corries), with speeds from 0.25× to 16×, a timeline to scrub, step back/forward, and Present (full screen).
- "Exam answer" shows the numbered formation steps for an explain question; "Explore in the simulator" opens the matching lesson; "Copy link" gives a link that opens that landform straight away.
- Five formations are drawn from the tested guided models (waterfall, meanders, oxbow lakes, corries, glacial troughs); the rest are animated textbook diagrams, labelled as simplified and not to scale. Each names a real UK example.
- Simulator: new **⏩ Time-lapse** button — the fastest speed with erosion, coasts, glaciers and plants sped up ×1000, showing landscape years per second; click again to go back to your own settings.

## Mac desktop app
- Terra Genesis can now be installed as a Mac app (Apple Silicon or Intel): its own window and Dock icon, works fully offline, saves kept on the Mac. Built from the same web build by `node desktop/build/package-mac.mjs`; install steps in `desktop/build/HOW-TO-INSTALL.txt` (shipped inside each zip).

- 2026-10-27: M12-C07 (review-fixes): lowered the water display threshold to 1 mm — reverted 2026-10-29: it tinted every rain-wetted slope and hid the rivers (see TEST_RESULTS).

- 2026-10-27: M12-C08 (review-fixes): show a clear low-frame-rate warning in the status bar with a direct suggestion to lower render quality for projector lessons.

- 2026-10-27: M12-C09 (review-fixes): clarified that Landform Show clocks are approximate teaching timescales; hardened the Mac wrapper to open only HTTPS links and serve only approved packaged asset types after real-path validation.

- 2026-10-27: M12-C10 (review-fixes): made the CPU water fallback visibly say “CPU · slower” in the time bar so teachers know why simulation speed may drop.

- 2026-10-27: Verification rerun on `codex/review-fixes`: npm install, typecheck, 262 unit tests, and production build pass. E2E and GPU checks remain blocked because the configured Chromium executable is unavailable.

## M13 — Geological time, landscape lessons, classroom mode (2026-10-29)
- **Geological time** (time bar: Water time / Geological time): 1,000, 10,000 or 100,000 years per second. Rivers cut down into the rock (harder rock more slowly), soil forms from rock and creeps downhill, over-steep valley sides collapse, sediment settles in lakes and the sea, and the land can be uplifted. Runs in the background so the view stays smooth; shows the years per second actually achieved.
- Rivers and lakes are drawn from where water would drain. **Replay**: drag back to any recorded moment — the landscape really returns to it, and Play carries on from there.
- Settings: uplift (mm/yr), rock strength, soil creep, and the volumes eroded, weathered, deposited and carried off the map.
- New lessons using it: **V-shaped valleys and interlocking spurs** (the river cuts down 100+ m; valley depth, side slope, floor width and spurs measured on the landscape) and **Waterfall and gorge: watch it retreat** (a waterfall forms on a hard dolerite band, retreats about 2.5 km upstream in 200,000 years and leaves a gorge 100+ m deep). Landforms → "Watch it form (landscape model)".
- **Classroom** button: Performance quality and new worlds at 128² (about 8× faster water); a "Slow? Turn on Classroom mode" button appears when the frame rate drops.
- Fixed: Codex's lower water display threshold made every rain-wetted slope look flooded — reverted.
