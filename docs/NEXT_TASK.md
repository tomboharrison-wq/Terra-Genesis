# One next executable task
M14 hydrology trust is implemented: bounded float32 drift reconciliation, explicit GPU→CPU flushes before
save/export, persistent groundwater storage with recharge, conservative lateral Darcy exchange and baseflow,
CPU fallback while the aquifer is enabled, groundwater overlay, and TGW format v12 migration.

Release gate complete: typecheck, 283 unit tests, production build, and GitHub Pages deployment passed. The
local GPU/e2e scripts remain environment-blocked by the absent Chromium binary; the prior baseline was green.
