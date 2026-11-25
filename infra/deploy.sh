#!/usr/bin/env bash
# Build the API image, load it into kind and roll it out. Run from the repo root.
set -euo pipefail
kind get clusters | grep -q '^return-radar$' || kind create cluster --config infra/kind.yaml
docker build -t return-radar-api:dev backend
kind load docker-image return-radar-api:dev --name return-radar
kubectl apply -f infra/k8s/app.yaml
# secret from backend/.env.cluster (DATABASE_URL must be Supabase, not SQLite)
kubectl -n return-radar create secret generic return-radar-env --from-env-file=backend/.env.cluster \
  --dry-run=client -o yaml | kubectl apply -f -
kubectl -n return-radar rollout restart deploy/return-radar-api
kubectl -n return-radar rollout status deploy/return-radar-api --timeout=120s
curl -s localhost:30080/api/healthz && echo " API up on :30080"
