# Terra Genesis V2.0 — full review (21 Nov 2026)

Reviewed: `Terra-Genesis-V2.0-Complete-Handoff.zip` (build `6ba4412`, lesson model `26e0a36ae6639800`).
For: Tom, and whoever builds the next version. Everything below was checked on the code or in a browser; where
something could not be checked, it says so.

## Verdict
V2.0 is a big step: it merges all earlier work, adds a strong storm-hydrograph lab, three genuine new 3D
simulations (flood management, Holderness coastal management, Lulworth Cove) and labs covering much of Paper 1.
It builds cleanly and opened 19 lessons and labs with no browser errors.

Before it is trusted in class, fix four things: **(1)** V2.0 is not on GitHub; **(2)** the instant lesson recordings
are never used and lessons run on different model settings from the ones their tests check; **(3)** some
"Simulation" badges and live labels claim processes that never ran; **(4)** a set of factual errors listed below.
The graphics are still far from the "super high definition" aim.

## What was checked
| Check | Result |
|---|---|
| Fresh `npm ci`, strict typecheck, production build | Pass. A build from the source matches the shipped `dist/` (only the version string differs). |
| Cloudflare Worker dry run (`wrangler deploy --dry-run`) | Pass, 46 files. |
| Unit tests (full suite, 70 files) | 356 / 357 pass. The 3D flood-valley test takes ~80 s against its 30 s limit; two long tests also trigger Vitest "worker timeout" errors, so `npm test` ends in failure on slower machines. V2.0's own notes only record a 27-test subset. |
| 19 deep links from `HANDOFF_AND_DEPLOY.md`, screenshotted | All open, no page or console errors. |
| Browser test suite (`npm run e2e`) | Crashes after 13 of 66 checks (all 13 passed): the script still looks for the old "Load" button. See the end of this file. |
| Code reading | New labs, new lessons, live detector, service worker, recordings, deploy files. |

## Must fix (in this order)

### 1. Put V2.0 on GitHub
GitHub `main` is still `0ce8f37` (the old M20); commit `6ba4412` does not exist there. The live Worker was
changed at 11:17 today, so V2.0 was deployed some other way. If the Worker is connected to GitHub, the next push to
`main` would replace V2.0 with older code. Push V2.0 to `main` first; then every deploy comes from GitHub.

### 2. Lesson recordings are never used, and lessons run on the wrong settings
- In the browser, no lesson used its recording (glaciated upland, waterfall, headland all ran live).
- Cause: `setGeoMode(true)` runs before the lesson state is set, so V2.0's new rule in `geoRunner.ts`
  ("outside lessons, turn on transport-limited deposition") switches `transportCapacityK` to 1. The setting then
  sticks for the whole session. The recordings and the unit tests use 0, so the start-of-stage check never matches.
- Effects: lessons are slow again; lesson measurements can differ from the tested values; anything a teacher
  did in the sandbox changes every later lesson.
- Fix: when a lesson starts, reset the model settings to fixed lesson values (and set the lesson state before
  `setGeoMode`). Add a browser test that asserts a lesson stage was played from its recording.

### 3. Honest badges and labels
- `live-corrie-tarn` and `live-roche-crag-tail` run no process: each stage swaps in a ready-made world and the
  labels sit at fixed positions. They are marked `kind: 'emergent'`, which shows the green "Simulation" badge.
  Mark them as illustrated models, or make the landforms form by a process.
- None of the five new labs (waves/dunes, OS map, glaciation, hazards, ecosystems) says it is an illustrated
  model or calculator. Add a clear badge, distinct from "Simulation".
- Live landform detector: a brand-new river-basin world at Day 1, with no water on it, is labelled
  "Waterfall · 102 m drop", with an explanation of caprock undercutting and gorge retreat that never happened.
  `liveDetector.ts` calls `findWaterfall` without the hard-rock condition. Require a hard-over-soft rock step and
  flowing water (or a geological run) before calling something a waterfall, and only explain processes that ran.

### 4. Factual and curriculum errors
- **Tropical storm presets:** "Typhoon Haiyan (Cat 5)" produces Category 3 (~200 km/h); "Atlantic Hurricane
  (Cat 2)" produces Category 1 (~126 km/h). Haiyan was Category 5, ~315 km/h sustained, ~895 hPa. The formula
  is invented (intensity rises with latitude via a Coriolis term); calibrate it so presets give their named
  category, and label the lab as illustrative. The Haiyan button also stays highlighted whatever is selected.
- **Holderness:** the lesson says "waves from the SW drive west-to-east longshore drift". On Holderness the
  dominant waves come from the north-east and drift runs north to south, towards Spurn Head.
- **Helvellyn:** the summit is a broad plateau, not a pyramidal peak. Label it "summit"; use another example
  (e.g. Snowdon) for a pyramidal peak.
- **Spec tags:** tectonic plate margins are not in Edexcel GCSE Geography A (they are AQA 3.1.1 and Edexcel B);
  cold environments/permafrost are an AQA option, not Edexcel A Topic 3. "Full AQA 8035 and Edexcel 1GA0
  coverage" is overstated: climate change, UK weather and drought, and AQA hot deserts are missing. Check every
  spec code against the current specifications.
- **OS map:** contour spacing is chosen from relief (50 m on hilly worlds). Exam OS maps use 5 m (10 m in
  mountains) with an index contour every 50 m. Add rivers and lakes in blue, a scale bar, north arrow and key,
  and give gradients as "1 in n". "Steepest slope 69°" is a grid artefact; measure over ~100 m.
- **Glaciation lab:** basal shear stress shows 337 kPa (155 m ice on a 14° slope). Real glaciers sit at about
  50–150 kPa. Fix or remove.
- **Waves lab:** the "Fetch distance" slider is stored but never used, so it changes nothing (breaks the
  "every control changes the simulation" rule). Wire fetch into wave height and period, or remove it.
- **Plate margins diagram:** the blue band labelled "Oceanic Plate" is the sea; the plate is the grey slab.
  No trench is drawn under the "Ocean trench" label.
- **Lulworth Cove** is modelled ~130 m across; the real cove is roughly 400–500 m. Scale it up or say it is scaled.
- **Land cover:** Holderness farmland, the Dorset chalk downs, Helvellyn's bare upland and the "steep impermeable"
  flood catchment are all covered in the same dense woodland. Give each scenario its real land cover.

### 5. Service worker and recordings
The service worker serves `.tgw` recordings cache-first, but they keep the same file name when re-recorded, and
the app does not check a recording after loading it. After a model update a classroom machine could play an old
recording. Check the loaded world against the manifest's `after` fingerprint and add the model hash to the file
URL. Also prune old cached assets (the cache name never changes, so it grows with every deploy).

### 6. Tests and records
Raise or restructure the slow tests (flood valley ~80 s, M20 headland ~55 s), so the full suite passes on an
ordinary machine. Record full-suite results in `docs/TEST_RESULTS.md`, not subsets. `PROJECT_STATE.md` says
"COMPLETE & DEPLOYED LIVE"; make status lines say only what was verified.

## Graphics: the gap to "super high definition"
What the screenshots show: noise-generated rock and grass textures (no photographed materials), blob "lollipop"
trees, the headland as a near-rectangular white block, smooth domes for the crag and roche moutonnée, the same
woodland on every world, and spiky tarn water. Recognisable, but stylised. Real-GPU frame rates are still
unmeasured (all tests ran in software-rendered Chromium).

Suggested order, each checked with side-by-side screenshots against a reference photo:
1. **Real materials:** photo-scanned CC0 texture sets (Poly Haven, ambientCG) per rock and soil type — chalk,
   limestone, sandstone, granite, boulder clay, scree, sand, turf — with triplanar mapping, compressed (KTX2).
2. **Land cover and vegetation:** a land-cover map per scenario (pasture, arable, moorland, chalk grassland,
   woodland only where real); proper instanced tree models with distance levels; grass near the camera.
3. **3D rock landforms:** smoother, higher-resolution solid meshes with fine detail so headlands, arches and
   crags read as rock, not boxes.
4. **Water:** spray and foam at waterfalls, flow-mapped river surfaces from simulated velocity, sea waves with
   shoreline foam from the wave model.
5. **Light:** soft sun shadows, ambient occlusion, atmospheric haze.
6. **Showcase tier:** WebGPU path, anti-aliasing, denser terrain near the camera; measure on real classroom
   hardware first.

## Worth adding (teaching)
- Climate change (Edexcel Topic 2 and AQA): causes, evidence, effects; UK weather hazards and drought.
- Cross-section tool on the OS map (draw a line, get the profile): a common exam skill.
- Photo comparison: a real photograph beside the model view for each named landform.
- If teaching AQA as well: hot deserts.

## Smaller points
- Main JavaScript bundle is 1.2 MB (391 KB gzipped); load the labs only when opened.
- Source maps (~6.5 MB) are published with the site; optional to keep.
- `HANDOFF_AND_DEPLOY.md` suggests deploying anywhere (Netlify, Vercel, Pages); the project rule is the
  Cloudflare Worker only.

## What is good — keep it
- Storm hydrograph lab: a mass-conserving rainfall–runoff model, clear GCSE vocabulary, CSV export.
- Flood management, Holderness coastal management and Lulworth Cove are real simulations with measured labels;
  Mappleton (1991) and Great Cowden are the right case study.
- Wave physics is right (wavelength = gT²/2π gives 156 m at 10 s; wave power 2.4 kW/m at 0.7 m).
- Storm formation thresholds (26.5 °C, 5° from the Equator, wind shear, landfall decay), Gersmehl stores and the
  permafrost content are sound.
- Offline support for unreliable school Wi-Fi is a good idea (once the recording check above is added).

## Browser test suite result
13 of 66 checks ran and passed; then the script crashed. It still clicks a top-bar "Load" button, which V2.0
moved into the new "File ▾" menu, so the suite cannot get past the save/load step and has not been runnable since
that UI change. Update its selectors (and any others the new shell changed), then run it in full and record the
result. Add assertions for the new labs and for recorded lesson playback while doing so.
