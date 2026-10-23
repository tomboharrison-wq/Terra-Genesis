# One next executable task
ID: M08-C04
Goal: Volcanic island, caldera collapse, and new rock joining the landscape (spec E10 + E13 "Volcanism → new solid
rock; water and ecology can subsequently act"). (1) Underwater vent: lava/tephra erupting below sea level
(quenched, already modelled) builds a seamount that emerges as an island — add a "Volcanic island" world preset
(flat sea floor −200 m, centre vent) that runs a build until the summit is above sea level, then stops.
(2) Caldera event (Volcano panel button on an existing volcano): roof collapse into an emptied magma chamber —
summit area subsides by a chosen volume (piston with ring-fault walls, radius ~0.3–0.6 × cone radius),
strata move down, walls settle (settleLoose / rockfall); undoable; a crater lake can then fill with rain.
(3) Check erosion and plants act on the new rock (volcanic erodibility 0.25; plants recolonise ash and lava).
Read only: engine.buildVolcano, terrain/generate presets, tools/history, lavaSim freezeAll/solidify.
Acceptance: island emerges (summit > sea level, coast exists); caldera volume removed = requested (ledger);
undo restores; rain fills the caldera (water test); plants regrow on cooled rock over plant time.
Done when: tests/typecheck/build/e2e pass, committed + pushed.
