# Test results (latest first)

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
