# Terra Genesis — start here

A browser landscape-evolution sandbox: sculpt a world, then let rain, rivers, waves, ice, plates, volcanoes and
hazards reshape it with real (simplified, stated) physics. Includes a UK KS3 / GCSE (Edexcel A) Education Mode.

Live site: https://terra-genesis.netlify.app — open **? → Help**; the version line at the bottom names the build
(commit · build time). It should match the latest commit on GitHub `main`.

## Use it
- **Tools (left):** Terrain brushes · Water (rain, drain, springs, climate) · Coast · Earth (plates, quakes,
  volcanoes) · Measure (pins, cross-sections) · Events (landslides, Hazards = storms / sea surges / droughts,
  Meteor). Every tool has a key — see Help.
- **Time bar (bottom):** Play / pause / step, speed, water display, and the **map overlay** menu (elevation, slope,
  flow, geology, flood extent, drought, …) with legend; point at the map to read values.
- **Top bar:** New world (presets), Save / Load (in this browser), **Checkpoints** (exact snapshots + "what changed"),
  **Lessons** (Education Mode), **Challenges** (scored goals), **Export** (project file, view image, map image,
  16-bit heightmap, float32 elevation + JSON), Import.

## For teachers
- **Landforms** (top bar, yellow) → every Edexcel GCSE Topic 1 landform (coasts, rivers, glaciated uplands). Click one
  and its formation plays straight away, step by step, with labelled processes, a time-lapse clock (0.25×–16×), a
  process glossary (click a process), and the numbered steps of an exam answer. **Present** = full screen; **Copy
  link** opens that landform directly (`?landform=spits`). Pause, step back/forward or drag the timeline at any point.
- In the simulator, **⏩ Time-lapse** (time bar) runs everything as fast as possible with landscape processes ×1000.
- **Geological time** (time bar switch): 1,000–100,000 years per second of river erosion, soil creep, slope failure and
  uplift (a long-timescale landscape model); rivers and lakes are drawn from the drainage; drag **Replay** to go back to
  any moment. Lessons **V-shaped valleys and interlocking spurs**, **Waterfall and gorge: watch it retreat** and
  **Meanders, oxbow lakes, floodplains and levees**, **Glaciated upland** and **Headlands, bays and wave-cut platforms** run it stage by stage with labels measured
  on the landscape (also from Landforms → "Watch it form").
- **Classroom** (top bar): Performance quality and new worlds at 128² (≈ 8× faster water) for school laptops.
- **Lessons** → pick one of 11 lessons in 5 modules (rivers, coasts, volcanoes, glaciation, tectonics), KS3 or GCSE
  wording. Panel buttons: Bigger text, High contrast, Hide panel (map only), and **Copy link to this stage** — the
  link opens the lesson straight at that stage for the class.
- Lessons marked **Guided model** are drawn from stated rules (teaching models); the others run the real simulation.

## Mac app (no internet needed)
Download `Terra-Genesis-mac-apple-silicon.zip` (M1–M4 Macs) or `Terra-Genesis-mac-intel.zip`, unzip, drag
**Terra Genesis** to Applications. First time only: right-click → Open (or System Settings → Privacy & Security →
Open Anyway). Full steps: `desktop/build/HOW-TO-INSTALL.txt`; how to build it: `desktop/README.md`.

## Run it on your computer (developer)
1. Install Node.js 22 LTS from https://nodejs.org
2. In this folder: `npm install`, then `npm run dev`, and open http://localhost:5173 in Chrome or Safari.

## Put it online (Netlify + GitHub Pages)
Day-to-day work goes on the `dev` branch, which does not deploy. Merging `dev` into `main` publishes it in two places:
- Netlify (`netlify.toml`: build `npm run build`, publish `dist`) — one deploy per push to `main`, and pushes that change
  only notes, tests or scripts are skipped so they use no deploy. The free plan has a monthly allowance.
- GitHub Pages, free with no monthly limit: https://tomboharrison-wq.github.io/Terra-Genesis/
  (`.github/workflows/pages.yml`; switch on once in the repository's Settings → Pages → Source: GitHub Actions).
Or drag a built `dist` folder onto https://app.netlify.com/drop.

## Checks
`npm test` (unit, ~256) · `npm run typecheck` · `npm run build` · with `npm run preview` running: `npm run e2e`
(headless browser, ~55 checks, screenshots in tests/screenshots) and `npm run gpu-check` (GPU vs CPU solver).

## Continue building with an AI
Read `AGENTS.md`, then `docs/PROJECT_STATE.md` and `docs/NEXT_TASK.md`. All planned milestones (M01–M11) are done;
`docs/BACKLOG.md` lists optional improvements, and `docs/MASTER_SPEC.md` (via `docs/SPEC_INDEX.md`) is the full brief.
