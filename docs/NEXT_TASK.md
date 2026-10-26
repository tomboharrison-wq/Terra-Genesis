# One next executable task
All planned milestones (M01–M11) are complete. Work from here is optional improvement, from docs/BACKLOG.md.
Suggested next: M04-C06 — first heavy rain on a freshly generated world makes weak scarps fail en masse (worlds are
settled to DRY stability). Option chosen if no other instruction: settle generation to the WET limit for loose
sediment only (rock stays dry-settled), so the first storm does not trigger a one-off collapse; measure the plateau
challenge again (target was set from the dry-settled behaviour: 100 M m³ in 10 days) and adjust with a stated reason.
Read only: src/terrain/settle.ts, src/sim/sediment (WET_* constants), tests/settle.test.ts, challenges.ts (plateau).
Acceptance: plateau world, 40 mm/h rain for 1 h removes < 10 % of what it does now; settle tests updated;
plateau challenge still passable within its time limit (measured).
Done when: tests/typecheck/build/e2e pass, committed + pushed.
