# Setup (about 15 minutes)

## 0. Repo

```bash
git clone https://github.com/way-nu/return-radar.git && cd return-radar
# unzip the starter pack into this folder, then:
git add -A && git commit -m "Starter pack" && git push
```

## 1. Backend (works offline: SQLite + fake Sarvam + default flags)

```bash
cd backend && cp .env.example .env
uv sync && uv run pytest -q          # 8 rule tests pass
uv run python -m scripts.seed --reset
uv run uvicorn app.main:app --reload --port 8000
curl -s localhost:8000/api/claims | head -c 400
```

## 2. Frontend

```bash
cd frontend && npm install && npm run dev   # http://localhost:3000, /api proxied to :8000
npx shadcn@latest init -d && npx shadcn@latest add button card badge table input textarea dialog sonner skeleton tabs
```

## 3. Real keys (fill backend/.env, restart)

- `SARVAM_API_KEY` from dashboard.sarvam.ai; confirm model ids at docs.sarvam.ai/api/getting-started/models.
- `FLAGSMITH_SERVER_KEY` (server-side environment key). Create flags first: `risk_thresholds` (JSON),
  `rules_enabled` (JSON), `fact_finding_mode` (`voice`), `question_style` (multivariate: `voice_note`, `text_form`).

## 4. Agents (2 sessions, plus 1 optional)

```bash
git worktree add ../return-radar-be -b be && git worktree add ../return-radar-fe -b fe
```

- BE (`../return-radar-be`): "Read CLAUDE.md and backend/CLAUDE.md. Wire real Sarvam and Flagsmith behind the existing
  fakes,
  then do infra/CLAUDE.md steps 1–3. Keep tests green."
- FE (`../return-radar-fe`): "Read CLAUDE.md and frontend/CLAUDE.md. Build /console, /console/claims/[id], /c/[id],
  /store from
  design/ against the running API."
- Merge `be` and `fe` into `main` yourself every 45 minutes.

## 5. Cluster + NudgeBee + tunnel

Follow `infra/CLAUDE.md`. Docker Desktop memory 10–12 GB.
