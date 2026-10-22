# One next executable task
ID: M05-C06
Goal: Finish spec E6 local models. (a) Coastal slump: slump lab gets a "coastal" mode in which the toe lobe sits
at the cliff foot and waves remove it over time (protective temporary toe debris), so the FoS drops again and a
second slump follows. (b) Arch lab "Use this world's coast": seed waveRate from the Coast panel wave power and
rock strength from the lithology (chalk/limestone/clay cliffDeg + erodibility) — chalk forms arches, clay just retreats.
(c) Classroom scenarios list (guided presets with a one-line question each), e.g. Old Harry Rocks, Durdle Door.
Read only: spec E6 (`sed -n 431,446p docs/MASTER_SPEC.md`), src/local/{slump,arch}/model.ts, src/app/{SlumpLab,ArchLab,CoastPanel}.tsx.
Acceptance: test that toe removal lowers FoS and enables a repeat failure; weak rock in arch lab never forms an arch
(retreats instead) while chalk does; every scenario button changes model state.
Do not touch: global solvers.
Done when: tests/typecheck/build/e2e pass, committed + pushed.
Backlog after: M05-C04b one-line shoreline model (bars/lagoons/recurves), then M06 (spec E7 climate).
