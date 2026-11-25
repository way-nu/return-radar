# Self-hosted Flagsmith (local)

```bash
cd infra/flagsmith && docker compose up -d     # first start takes ~1 min (migrations)
open http://localhost:8100                      # create the admin account, a project "return-radar"
```

Create these flags in the Development environment (all Enabled):

| Name                | Value                                                             |
|---------------------|-------------------------------------------------------------------|
| `risk_thresholds`   | `{"medium":30,"high":60}`                                         |
| `rules_enabled`     | `["R1","R2","R3","R4","R5"]`                                      |
| `fact_finding_mode` | `voice`                                                           |
| `question_style`    | control `voice_note`, variation `text_form` at 50% (multivariate) |

Environment settings → Keys → copy the **server-side** key into `backend/.env`:

```
FLAGSMITH_SERVER_KEY=ser.xxxx
FLAGSMITH_API_URL=http://localhost:8100/api/v1/
```

In the kind cluster use `FLAGSMITH_API_URL=http://host.docker.internal:8100/api/v1/` in `backend/.env.cluster`.
Stop: `docker compose down` (add `-v` to wipe data).
