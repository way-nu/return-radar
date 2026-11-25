# ReturnRadar — start here (agent router)

Read this file, then ONLY the file the router names for your task.

## What this is

ReturnRadar checks D2C return and "not delivered" claims before a refund. A claim comes in, plain-code rules score it
with reasons that carry exact numbers, the customer answers one voice question in their language (Sarvam), rules
re-run, and an analyst approves or rejects in a console. One brand ("Utsav Ethnic"), synthetic seed data.

- `backend/` FastAPI (runs locally on :8000 with SQLite + fakes, in kind on :30080 with Supabase)
- `frontend/` Next.js: `/console`, `/console/claims/[id]`, `/c/[id]` (customer), `/store` (demo store).
  Next proxies `/api/*` to the backend, so the browser only ever calls same-origin `/api/...`.
- `infra/` kind + manifest + deploy script. NudgeBee watches the cluster.

## Rules for every task

1. Stay in your lane: BE session edits `backend/ infra/`; FE session edits `frontend/`. Need more? Tell the owner.
2. `docs/api.md` is the contract. Changing it needs the owner's yes.
3. AI proposes, code decides, a person confirms. Sarvam hears, translates, speaks, extracts. It never scores,
   decides, or states a number. Every number on screen comes from the API.
4. Every risk flag is shown as its reason sentence with points. Never show a bare score.
5. Bare minimum first. Do not add features outside `docs/scope.md` without asking.
6. Done = green: BE `uv run pytest -q`; FE `npx tsc --noEmit && npm run build`. Say what you couldn't verify.

## Router

| Task                                            | Read                                 |
|-------------------------------------------------|--------------------------------------|
| API, rules, seed, Sarvam/Flagsmith code         | `backend/CLAUDE.md`                  |
| Any screen                                      | `frontend/CLAUDE.md`, then `design/` |
| Cluster, deploy, tunnel, the incident, NudgeBee | `infra/CLAUDE.md`                    |
| What's in and out                               | `docs/scope.md`                      |
| Endpoints and shapes                            | `docs/api.md`                        |
| Sponsor specifics                               | `docs/sponsors.md`                   |
