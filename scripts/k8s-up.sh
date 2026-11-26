#!/usr/bin/env bash
# Deploy Gridlock on a local Minikube cluster, from scratch.
set -euo pipefail
cd "$(dirname "$0")/.."

command -v minikube >/dev/null || { echo "minikube not found"; exit 1; }
command -v kubectl  >/dev/null || { echo "kubectl not found";  exit 1; }

minikube status >/dev/null 2>&1 || minikube start --cpus=2 --memory=3850
minikube addons enable ingress
minikube addons enable metrics-server

echo ">> Building images using Docker Desktop"

docker build -t gridlock-api:1.0.0 ./server
docker build -t gridlock-web:1.0.0 ./frontend

echo ">> Loading images into Minikube"

minikube image load gridlock-api:1.0.0
minikube image load gridlock-web:1.0.0

echo ">> Applying manifests"
kubectl apply -k k8s

# Secret values injected through envFrom are fixed when a pod starts. Recreate
# the API pods after applying the Secret so password/JWT changes take effect
# consistently on every replica.
kubectl -n gridlock rollout restart deployment/api

# The Minikube addon defaults to a 60 s scrape interval, which makes the HPA
# look unresponsive during a short load test. Refresh metrics every 15 s.
kubectl -n kube-system patch deployment metrics-server --type=json \
  -p='[{"op":"replace","path":"/spec/template/spec/containers/0/args/4","value":"--metric-resolution=15s"}]'
kubectl -n kube-system rollout status deployment/metrics-server --timeout=120s

echo ">> Waiting for rollouts"
kubectl -n gridlock rollout status statefulset/db --timeout=180s
kubectl -n gridlock rollout status deployment/redis --timeout=120s
kubectl -n gridlock rollout status deployment/api --timeout=180s
kubectl -n gridlock rollout status deployment/web --timeout=120s

echo ">> Waiting for fresh API resource metrics"
for _ in $(seq 1 30); do
  if kubectl -n gridlock top pods -l app=api >/dev/null 2>&1; then break; fi
  sleep 2
done

kubectl -n gridlock get pods,svc,pvc,ingress,hpa
echo
echo "Open: http://$(minikube ip)/   (Docker driver on macOS/Windows: run 'minikube tunnel' and use http://127.0.0.1/"
echo "      or:  kubectl -n gridlock port-forward svc/web 8080:80  ->  http://localhost:8080)"
