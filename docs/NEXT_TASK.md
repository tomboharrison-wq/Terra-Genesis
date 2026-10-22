# One next executable task
ID: M07-C05
Goal: Earthquake tool (spec E9: "orientation, fault type, location, horizontal/vertical offsets and persistent
surface deformation; camera shake optional and not the mechanism"). Click a point on the map, choose fault type
(normal / reverse (thrust) / strike-slip), strike (orientation), rupture length, magnitude → slip from a scaling
law (Wells & Coppersmith-like: log10 L, average displacement vs Mw). Deformation: hanging wall raised (reverse) or
dropped (normal) with a tapered profile, strike-slip offsets columns along the rupture (reuse shiftPlate-style
column moves on a strip); real persistent changes, undoable as one edit; ground-shaking intensity map overlay
(decays with distance) and an optional short camera shake for feel only. Readouts: Mw, rupture length, max slip,
area uplifted/dropped. Also trigger landslides where shaking × slope × saturation exceeds a threshold (reuse
landslide). Tests: scaling law, normal fault drops hanging wall, reverse raises, strike-slip offsets a ridge,
undo restores exactly.
Done when: tests/typecheck/build/e2e pass, committed + pushed.
