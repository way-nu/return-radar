# Backend — rules for agents

Read when: API, rules, seed, Sarvam or Flagsmith code. Skip when: screens only.

FastAPI · Python 3.12 · uv · async SQLAlchemy 2 (SQLite locally, Postgres/Supabase in the cluster) · sarvamai ·
flagsmith.

## Commands

- `uv sync` · `uv run python -m scripts.seed --reset` · `uv run uvicorn app.main:app --reload --port 8000`
- `uv run pytest -q` · `uv run ruff check .`

## Files (small on purpose; keep it that way)

| File               | What                                                                                                              |
|--------------------|-------------------------------------------------------------------------------------------------------------------|
| `app/rules.py`     | R1–R5 + clean history. Pure functions. Every reason string has its numbers. Fully tested in `tests/test_rules.py` |
| `app/scoring.py`   | Builds `RuleInput` from SQL, scores a claim with thresholds from Flagsmith                                        |
| `app/db.py`        | Models: customers, orders (with mocked delivery proof), claims. `create_all` on startup, no migrations            |
| `app/sarvam.py`    | translate, speak (TTS), transcribe (STT), extract (LLM → JSON). Fake when no key                                  |
| `app/flags.py`     | Flagsmith with defaults; never raises                                                                             |
| `app/main.py`      | All routes (see `docs/api.md`), plus the planted memory bug in `/api/admin/import`                                |
| `scripts/seed.py`  | Synthetic brand with 4 planted patterns; demo claim ids `demo-ravi`, `demo-ananya`, `demo-meera`, `demo-linked`   |
| `scripts/storm.py` | Bulk import that triggers the OOM incident                                                                        |

## Rules

- Works with zero keys (fakes + defaults). Real keys only change behaviour, never break it.
- Sarvam model ids are env vars (`SARVAM_*_MODEL`); confirm current ids at docs.sarvam.ai on the day.
- Strip `;codecs=...` from audio content types (done in `transcribe`). Pass the TTS speaker explicitly.
- New rule? Add it to `rules.py` with a fires / not-fires / boundary test and an exact reason assertion.
- Don't fix the planted bug in `bulk_import` until the incident is recorded.
- Next steps only if asked: SSE, auth, multi-brand, reports.
