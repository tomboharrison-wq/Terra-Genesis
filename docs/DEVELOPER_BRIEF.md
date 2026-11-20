# Terra Genesis — developer brief (V2.0 and beyond)

## What this is
Terra Genesis is a browser landscape-evolution sandbox built by Tom, a UK secondary geography teacher, to teach KS3 and
Edexcel GCSE Geography A (1GA0) landforms and processes: rivers, coasts and glaciation. It is used live in lessons.
Repo: github.com/tomboharrison-wq/Terra-Genesis (TypeScript, React, Vite, Three.js). Read `AGENTS.md` first.

## The ultimate aim
A teacher clicks a landform (waterfall and gorge, meander and oxbow lake, levee, corrie, arête, glacial trough,
moraine, headland, cave–arch–stack–stump, spit, wave-cut platform) and it **forms live in front of the class from
physical processes**, step by step in the correct order, at high speed (hundreds to thousands of years per second),
**looking real enough that pupils recognise it from photographs and field trips**. Every label and number on screen is
measured from the simulated landscape, never scripted. Pupils then change a cause (discharge, rock strength, wave
energy, sea level, climate) and watch the landform respond. The ambition is TerraFirma-level depth; it is an
ambition, not a claim of equivalence.

## What "really good" means
1. **Accuracy teachers can trust.** The sequence and processes match the GCSE specification. A guided or illustrated
   model is always labelled as one; a simulation is a simulation. Limits are stated in the app, not hidden.
2. **Live, high-definition visuals** (details below), driven by simulation state.
3. **Classroom reliability.** Stages open in about a second, nothing freezes on a projector, it works on school
   laptops and in the Mac app, and teachers can print worksheets.
4. **Deployed automatically.** GitHub `main` → Cloudflare Worker `terra-genesis`. Every deploy goes to that Worker.

## Graphics: what we want
Two tiers, set by hardware. **Confirm Tom's real classroom machines and projector resolution first.**
All frame rates so far were measured in software-rendered headless Chromium, so real-GPU performance is unknown.
- **Classroom tier:** integrated GPU, 1080p, steady 30 fps or better, no multi-second stalls.
- **Showcase tier:** Apple Silicon or discrete GPU, 4K, 60 fps, cinematic quality.

Ambitions (each must be driven by simulation data, e.g. water depth, velocity, rock type, ice, vegetation):
- **Terrain:** visual detail far finer than the simulation grid (clipmap/LOD or GPU displacement, detail and normal
  maps), triplanar PBR materials per rock and soil type, visible strata in cliffs and gorge walls, scree, wet-ground
  darkening, snow cover.
- **Water:** shading from simulated depth and velocity, refraction, foam at rapids, waterfall plunge pools and surf,
  shoreline wash, sediment-laden colour, believable sea state, caustics.
- **Light and air:** physically based sky, soft cascaded shadows, ambient occlusion, haze, optional time of day.
- **Life and ice:** instanced vegetation tied to the vegetation model, glacier ice with crevasses, moraine debris.
- **Camera and output:** guided cinematic camera path per landform, subtle motion blur for time-lapse, high-resolution
  screenshot and video export for teachers.
- **Technology:** WebGPU path with WebGL2 fallback, dynamic resolution scaling, GPU compute for the geological solver
  where it measurably helps. The render loop stays independent of the solver.
- **Honesty rule:** detail finer than the simulation grid may be added as shading only and must never be presented as
  measured data. Never trade correctness for looks.

## Hard rules (from AGENTS.md)
Simulation fields are typed arrays in SI units. `surface = bedrock + loose sediment` is derived. No fake simulations
or decorative stand-ins for physics; every enabled control changes authoritative state; physics time step is
independent of frame rate. UI accents use the Scouts colours (pink #ffb4e5, yellow #ffe627, forest green #205b41,
red #ed3f23, blue #006ddf, orange #ff912a, green #25b755); terrain colours stay natural.

## Where the code is now (be honest about it)
- Water-time GPU solver (checked against a CPU reference), geological-time landscape model (stream-power rivers,
  glaciers, waves, meanders), 3D solid voxel patches for waterfalls and headlands (M19/M20), a live landform detector
  and HUD, a 17-group Landform Show, Edexcel-linked lessons, Mac app, Classroom mode.
- **Two lines of work need merging.** `main` has M20 (voxel patches, live detector, Worker config). The `dev` branch has
  instant recorded lessons (`npm run record-lessons`), printable worksheets, river deposition, meanders in any world,
  steadier new worlds and GPU-stall fixes. They overlap in `engine.ts`, `geoRunner.ts`, `GeoControls.tsx`,
  `educationRunner.ts`, `run.ts`, `world.ts` and `TerrainScene.ts`. Keep both sets of features; re-record lessons after.
- **Worker deploy has never succeeded from GitHub.** Builds failed on every commit from 17–19 Nov; the cause was never
  seen. The Worker was deleted and is being recreated (build `npm run build`, deploy `npx wrangler deploy`).
- Known limits: corries are smaller than the grid, beaches stay thin, no estuaries, headland test takes about a minute.

## How to work
Small chunks: implement, test, typecheck, build, commit, update docs. Measure before and after. Report real results,
including failures and anything not tested. Do not claim photorealism without side-by-side screenshots at both tiers.
After each push to `main`, check the `Workers Builds: terra-genesis` result and report it.

## Suggested order
1. Merge `dev` and `main`; get all tests and the browser checks green.
2. Get the Worker building and deploying from GitHub; confirm the live URL.
3. Graphics audit: profile on real target hardware; agree a benchmark scene and reference photographs (for example
   High Force, Old Harry Rocks, Durdle Door, Cheddar Gorge, the Lake District's glacial valleys) with Tom.
4. Implement in order: terrain materials and detail, water shading, lighting and shadows, vegetation and ice,
   camera paths and export, then the WebGPU path.
5. After each landform, Tom checks it against the specification before moving on.
