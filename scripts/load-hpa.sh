#!/usr/bin/env bash
# Generate parallel API traffic from inside the cluster to exercise the HPA.
# Override WORKERS and DURATION_SECONDS for a different load window.
set -euo pipefail
WORKERS="${WORKERS:-8}"
DURATION_SECONDS="${DURATION_SECONDS:-180}"
WATCH_PID=""

cleanup() {
  if [[ -n "$WATCH_PID" ]]; then
    kill "$WATCH_PID" 2>/dev/null || true
    wait "$WATCH_PID" 2>/dev/null || true
  fi
  kubectl -n gridlock delete pod loadgen --ignore-not-found --wait=false >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

kubectl -n gridlock delete pod loadgen --ignore-not-found --wait=true
kubectl -n gridlock run loadgen \
  --restart=Never \
  --image=busybox:1.36 \
  --labels=run=loadgen \
  --env="WORKERS=$WORKERS" \
  --override-type=strategic \
  --overrides='{"apiVersion":"v1","spec":{"containers":[{"name":"loadgen","resources":{"requests":{"cpu":"50m","memory":"16Mi"},"limits":{"cpu":"250m","memory":"64Mi"}}}]}}' \
  --command -- sh -c \
  'for worker in $(seq 1 "$WORKERS"); do (while true; do wget -q -O /dev/null http://api:4000/api/stats || true; done) & done; wait'
kubectl -n gridlock wait --for=condition=Ready pod/loadgen --timeout=60s

echo ">> Sending $WORKERS concurrent API workers for ${DURATION_SECONDS}s"
kubectl -n gridlock get hpa api --watch &
WATCH_PID=$!
sleep "$DURATION_SECONDS"
kill "$WATCH_PID" 2>/dev/null || true
wait "$WATCH_PID" 2>/dev/null || true
WATCH_PID=""

echo ">> HPA and API replica state during/after load"
kubectl -n gridlock get hpa api
kubectl -n gridlock get pods -l app=api -o wide
