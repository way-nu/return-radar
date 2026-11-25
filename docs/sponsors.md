# Sponsors: exactly what each does

Read when: touching a sponsor integration or recording the demo.

## Sarvam AI — the voice

- Question: English text per claim type → `text.translate` to the customer's language → Bulbul TTS (cached per
  language).
- Answer: `speech_to_text.transcribe` (Saaras, language auto-detected) → chat model extracts JSON
  `{received_by, nobody_home, tag_on, condition, quote}` → rules re-run (R4, R5 use it).
- Never sees scores; never writes numbers. Show language + transcript + extracted fields in the console.
- Traps: strip `;codecs=opus`; pass a valid speaker; confirm model ids at docs.sarvam.ai.

## Flagsmith — the controls

| Flag                | Type                      | Default                      | Demo moment                                                          |
|---------------------|---------------------------|------------------------------|----------------------------------------------------------------------|
| `risk_thresholds`   | remote config JSON        | `{"medium":30,"high":60}`    | Set high to 90 → Ravi's claim drops to Medium within 3 s             |
| `rules_enabled`     | remote config JSON        | `["R1","R2","R3","R4","R5"]` | Turn a rule off live                                                 |
| `fact_finding_mode` | remote config string      | `voice`                      | Kill switch: `form` swaps the customer page to a typed form          |
| `question_style`    | multivariate (experiment) | `voice_note` / `text_form`   | Experiment: which gets more answers (`fact_finding_completed` event) |

Create flags BEFORE coding against them; make `question_style` multivariate from the start; identifier = customer id.
Report the experiment honestly (traffic is people on the floor; read the interval).

## NudgeBee — the night it can't go down

Post-Diwali import → pod OOMKilled → NuBi root cause with evidence (exit 137, 128Mi, working set) → runbook flips
Flagsmith to form mode (automatic, reversible) → approval in Discord → patch to 512Mi → voice back.
The point: reads are automatic, the reversible degrade is automatic, the infra change waits for a human.
