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
