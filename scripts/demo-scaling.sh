#!/usr/bin/env bash
# Live demo: scale the API and watch requests being spread across replicas.
# Usage: scripts/demo-scaling.sh [replicas]   (default 5)
# Uses $BASE when reachable (default: port-forward on :8080). If the host
# cannot reach that address, sends the sample requests from a web pod instead.
set -euo pipefail
REPLICAS="${1:-5}"
BASE="${BASE:-http://localhost:8080}"

echo ">> Scaling api to $REPLICAS replicas"
kubectl -n gridlock scale deployment/api --replicas="$REPLICAS"
kubectl -n gridlock rollout status deployment/api --timeout=120s
kubectl -n gridlock get pods -l app=api -o wide

echo ">> 20 requests to /api/health — 'instance' is the pod that answered"
if curl -fsS "$BASE/api/health" >/dev/null 2>&1; then
  for _ in $(seq 1 20); do
    curl -fsS "$BASE/api/health" | sed -nE 's/.*"instance":"([^"]+)".*/\1/p'
  done | sort | uniq -c
else
  WEB_POD="$(kubectl -n gridlock get pods -l app=web -o jsonpath='{.items[0].metadata.name}')"
  kubectl -n gridlock exec "$WEB_POD" -- sh -c \
    'i=0; while [ "$i" -lt 20 ]; do wget -q -O - http://127.0.0.1:8080/api/health; i=$((i + 1)); done' \
    | sed -nE 's/.*"instance":"([^"]+)".*/\1/p' | sort | uniq -c
fi
