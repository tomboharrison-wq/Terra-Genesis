# Test results (latest first)

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
