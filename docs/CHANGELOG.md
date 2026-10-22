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
