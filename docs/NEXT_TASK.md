# One next executable task
ID: M06-C05
Goal: Biome presets and comparisons (Part J M06-C05). New World presets that set climate + plants + snow/glacier
settings together on suitable terrain: "Temperate valley" (wet, forested), "Mountain glaciers" (cold, ice above
the snowline), "Rain-shadow desert" (ridge with wet windward forest and dry lee), "Tundra / periglacial" (cold,
sparse plants). A Compare tool: snapshot the current world, change one climate setting (warmer/colder/wetter/
drier), run the same time on a copy (CPU, off the UI thread budget) and show side-by-side numbers (plant cover,
ice, runoff, erosion) and a difference map. Every preset reproducible from its seed.
Read only: src/terrain/generate.ts presets, NewWorldDialog, ClimatePanel, engine advance.
Acceptance: each preset generates with the intended state after a short spin-up (tests); compare reports
warmer ⇒ less ice / higher treeline, wetter ⇒ more plant cover; e2e for one preset + compare.
Done when: tests/typecheck/build/e2e pass, committed + pushed.
