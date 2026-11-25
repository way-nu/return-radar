# API (the contract)

All under `/api`. Errors: `{"error": "<code>", "detail": "..."}`. Money: integer paise. Types:
`frontend/src/lib/api.ts`.

| Method | Path                              | Body                                                   | Returns                                                                         | Errors                                 |
|--------|-----------------------------------|--------------------------------------------------------|---------------------------------------------------------------------------------|----------------------------------------|
| GET    | `/healthz`, `/readyz`             | —                                                      | `{ok}`                                                                          | —                                      |
| GET    | `/config?identifier=`             | —                                                      | Config (thresholds, rules_enabled, fact_finding_mode, question_style)           | never                                  |
| GET    | `/demo/orders?customer_id=C-1042` | —                                                      | customer + last 5 orders                                                        | 404 `not_found`                        |
| POST   | `/claims`                         | `{order_id, type: return\|not_delivered, reason_text}` | 201 `{claim, customer_link}` (claim already scored)                             | 422 `invalid_claim`                    |
| GET    | `/claims?level=&status=`          | —                                                      | `{items: Claim[]}` sorted by score, with item_name, value_paise                 | —                                      |
| GET    | `/claims/{id}`                    | —                                                      | `{claim, order, customer, brand_return_rate}`                                   | 404                                    |
| POST   | `/claims/{id}/decision`           | `{action: approve\|reject, reason ≥ 5 chars}`          | Claim                                                                           | 409 `already_decided`, 422             |
| GET    | `/c/{id}`                         | —                                                      | CustomerView (question in customer's language, audio_url, mode, question_style) | 404                                    |
| GET    | `/c/{id}/audio`                   | —                                                      | audio/wav of the question                                                       | 503 when TTS is unavailable            |
| POST   | `/c/{id}/answer`                  | multipart `audio` (≤ 2 MB)                             | `{ok}`; re-scores the claim                                                     | 413 `audio_too_long`, 502 `stt_failed` |
| POST   | `/c/{id}/form`                    | `{nobody_home, tag_on, condition, received_by}`        | `{ok}`; re-scores                                                               | 422                                    |
| POST   | `/admin/import`                   | `{order_ids: []}`                                      | `{created}` — planted memory bug for the incident                               | —                                      |
