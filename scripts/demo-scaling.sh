#!/usr/bin/env bash
# Live demo: scale the API and watch requests being spread across replicas.
# Usage: scripts/demo-scaling.sh [replicas]   (default 5)
# Needs the web service reachable on $BASE (default: port-forward on :8080).
set -euo pipefail
REPLICAS="${1:-5}"
BASE="${BASE:-http://localhost:8080}"

kubectl -n gridlock port-forward svc/web 8080:80 >/dev/null 2>&1 &
PF=$!
trap 'kill $PF 2>/dev/null || true' EXIT
sleep 2

echo ">> Scaling api to $REPLICAS replicas"
kubectl -n gridlock scale deployment/api --replicas="$REPLICAS"
kubectl -n gridlock rollout status deployment/api --timeout=120s
kubectl -n gridlock get pods -l app=api -o wide

echo ">> 20 requests to /api/health — 'instance' is the pod that answered"
for _ in $(seq 1 20); do curl -s "$BASE/api/health" | sed -E 's/.*"instance":"([^"]+)".*/\1/'; done | sort | uniq -c
