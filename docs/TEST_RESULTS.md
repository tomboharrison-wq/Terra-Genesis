# Test results (latest first)

## 2026-10-27 Mac desktop app (desktop/)
- Built at 721bf80: Terra-Genesis-mac-apple-silicon.zip (130 MB) and -intel.zip (135 MB). Info.plist (name, org.terragenesis.app, 1.0.0, education), custom icon in bundle, Mach-O arm64/x64, app.asar web/ identical to dist/, ad-hoc signature present, zip keeps 14 framework symlinks + exec bits.
- Wrapper smoke test (Linux Electron 44.7.0 under Xvfb, same main.cjs + app:// protocol): app loads, Help version 721bf80, GPU water backend, 256-cell world rendered, no errors. NOT run on a real Mac here (Gatekeeper first-open steps in HOW-TO-INSTALL.txt unverified).

## 2026-10-26 M12-C01 Landform Show + Time-lapse
- npm test 262 PASS (+ landforms: spec coverage of all 27 Topic 1 landforms, stage order, KS3 sentence length, process wording, glossary completeness, clock monotonic; time-lapse on/off restores settings; adaptive step cap shrinks on slow frames and recovers). e2e 56/56 PASS (+ Landform Show plays at once, clock advances, glossary, exam steps, Escape; time-lapse one click on, second click restores).
- Found by testing: time bar readouts changed width so buttons moved while playing (fixed widths); time-lapse queued more GPU work than a slow chip could run — 27–58 s frames headless → adaptive per-frame step cap → ~1 s (idle level in this environment). Every scene reviewed frame by frame from rendered contact sheets; fixed shapes (ribbon lake, arch, hanging valley), snow reappearing after melt, overlapping/off-frame labels.

## 2026-10-26 M11-C04 final
- npm test 256 PASS (+ frame-rate independence: bit-identical at 60 / 20 / uneven fps). gpu-check 12/12. e2e 54/54 PASS: + slot saved with Ctrl+S loads back exactly after a change; Help shows the build version. Caught on the way: a duplicate variable in the new e2e step (script did not start); the spit lesson needed > 60 s to reach 30 years at headless frame rates (model ≈ 3 s of compute for 30 years) → 35 ms model budget per frame, e2e wait 120 s.

## 2026-10-25 M11-C04 (QA, part 1)
- e2e 52/52 PASS on the fix build (rail, meteor panel, stepped pointer): overlay inspector reads the geology over the sea floor.
- Accessibility: WCAG contrast from styles.css — caught the Play button (light text on Scouts green, 2.41:1) → dark text (≈ 6.8:1); all other pairs ≥ 4.5:1. Tool shortcuts unique. e2e adds: every button named, Tab focus ring, Escape closes dialogs.
- Saving: files written as v1 … v11 all decode, validate and run; newer-version files refused with a message.
- Performance (CPU reference, this container, measured while an e2e also ran): 128² 9.4 ms/step, 256² 37 ms/step, 512² 147 ms/step (water + sediment). GPU (gpu-check, SwiftShader): 0.3–1.1 ms/step submit on 32–96² fixtures. Real-hardware GPU timing still unmeasured.
- Browsers: only Chromium is installed here; Firefox / WebKit not tested.
- Deployment: not verifiable from this session (container cannot reach netlify.app; the site is not in the connected Netlify account).
- gpu-check 12/12 (new: sea-surge surgeIn equal, peak Δ 0.001 mm; drought-pond low record). npm test 255 PASS.
- e2e of the C02–C04a build (8ecebe6): 51/52 — new drought/meteor (crater 858 m, undo exact), exports (all 5 files valid) and accessibility checks PASS; overlay check failed again with nothing else running: inspector showed 'Point at the terrain' because the e2e jumped the pointer in one event from a panel button onto the map. A standalone probe showed the inspector works at every step with real pointer movement; e2e now moves the pointer in steps and waits for the reading. Layout found from its screenshots: 22-tool rail overflowed 900 px (now two columns under 1350 px tall), Meteor panel overlap fixed.
- e2e of the M11-C01 build: 48/49 — flood check PASS (0.937 km², deepest 2.29 m, peak ≥ depth everywhere); the overlay check failed on its inspector/ice condition while CPU benchmarks ran alongside (detail now prints which) — rerun pending.

## 2026-10-25 M11-C02, C03
- + drought: lowest depth ≤ every depth after each 4 h, rain and evaporation restored, water lost, ledger closes; event log survives checkpoint restore. Meteor in engine: crater dug, logged, Ctrl+Z restores the surface exactly. gpu-check gains drought-pond (low record CPU vs GPU). Exports: CRC-32 check value, 16-bit heightmap PNG decodes to identical values (north at top, min/max text), RGBA round trip, float32 raw exact. npm test 251 PASS.

## 2026-10-25 M11-C01 (+ M11-C02 meteor model)
- + hazards: surge profile; flood summary threshold; storm — peak ≥ every depth after each 300 s, rain restored on time (clock carries sub-step remainder, ends ≤ 1 step late), ledger closes < 1e-4, log began/ended; sea surge 3 m — > 60 % of the low plain wet, hill above run-up dry, sea level unchanged, peak 1–3 m, drains back, surgeIn ≈ seaOut, closure < 1e-4. Caught: closure scale ignored sea-supplied water (added gross surgeIn ledger term). Meteor: pi-scaling exponents exact, Barringer inputs → 1.55 km (real 1.19 km; impactor estimates 30–50 m), volume excavated = on-map + off-map ejecta, on-map share ≈ 1 − R/R_edge.
- e2e (M10 build, before M11): 47/48 → spit lesson too slow at 7 fps (120 days/frame); now time-budgeted per frame. gpu-check gains a sea-surge CPU/GPU case (surgeIn, peak depth) — not yet run.
- npm test 246: one timeout (climate quarter-year season run, 60 s) while e2e ran in parallel; passes alone in 36 s; timeout raised, speed-up in backlog.

## 2026-10-23 M10-C03 … C05
- + coastal: lesson stages reached by the chalk headland model in order (< 2000 steps, deterministic re-run); spit grows through the stages; bar lesson's lagoon area × 5+ at closure. Glacial: trough exponent b 1 → > 1.6, deepened > 100 m, hanging valley > 100 m; corries → arête (crest < 1/10), rock lip > 20 m above the hollow. Folds: stage mapping flat → folded → thrust → eroded. Volcano lesson builds and labels both volcanoes (composite taller). Curriculum: terminology per module (caught: rivers GCSE never said "source"), KS3 mean ≤ 26 words/sentence (caught one 28-word passage), lesson font sizes, contrast text/panel ≥ 7:1, muted ≥ 4.5:1, yellow titles ≥ 7:1.

## 2026-10-23 M09-C04, M10-C01, M10-C02
- npm test PASS 230 (+ challenges: windowed sea-inflow rate, delta/new-land/plateau metrics pass + fail cases, heavy rain refused, every setup generates; education: synthetic valley → mouth at outlet, confluence where the side valley joins, tributary up it, source at the head, watershed on the divide; lesson world: source's D8 path reaches the mouth; lesson contract; guided: waterfall overhang ≤ limit, collapses retreat ≥ 0.9 × limit, gorge = retreat; meander sinuosity ↑ and neck ↓ to cut-off, shorter after cut-off, oxbow ≈ one meander long, bend section deepest at the outer bank)
- Challenge targets set from measured rates (browser): delta grows ≈ 260,000 m³/day at 50 mm/h (first 20,000 m³ target fell in an hour unaided — raised to 500,000 m³ in 5 days, starting dry). Plateau at 40 mm/h: 80 M m³ in the first hour (rain-triggered failure of dry-settled mudstone/clay scarps — wet stability −20 % rock / −35 % loose, M04) then ≈ 6 M m³/day; 86 M m³ after a day → target 100 M m³ in 10 days, starting dry.
- Fixed on the way: feature rules (hillside rills counted as channels → confluence needs a branch with ≥ 10 % of the flow; source = head of the main stem); labels overlapping (stacked on longer stems); landscape behind the lesson panel (view offset); meander lesson labelled the slip-off slope on the outside of a bend (fixed: both banks of one bend).

## 2026-10-23 M09-C03
- npm test PASS 220 (+ checkpoints: restore after 30 min more rain + erosion + a landslide + plant change gives back bedrock, soil, water, fluxes, suspended load, strata, plants, ash, lava and sim time exactly; the checkpoint is a deep copy; diff summary equals cell sums (−2 m × 100 cells, +0.5 m × 60, water, plants) and the ground overlay reads −2.0 m; different-world checkpoints cannot be compared but can be restored; cap of 6 drops the oldest and its comparison; delete ends a comparison)

## 2026-10-23 M09-C02
- npm test PASS 217 (+ overlays: D8 on an east-tilted plane gives (x+1)·A per row; a V-valley gathers W·H·A at its mouth; sea cells pass nothing on; aspect sectors and facing (rises east → faces W 270°); flat → null; only data-backed overlays offered (no ice / plants / ash / climate / quake / compare / plates / waves on a bare world; offered once data exist); every generic colour in 0…1; inspector texts with units)
- dataviz validator: first aspect palette FAILED (CVD ΔE 1.4 deutan, normal-vision 13.3) → replaced by the validated 8-slot order (all checks pass; contrast WARN relieved by labelled legend + inspector).
- Browser: aspect noise on alluvial flats (0.1° gradients) removed by a 0.5° flat threshold.

## 2026-10-23 M09-C01
- npm test PASS 214 (+ measure: pinned reading equals world arrays at the nearest cell (elevation, bedrock, soil, slope = atan 0.1, aspect 270° W, rock, water, plants, ash, rain, ice, lava; temperature null with climate off); pin pair 300 m E / 400 m N → 500 m, bearing 36.87°, rise 30 m, 6 %; transect samples equal bilinear surface, soil = 0.5 m, CSV header + 41 rows round-trip)
- Browser: two pins on River basin read 196.5 / 298.0 m; rise 101.5 m after snapping pins to cell centres (was 102.6 m when the pair used exact click points but the cards used the cells).

## 2026-10-23 M08-C04
- npm test PASS 211 (+ island preset (128², 30 m): summit > 50 m above sea, > 50 land cells, sea at every edge, world valid; caldera on a cone drops exactly cells × cs² × depth, strata boundaries drop with it, wall just outside the ring unchanged, undo exact; 1 h of 150 mm/h rain: > 90 % of the rain on the caldera stays (moat > 0.3 m deep), flanks drain; after 40 plant years ash cells > 0.3 cover, bare new lava 0)
- Browser: Volcanic island preset generates in ≈ 3.5 s (256², 30 m): round cinder cone ≈ 270 m high with a lava-fringed coast.

## 2026-10-23 M08-C03
- npm test PASS 206 (+ volcanoes on a flat 4.8 km plain, 30 m cells: shield of 6 basalt eruptions, mean flank < 8° (measured 1.6°), wide; composite of 6 alternating andesite eruptions, upper flank > 15° and steeper than the lower flank (concave); shield gentler than composite by > 4× and twice as wide; ledgers close; a build is one undo step, ash marks included. Cinder test now checks a summit crater (> 5 m below the rim).)
- Radial profiles (12 composite eruptions): 203 m high, steepest ≈ 50° just below the rim, then an exponential apron (20 → 1 m over 300–900 m). 8 shield eruptions: 24 m high, 840 m radius, 1.6°.
- Browser: 10-eruption builds take 8.6 s (composite) and 10.6 s (shield) in headless software rendering.

## 2026-10-22 M08-C02
- npm test PASS 202 (+ tephra: thin ash on 3 km sediment conserved to 1e-9; Mastin H(1)=2 km, H(1000)=10.5 km; footprint on-map + off-map = erupted to 1e-5; ash thins away from the vent, downwind > 5× upwind and > crosswind, ledger < 1e-4, finished vent leaves after its ash lands; 1 day of 200 m³/s explosive basalt builds a > 50 m cinder cone whose steepest flank is 28–33°; mixed splits lava/tephra, buries plants, save/load keeps ash + style)
- Browser (River basin): 3 h at 500 m³/s → 8.9 km column, 10.0 M m³ landed + 4.1 M m³ off the edge = 14.1 M m³ erupted.
- e2e: last full run 38/39 — the new ash check's data passed (1854 ash cells, ledger 2e-15) but it also required the vent on land and the random map put it in the sea; that condition was dropped (underwater eruptions are valid). Not re-run in full afterwards. Fixed on the way: float32 rounding lost thin ash on 3 km sediment columns (now carried per cell in float64).

## 2026-10-22 M08-C01
- npm test PASS 196 (+ lava: runs downhill and fills a 6 m hollow, ledger < 1e-4; 3 m andesite slab does not move on 3 % (h_c ≈ 70 m) but creeps on 45 °, basalt spreads; flow cools, stops and becomes volcanic rock — ground rises by the erupted 6000 m³, world valid; 0.5 m sheet cools > 3× faster than 5 m; save/load keeps lava + vents)
- Browser: 3 h of 200 m³/s basalt on River basin (256², 30 m) = 2.2 s CPU; flow follows the valley.

## 2026-10-22 M07-C05
- npm test PASS 191 (+ earthquakes: W&C M7 → 40.7 km, 1.07 m; normal drops the hanging wall (footwall up a little) with strata following; reverse raises; M8.4 strike-slip offsets a ridge on 10 m cells; undo restores bedrock + strata bounds exactly (history now records bounds); strong shaking on steep slopes triggers landslides)

## 2026-10-22 M07-C04
- npm test PASS 185 (+ folds: amplitude grows with shortening, top layer keeps its length L0; every layer's area conserved (to 1e-2 rel) and thickening = 1/(1−s); thrust: slip > 0, gentler folds, two pieces per cut layer, area within 1 %; anticlines/synclines found, erosion below crests; map: collision belt boundaries alternate above/below their starting depth)
- Fixed in-chunk: per-vertex thrust displacement stretched crossing edges (8 % area error) → clip layers at the ramp and translate the hanging wall (≤1 %).

## 2026-10-22 M07-C03
- npm test PASS 180 (+ subduction: ocean→continent trench + vents only on the overriding plate at 7.5 ± 1.5 cells (2.5 × belt), volcanic top layer, cone > 80 m in 10 kyr; o–o arc islands rise above sea on the higher-id plate; c–c collision has no arc; lab geometry: steeper dip ⇒ arc nearer the trench, quakes 0–680 km, most shallow)
- e2e: fixed the flaky smooth-stroke check for good (keep moving during the stroke) — 34/34 before C03.

## 2026-10-22 M07-C02
- npm test PASS 176 (+ faults: rift steps graben < step < step with a shoulder above the start and 3–4 discrete scarps; a 20 mm/yr transform shifts the east plate 4 cells in 100 kyr (500 m cells) and the E–W ridge is offset 10 → 14; ground volume conserved apart from the ledgered strip-end exchange)

## 2026-10-22 M07-C01
- npm test PASS 173 (+ tectonics: no plate fragments <2 %; classification convergent/divergent/transform/interior; converging continents +120 m at the boundary in 10 kyr (0.3 × 40 mm/yr), decaying, ledger = Δ bedrock volume; rift sinks; transform no change; ocean–continent trench + continental uplift; strata move with rock; engine tectonic time, seeded plate maps, save/load)
- Fixed: nearest-boundary BFS re-queued cells until the array overflowed → two-pass sweep (linear).
- Screenshot review: warped-Voronoi plate specks became 6.8 km pillars and belts vertical walls → fragments < 2 % merged, belt width 12 % of the map, over-steep uplift collapses to talus (settleSlopes), uplift factor 0.2. After: one coherent range, 4.85 km after 400 kyr (no isostasy/erosion cap yet).

## 2026-10-22 M06-C05
- npm test PASS 166 (+ biomes: temperate cover >20 % on 96² (≈50 % at 256²), no ice; alpine ice + plants, treeline < snowline, no plants under ice; rain-shadow west cover > 2× east; tundra no forest, sparse, ice; reproducible; what-if warmer ⇒ less ice + higher treeline, wetter ⇒ more cover, world untouched)
- Measured: 150-yr flowing glacier spin-up took 35 s at 256² → static starting ice (≤120 m) laid above the snowline (<1 s), deterministic.

## 2026-10-22 M06-C04
- npm test PASS 156 (+ vegetation: grows to suitability in warm wet soil, none above the treeline; none on bare rock / under ice / in drought / on cliffs; dieback faster than growth; cover cuts total erosion on a transport-limited slope (<0.8×, detachment ×0.2); engine plant time; save/load)
- gpu-check 10/10 (+ veg-erosion: GPU applies the same erosion shield)
- e2e 31/31 (+ GPU mountain world, 1200 mm/yr, 14 °C: cover 19 % (forest 18 %), lowlands 0.41 vs summits 0.00)

## 2026-10-22 M06-C03
- npm test PASS 150 (+ glaciers: slab flows downhill with volume conserved 1e-5; ice accumulates above the ELA, snout flows below it, ledger closes; abrasion lowers the bed, debris dropped as moraine, debris ledger closes; erosion confined to the ice and greatest on the centre line; engine meltwater input keeps the water budget; save/load)
- Measured: explicit SIA reached only 0.3 glacier yr per 40 ms update on the 128² mountain world → semi-implicit CG (~5 yr/update). Loose CG tolerance broke conservation (5 %) → ice moved by donor-limited transfers of the implicit fluxes (1e-9). Unbounded dt·D gave 1100 m ice spikes (CG not converged) → dt·D/cs² ≤ 100 (0 unconverged, max ice ~190 m).
- Not achieved: U-shaped cross-sections (centre deepens faster) → guided lab M06-C03b.
- e2e 30/30 (+ GPU mountain world, 20 yr/h requested: 61 yr achieved + 59 yr lag reported, ice closure 1.8e-9, water 6.8e-6). Default lowered to 10 yr/h. Fixed flaky smooth-stroke check (select tool by clicking the rail).

## 2026-10-22 M06-C02
- npm test PASS 144 (+ snow: cold plateau gets ≈10 mm SWE/h while lowland rains; 4 mm/°C/day at +5 °C melts exactly 20 mm/day; a seasonal year builds and melts a plateau pack (snowmelt > ½ snowfall); climate off → no snow; drowned snow ledgered to sea; save/load)
- gpu-check 9/9 (+ snow-ridge: snow cpu 274164.9 gpu 274164.9 m³, melted 29737.5 both)
- e2e 29/29 (+ GPU cold spell 1.57 M m³ snow → warm spell 0.83 M m³; closure 1.5e-7 / 2.0e-6)
- Found: float32 round-off of small per-step increments on deep stores (snow fixed with float64 mirror / GPU delta fold; water depth logged M02-C07).

## 2026-10-22 M06-C01
- npm test PASS 138 (+ climate: lapse 6.5 °C/km exact; season ±amp; ridge with W wind: windward > plain, > 2× lee, lee < plain, mean 1, reversing wind swaps sides; climate off bit-identical to old forcing; ledger closes <1e-5 with spatial rain + evaporation, total rain unchanged; no evaporation below 0 °C; seasons advance 0.25 in a quarter year; save/load + migration)
- gpu-check 8/8 (+ climate-ridge: rain cpu 115200.0 gpu 115200.2 m³, evaporated cpu 13000.0 gpu 12977.6 m³)
- e2e 28/28 (+ mountain world: rain 0.03×–2.24× of average; GPU water budget closure 2.5e-7 with spatial rain/evaporation)
- Fixed during the chunk: linear windward uplift gave 22× on steep generated peaks → saturating tanh, max (1+k)×.

## 2026-10-22 M05-C04b
- npm test PASS 130 (+ shoreline: sand ledger exact (<1e-3 m³) and f ≥ 0; zero energy → no change; bay-mouth bar: lagoon >600 cells by yr 26 and sand across the whole mouth; spit tip >20 cells out along the coast line; no supply → updrift beach erodes; A=0.8 straight (hook ≤3) vs A=0.65 recurved (hook ≥4, shorter); deterministic)
- e2e PASS 26/26 (+ bay closes: lagoon 2.38 km² at year 24 in the browser)
- Diffraction round corners was needed for recurves; it slows bar closure (yr 10 → yr 21).

## 2026-10-22 M05-C06b
- npm test PASS 124 (+ clay: no cave/arch/stack; granite 4 m 12 s: full sequence but arch later than chalk 2 m 8 s; 4 m waves speed chalk; no joint ⇒ cave >3× later)
- e2e PASS 25/25 (+ scenario picker sets clay + question; world coast note "waves 2.0 m, 8 s; cliffs mostly chalk")
- Stage tests tightened: cave needs a roof, arch passage must run under rock, stack must have a sheer face to sea level.

## 2026-10-22 M05-C06a
- npm test PASS 120 (+ coastal slump: apron raises FoS monotonically and is real ground; ≥2 slumps in 160 yr, each repeat only after debris removed, ledger slumped − removed = debris, crest retreat = Σ events; no waves ⇒ ≤1 slump and apron kept; stronger waves ⇒ more slumps, more retreat)
- e2e PASS 24/24 (+ coastal cycle: 2 slumps, 35.9 m retreat in 150 yr in the browser)

## 2026-10-22 M05-C05
- npm test PASS 116 (+ arch: stages in order headland→cave→arch→stack→stump; at arch a water path crosses the headland while all rock above high water is still joined to the mainland; at stack >20 voxels above high water are cut off; stump ≤ high water; voxel ledger initial − now = eroded + fallen every step; deterministic; seed 11 gives the same sequence; reset)
- e2e PASS 23/23 (+ arch lab reaches stack via cave and arch in the browser)
- Tuning found: weathering 0.004 let the seaward block hang from the roof until its foot was cut, so it fell whole (no stack); 0.01 breaks the roof first. Bay shores ×0.15 stop the mainland being undercut into a floating slab.

## 2026-10-22 M05-C04a
- npm test PASS 110 (spit test now asserts an emergent spit ≥4 land cells beyond the coast end, land-connected, sand conserved 1e-5; tombolo still passes)
- Explored: bay-mouth bar (spit reaches ~65% across a 12-cell mouth, then angles offshore; lagoon not enclosed), recurve (inconclusive). Logged as M05-C04b.

## 2026-10-22 M05-C04 (partial)
- npm test PASS 110 (+ tombolo: lee wave energy < 0.7× open, salient shoreline advances >2 cells toward island, sand conserved 1e-5; spit seed: >20% of sand carried past the coast end (submerged ridge))
- e2e PASS 22/22 (fixed a test race: tool key + immediate mouse-down after redo).
- Explored and rejected: bay-mouth bar scenario (sand filled bay head / formed submerged diagonal fan) — documented as needing a one-line model.

## 2026-10-22 M05-C01..C03
- npm test PASS 109 (coast: wave power formula, zero-energy no erosion, debris conserved, weak > hard retreat, island shelter, platform slows retreat, drift direction + conservation, spit seed beyond coast end; sea level flood/expose + water closure; coast cadence in engine; settle: stable cliff + talus, presets start stable)
- e2e PASS 22/22 (+ sea-level rise floods 5281→5594 cells; waves erode headlands 177k m³ in 6 h ×1000)
- Headlands 96² CPU run, ×1000: clay bays retreat 2–3 cells vs chalk headlands 0 after 4 accelerated days.

## 2026-10-22 M04-C04
- npm test PASS 97 (+ slump: FoS falls with saturation, dry gentle stable / wet steep fails, slip surface below ground, area conserved block+lobe, scarp + back-tilt, base stays on circle, stable doesn't move)
- FoS table (teaching strengths): 15 m @30° clay dry 1.43 → saturated 0.95; 25 m @45° dry 0.86; 30 m @60° dry 0.61.
- Browser: slump lab renders, dry 18 m/35° FoS 1.20 stands; saturated 0.78 fails (crown drop 3.4 m, tilt 8°). docs/reference/m04-slump-lab.png

## 2026-10-22 M04-C01..C03
- typecheck PASS · npm test PASS 91 (strata: layer lookup, brush exposure + undo, paint layer, cap-rock 1.38× erosion, plateau, format v4; weathering; avalanche to repose; clay cliff fails / granite stands; wet pile flatter; landslide conserve + undo; gentle ground stable)
- gpu-check PASS 7/7 (caprock 0 lithology mismatches; cliff-failure rockfall CPU=GPU 65,999.2 m³)
- e2e PASS 20/20 (+ landslide undoable). Visual: docs/reference/m04-*.png

## 2026-10-22 M03 complete
- typecheck PASS · npm test PASS 79 (sediment: no-forcing, ledger + solids conservation, two-rocks, sediment-fan, delta-mouth, long storm, creep, format v3; engine erosion integration)
- gpu-check PASS 5/5 (erosion-slope / erosion-delta: bed maxΔ 0.01 mm, eroded volume identical CPU/GPU, sediment closure ≤3.6e-7)
- e2e PASS 19/19 (+ GPU erosion to sea, browser sediment closure 1.7e-8, eroded terrain restored after reload)
- Creep study (96², ×300, 6 h): creep 0 → 9.6% of land changed >5 cm, grid noise 0.57; any creep ≥2e-5 → ~80%, noise 2–3. Default creep off.
- Visual: docs/reference/m03-*.png. Real-GPU FPS unverified.

## 2026-10-22 M02 complete
- typecheck PASS · npm test PASS 69 (water forcing/ledger, clock determinism, pipe solver: downhill, open edge, level bowl ≤2 cm, still lake ≤1 mm, saddle spill, symmetry, long storm; engine integration; conditioning; river-catchment)
- npm run gpu-check PASS 3/3 (slope ≤0.088 mm, bowl ≤0.001 mm, catchment mean 0.013 mm / vol 0.02%; closures ~1e-7..1e-6)
- npm run e2e PASS 16/16 incl. GPU backend, play advances, in-browser budget closure 5e-6, spring tool, water restored after reload.
- Visual: docs/reference/m02-*.png (river basin after 4 h rain, flow-speed overlay). Real-GPU FPS unverified.

## 2026-10-22 M01 complete
- npm run typecheck PASS · npm test PASS (43 tests: world, determinism, noise, axes, generation ×8 presets, heightfield/raycast, brushes, frame-rate independence, undo/redo, file format) · npm run build PASS
- npm run e2e (headless Chromium + SwiftShader) PASS 11/11: inspector, raise, undo exact, redo, smooth, orbit-no-edit, autosave reload exact, slots, new world, no console errors.
- Visual: reviewed screenshots of river basin, island, headlands, plateau, mountain range (docs/reference/). Fixed headland 1-cell cliff steps and over-bright chalk.
- Perf: no leak (scene children/geometries/textures/programs constant over 5 regenerations; forced-sync render time flat). Real-GPU FPS unverified.

## 2026-10-22 M00-C01
- npm run typecheck PASS · npm test PASS (1) · npm run build PASS

## 2026-10-27 review-fixes M12-C07
- `npm run typecheck`: NOT RUN — Node/npm unavailable in the review environment.
- `npm test`: NOT RUN — Node/npm unavailable in the review environment.
- `npm run build`: NOT RUN — Node/npm unavailable in the review environment.
- Manual code check: shader thresholds and depth legend agree at 1 mm; runtime projector verification remains required.

## 2026-10-27 review-fixes M12-C08
- `npm run typecheck`: NOT RUN — Node/npm unavailable in the review environment.
- `npm test`: NOT RUN — Node/npm unavailable in the review environment.
- `npm run build`: NOT RUN — Node/npm unavailable in the review environment.
- Manual code check: warning is conditional on measured FPS below 25 and points to the existing Quality control.

## 2026-10-27 review-fixes M12-C09
- `npm run typecheck`: NOT RUN — Node/npm unavailable in the review environment.
- `npm test`: NOT RUN — Node/npm unavailable in the review environment.
- `npm run build`: NOT RUN — Node/npm unavailable in the review environment.
- Manual code check: Landform Show wording now says approximate/teaching timescale; Electron rejects non-HTTPS external links and validates packaged asset paths/extensions.

## 2026-10-27 review-fixes M12-C10
- `npm run typecheck`: NOT RUN — Node/npm unavailable in the review environment.
- `npm test`: NOT RUN — Node/npm unavailable in the review environment.
- `npm run build`: NOT RUN — Node/npm unavailable in the review environment.
- Manual code check: CPU fallback wording is explicit in the visible time bar.

## 2026-10-27 review-fixes verification
- `npm ci`: PASS (Node 22.14.0 temporary runtime; npm reported 4 audit vulnerabilities: 1 moderate, 1 high, 2 critical).
- `npm run typecheck`: PASS.
- `npm test`: PASS — 47 files, 262 tests.
- `npm run build`: PASS — Vite production build completed; bundle-size warning remains (main JS ~1.24 MB minified).
- `npm run e2e`: BLOCKED — Chromium executable missing at `/opt/pw-browsers/chromium`.
- `npm run gpu-check`: BLOCKED — Chromium executable missing at `/opt/pw-browsers/chromium`.
