"""Post-Diwali claim storm for the NudgeBee incident.
Run: uv run python -m scripts.storm --api http://localhost:30080 --n 400
Sends one bulk import of N claims; with the 128Mi limit the pod is OOMKilled (planted bug, see app/main.py)."""

import argparse

import httpx

p = argparse.ArgumentParser()
p.add_argument("--api", default="http://localhost:30080")
p.add_argument("--n", type=int, default=400)
a = p.parse_args()
ids = [f"O-{50001 + (i % 300)}" for i in range(a.n)]
try:
    r = httpx.post(f"{a.api}/api/admin/import", json={"order_ids": ids}, timeout=120)
    print(r.status_code, r.text[:200])
except httpx.HTTPError as e:
    print("request failed (expected during the incident):", e)
