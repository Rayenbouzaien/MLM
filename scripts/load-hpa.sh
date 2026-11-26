#!/usr/bin/env bash
# Generate CPU load on the API from inside the cluster to trigger the HPA(horizontal pod autoscaller).
# Watch in another terminal:  kubectl -n gridlock get hpa api -w
set -euo pipefail
kubectl -n gridlock delete pod loadgen --ignore-not-found --wait=true
kubectl -n gridlock run loadgen --rm -it --restart=Never --image=busybox:1.36 -- \
  sh -c 'while true; do wget -q -O /dev/null http://api:4000/api/stats; done'
