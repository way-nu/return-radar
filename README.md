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

- **Sarvam AI**: the question is translated and spoken in the customer's language; the spoken answer is transcribed and
  turned into facts.
- **Flagsmith**: risk thresholds and rule toggles per brand, a voice kill switch, and a voice-vs-form experiment.
- **NudgeBee**: a post-Diwali bulk import crashes the API; NudgeBee finds the cause; the runbook falls back to the form
  and waits for approval before the fix.

## Run it

See `SETUP.md`. Runs offline with no keys (SQLite + fakes).

## Honest limits

- Seed data is synthetic. Delivery proof and customer history are mocked courier and store data.
- `/api/admin/import` holds a deliberate memory bug to stage the incident.
- One brand, no auth. Next steps: loss reports, photo evidence, multi-brand, marketplace integrations.
