# One next executable task
ID: M08-C01
Goal: Volcano vent + lava flow (spec E10). Fields (format v10): lavaDepthM, lavaTempC per cell. Vent tool: click
to place a vent with eruption rate (m³/s), lava type (basaltic fluid ↔ andesitic viscous), duration. Lava flows
downhill as a viscous gravity current on the terrain: Bingham-like rule — flux between cells only where the
lava-surface slope exceeds a yield slope; flux ∝ h³·g·slope/(3·viscosity) with viscosity rising steeply as it
cools (Arrhenius-like); radiative/conductive cooling ∝ (T⁴ − T_air⁴) and crust growth; CPU, explicit, own
cadence + substeps in real time (seconds–hours). Volume ledger (erupted = flowing + solidified). Rendering: glowing
orange→dark crust by temperature on the terrain (vertex colour + raised surface by lava depth).
(C02 will solidify lava into volcanic rock bedrock.)
Read only: spec E10, src/sim/glacier/glacierSim.ts (flux/limiter patterns), engine hooks, TerrainScene colours.
Acceptance: lava runs downhill and pools in hollows; viscous lava stops on gentler slopes than fluid lava; a
cooling flow stops; volume ledger closes; save/load.
Done when: tests/typecheck/build/e2e pass, committed + pushed.
