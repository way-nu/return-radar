# Infra — rules for agents

Read when: cluster, deploy, tunnel, the incident, NudgeBee. Skip when: app code only.

## Run it

1. `backend/.env.cluster`: same keys as `.env.example`, but `DATABASE_URL` = Supabase session pooler (port 5432).
   No Supabase? Use `sqlite+aiosqlite:////tmp/return-radar.db` and re-seed after every pod restart (data is lost on
   restart).
2. `bash infra/deploy.sh` → API on `localhost:30080`.
3. Seed inside the cluster: `kubectl -n return-radar exec deploy/return-radar-api -- python -m scripts.seed --reset`.
4. Frontend against the cluster: `API_ORIGIN=http://localhost:30080 npm run dev` in `frontend/`.
5. Public HTTPS for phones: `cloudflared tunnel --url http://localhost:3000` (one tunnel: Next proxies /api).

## NudgeBee

- NudgeBee → Integrations → Kubernetes → non-production cluster → install with
  `bash installation.sh -a <agent-key> -d true` (eBPF off on kind). Enable `runner.enableWritePermissions`
  (throwaway cluster; say so in the README) if you want the runbook to patch.
- Discord notification channel for approvals.

## The incident (record by T+3:15)

1. `cd backend && uv run python -m scripts.storm --api http://localhost:30080 --n 400` → pod OOMKilled (exit 137).
2. Ask NuBi: "In namespace return-radar, return-radar-api restarts after POST /api/admin/import and the console shows
   errors. What is the root cause? Show the evidence."
3. Runbook "Return storm" (Workflow Builder): HTTP → Flagsmith `fact_finding_mode=form` → Approval (Discord) →
   Kubernetes patch `limits.memory` 512Mi → rollout status → HTTP → `fact_finding_mode=voice`.
4. If the Kubernetes write is refused: approve, then `kubectl -n return-radar set resources deploy/return-radar-api
   --limits=memory=512Mi` on camera.
