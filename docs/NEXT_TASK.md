# One next executable task
ID: M07-C04
Goal: Continental collision and fold mountains (spec E9 "compression, crustal shortening/folding/thickening and
mountain-building; explicitly support fold mountain formation"). (1) Guided fold lab (SVG cross-section): a
layered sedimentary pile between two continents is shortened step by step; layers deform by a kinematic
buckle-fold model (sinusoidal folds whose amplitude grows as length shortens, area of each layer conserved,
thrust fault option), showing anticlines, synclines, nappes/thrusts, crustal thickening; labels; slider for
shortening %. (2) Map: in continent–continent belts, tilt/fold the strata boundaries (anticline/syncline
undulation parallel to the belt) so erosion of the range exposes folded rock bands in the strata shader.
Read only: src/sim/tectonics/plates.ts (belt rates), src/local/slump/model.ts + SlumpLab (lab pattern).
Acceptance: layer area conserved within 1 % at all shortenings; fold amplitude grows with shortening; map strata
boundaries undulate across a collision belt (test); e2e lab + screenshot.
Done when: tests/typecheck/build/e2e pass, committed + pushed.
