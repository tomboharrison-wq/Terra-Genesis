# One next executable task
ID: M08-C02
Goal: Explosive eruptions and fragmental deposits (spec E10). Vent gets an eruption style: effusive (lava only,
as now) / explosive (tephra) / mixed. Tephra: erupted bulk volume rate split into (a) ballistic cinder within a
few hundred m of the vent (deposit thickness ∝ exp(−r/r0), r0 ≈ 150–300 m), and (b) fall from a plume of height
from rate (Mastin 2009: H[km] ≈ 2.0·V̇^0.241, V̇ dense-rock m³/s) carried downwind by the climate wind; thinning
exp(−r/L) with L growing with plume height (Pyle 1989 thinning). Deposits become loose sediment (erodible) or a
tuff layer if thick; tephra ledger (erupted = deposited + left map). Ash overlay/colour; plants buried.
Read only: src/sim/lava/lavaSim.ts (vents, addTopRock), engine lavaHook, climate wind params, VolcanoPanel.
Acceptance: deposit thins away from vent and is elongated downwind; ledger closes; cinder makes steep cone
slopes near the angle of repose (talus settle); save/load.
Done when: tests/typecheck/build/e2e pass, committed + pushed.
