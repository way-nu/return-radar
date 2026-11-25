# ReturnRadar

**See the risky returns and refund claims before you pay out.**

Built solo at WeMakeDevs Festive Hacks (Bengaluru, 25 Nov 2026) with Sarvam AI, Flagsmith and NudgeBee.

> Demo video: TODO · Live: TODO · Built with Claude Code (AI-assisted, disclosed).

## The problem

The Monday after Diwali, D2C fashion brands drown in returns and "it never arrived" claims. Grant Thornton Bharat
estimates 25–30% of apparel bought online may be returned this festive season. Support teams refund blind.

## What it does

1. A claim comes in (`POST /api/claims`).
2. Plain-code rules check it against orders, delivery proof and customer history; every flag states its numbers.
3. The customer answers one short voice question in their own language (Sarvam); the rules re-run.
4. An analyst approves or rejects in the console. No model decides a claim or states a number.

## Sponsors

- **Sarvam AI** (`backend/app/sarvam.py`). Hears, translates, speaks and extracts; never scores or states a number.
  - Sarvam Translate: the English question → the customer's language (e.g. `kn-IN`), cached per claim type + language.
  - Bulbul v3 (`bulbul:v3`): speaks the translated question as WAV (`GET /api/c/{id}/audio`).
  - Saaras v4 (`saaras:v4`): transcribes the customer's voice answer and detects its language.
  - Sarvam-105B (`sarvam-105b`): turns the transcript into JSON facts (`nobody_home`, `tag_on`, `condition`, a short
    quote). The rules re-run on those facts in plain code.
- **Flagsmith** (self-hosted, `backend/app/flags.py`). Four flags, evaluated per customer identity on every request:
  - `risk_thresholds` (JSON) and `rules_enabled` (JSON): change levels and switch rules live
    (`POST /api/claims/{id}/rescore` re-runs with the current values).
  - `fact_finding_mode`: kill switch; `form` swaps the customer page from voice to a typed form.
  - `question_style` (multivariate `voice_note` / `text_form`): experiment arm, stored on the claim when the customer
    first opens the link; `fact_finding_completed` is tracked when they answer. `/api/stats` shows exposed vs completed.
- **NudgeBee** (namespace `nudgebee` on the kind cluster). A post-Diwali bulk import (`POST /api/admin/import`)
  OOMKills the API pod (128Mi limit). NuBi finds the root cause from the cluster evidence; the "Return storm" runbook
  flips Flagsmith to form mode, waits for approval in Discord, patches the memory limit, then flips voice back.

## Run it

Locally it runs offline with no keys (SQLite + fake Sarvam + default flags); full steps in `SETUP.md`.

```bash
cd backend && cp .env.example .env && uv sync && uv run pytest -q
uv run python -m scripts.seed --reset && uv run uvicorn app.main:app --port 8000
cd ../frontend && npm install && npm run dev      # http://localhost:3000 (/console, /store); /api proxied to :8000
```

Real services: set `SARVAM_API_KEY`, `DATABASE_URL` (Supabase session pooler, `postgresql+asyncpg://…:5432/postgres`),
and for self-hosted Flagsmith `FLAGSMITH_SERVER_KEY`, `FLAGSMITH_API_URL=http://localhost:8100/api/v1/` and
`FLAGSMITH_EVENTS_URL=http://localhost:8100/api/` (without it, experiment events go to Flagsmith Cloud and are refused).
Cluster: `backend/.env.cluster` (Flagsmith at `host.docker.internal:8100`), then `bash infra/deploy.sh` → API on
`localhost:30080`; see `infra/CLAUDE.md`.

## Honest limits

- Seed data is synthetic. Delivery proof and customer history are mocked courier and store data.
- `/api/admin/import` holds a deliberate memory bug to stage the incident.
- The cluster is a throwaway kind cluster; NudgeBee's runner can patch deployments in `return-radar` so the runbook can
  raise the memory limit.
- If a Sarvam call fails, the question falls back to English text and the audio to "unavailable"; the form always works.
- Local demo uses SQLite for latency; the Kubernetes deployment uses Supabase Postgres.
- Experiment readout (voice_note vs text_form completion) comes from /api/stats; question_style assignment is done by
  Flagsmith multivariate per customer ID. Event export to self-hosted Flagsmith is best-effort.
- One brand, no auth. Next steps: loss reports, photo evidence, multi-brand, marketplace integrations.
