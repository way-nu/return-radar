# Incident: post-Diwali bulk import OOMKills the API

**When:** 2026-11-25 15:43:42 IST (10:13:42 UTC)
**Where:** kind cluster `return-radar`, namespace `return-radar`, pod `return-radar-api-76799694f7-kcwwd`
**Trigger:** `uv run python scripts/storm.py --api http://localhost:30080 --n 400`, one `POST /api/admin/import` with 400 order IDs
**Impact:** the API process was killed mid-request (client: "Server disconnected without sending a response"); the pod
restarted (restart count 0 → 1) and was unready until it came back, about 20 s later.
**Status:** root cause known; fix proposed below and **not applied**. The stopgap is approved live in NudgeBee.

## Evidence

`kubectl -n return-radar describe pod return-radar-api-76799694f7-kcwwd`:

```
    State:          Running
      Started:      Wed, 25 Nov 2026 15:43:42 +0530
    Last State:     Terminated
      Reason:       OOMKilled
      Exit Code:    137
      Started:      Wed, 25 Nov 2026 15:29:02 +0530
      Finished:     Wed, 25 Nov 2026 15:43:42 +0530
    Ready:          False
    Restart Count:  1
    Limits:
      memory:  128Mi
    Requests:
      cpu:      100m
      memory:   64Mi
```

`lastState.terminated`: `{"exitCode": 137, "reason": "OOMKilled", "finishedAt": "2026-11-25T10:13:42Z"}`

Kernel log on the kind node (`docker exec return-radar-control-plane dmesg`):

```
Memory cgroup out of memory: Killed process 44302 (uvicorn) total-vm:472996kB, anon-rss:126380kB, file-rss:23232kB, shmem-rss:0kB, UID:0 pgtables:416kB oom_score_adj:992
```

`kubectl -n return-radar get events --sort-by=.lastTimestamp | tail -20` (incident lines at the bottom; earlier lines are
the previous rollout):

```
20m   Normal    Started             pod/return-radar-api-66557566c6-4ldt2    Container started
20m   Warning   Unhealthy           pod/return-radar-api-66557566c6-4ldt2    Readiness probe failed: Get "http://10.244.0.40:8000/api/readyz": dial tcp 10.244.0.40:8000: connect: connection refused
20m   Warning   Unhealthy           pod/return-radar-api-66557566c6-4ldt2    Liveness probe failed: Get "http://10.244.0.40:8000/api/healthz": dial tcp 10.244.0.40:8000: connect: connection refused
20m   Normal    ScalingReplicaSet   deployment/return-radar-api              Scaled down replica set return-radar-api-6c8fd798b8 from 1 to 0
20m   Normal    SuccessfulDelete    replicaset/return-radar-api-6c8fd798b8   Deleted pod: return-radar-api-6c8fd798b8-tqx8k
20m   Normal    Killing             pod/return-radar-api-6c8fd798b8-tqx8k    Stopping container api
17m   Warning   Unhealthy           pod/return-radar-api-66557566c6-4ldt2    Readiness probe failed: Get "http://10.244.0.40:8000/api/readyz": context deadline exceeded (Client.Timeout exceeded while awaiting headers)
14m   Normal    Scheduled           pod/return-radar-api-76799694f7-kcwwd    Successfully assigned return-radar/return-radar-api-76799694f7-kcwwd to return-radar-control-plane
14m   Normal    SuccessfulCreate    replicaset/return-radar-api-76799694f7   Created pod: return-radar-api-76799694f7-kcwwd
14m   Normal    ScalingReplicaSet   deployment/return-radar-api              Scaled up replica set return-radar-api-76799694f7 from 0 to 1
14m   Normal    Killing             pod/return-radar-api-66557566c6-4ldt2    Stopping container api
14m   Normal    SuccessfulDelete    replicaset/return-radar-api-66557566c6   Deleted pod: return-radar-api-66557566c6-4ldt2
14m   Normal    ScalingReplicaSet   deployment/return-radar-api              Scaled down replica set return-radar-api-66557566c6 from 1 to 0
2m6s  Warning   Unhealthy           pod/return-radar-api-76799694f7-kcwwd    Readiness probe failed: Get "http://10.244.0.41:8000/api/readyz": context deadline exceeded (Client.Timeout exceeded while awaiting headers)
12s   Warning   Unhealthy           pod/return-radar-api-76799694f7-kcwwd    Readiness probe failed: Get "http://10.244.0.41:8000/api/readyz": EOF
12s   Normal    Started             pod/return-radar-api-76799694f7-kcwwd    Container started
12s   Normal    Created             pod/return-radar-api-76799694f7-kcwwd    Container created
12s   Normal    Pulled              pod/return-radar-api-76799694f7-kcwwd    Container image "return-radar-api:dev" already present on machine and can be accessed by the pod
2s    Warning   Unhealthy           pod/return-radar-api-76799694f7-kcwwd    Liveness probe failed: Get "http://10.244.0.41:8000/api/healthz": dial tcp 10.244.0.41:8000: connect: connection refused
1s    Warning   Unhealthy           pod/return-radar-api-76799694f7-kcwwd    Readiness probe failed: Get "http://10.244.0.41:8000/api/readyz": dial tcp 10.244.0.41:8000: connect: connection refused
```

## Root cause

`backend/app/main.py:273`, in `POST /api/admin/import` (`bulk_import`, line 267):

```python
        bundles.append(bytearray(1_000_000))  # simulated courier photos + scan history per claim
```

The bulk import builds an in-memory "evidence bundle" of about 1 MB for **every** order ID before it writes a single
claim, and keeps all of them alive until the request ends. Memory therefore grows linearly with the batch size:
400 orders need about 400 MB on top of the roughly 60 MB baseline of the API process, against a container limit of
128Mi. The kernel's memory cgroup killed `uvicorn` at about 123 MiB resident (`anon-rss:126380kB`), giving exit code
137 and the `OOMKilled` reason. Nothing is written before the allocation loop, so the import is lost, and every other
request in flight on that pod fails with it. This is a deliberate, disclosed bug that stages the NudgeBee demo.

## Proposed fix (not applied)

1. **Stopgap, applied live through the NudgeBee runbook after approval:** raise the memory limit so a 400-order storm
   fits, and fall back to the typed form while it rolls out:
   `kubectl -n return-radar set resources deploy/return-radar-api --limits=memory=512Mi`
   (runbook: Flagsmith `fact_finding_mode=form` → approval → patch `limits.memory` 512Mi → rollout status →
   `fact_finding_mode=voice`).
2. **Real fix in code:** stream the import instead of allocating per claim. Process `order_ids` in batches of 50, build
   at most one evidence bundle at a time (or none, by referencing evidence instead of holding it in memory), score and
   `flush` each batch, then let it go. Peak memory then stays roughly flat regardless of batch size, and the limit can
   return to a tight value. Also cap `order_ids` per request (for example 1,000) with a 413 above it.
