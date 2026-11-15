# What the analysis lane still needs (updated 2026-11-15, after D11 and D12)

Everything the analysis lane asked for earlier is answered or done: GPS for 13 stations and the final σ
(Daniel), stack v3 and the control-box and trend-gap answers (Pratheek, D11), contracts v1.2 and the
canal in the app (Ryan, D10), H-8 and H-20 (Daniel, Pratheek). Calm demo station: P298.

Optional, only if the team wants them before submission:

- **Steven / Ryan:** the vertical cross-check in the app (contracts v1.2 section 6). I run
  `python -m analysis.run --component up --var up_disp_m --out frontend/public/data/vertical` on the
  two-track stack from the Drive. Cross-check only (D7, D9); Hanford has no descending coverage.
- **Daniel:** a working source for the Delta-Mendota Canal gives a second canal profile.
- **Ryan:** a well screening layer (wells in cells sinking beyond 2σ, "where to look closer", never
  "at risk of failure") is possible from Daniel's H-8 wells, but it is new scope and needs a decision.
