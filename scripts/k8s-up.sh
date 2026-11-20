#!/usr/bin/env bash
# Deploy Gridlock on a local Minikube cluster, from scratch.
set -euo pipefail
cd "$(dirname "$0")/.."

command -v minikube >/dev/null || { echo "minikube not found"; exit 1; }
command -v kubectl  >/dev/null || { echo "kubectl not found";  exit 1; }

minikube status >/dev/null 2>&1 || minikube start --cpus=2 --memory=4096
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

echo ">> Waiting for rollouts"
kubectl -n gridlock rollout status statefulset/db --timeout=180s
kubectl -n gridlock rollout status deployment/redis --timeout=120s
kubectl -n gridlock rollout status deployment/api --timeout=180s
kubectl -n gridlock rollout status deployment/web --timeout=120s

kubectl -n gridlock get pods,svc,pvc,ingress,hpa
echo
echo "Open: http://$(minikube ip)/   (Docker driver on macOS/Windows: run 'minikube tunnel' and use http://127.0.0.1/"
echo "      or:  kubectl -n gridlock port-forward svc/web 8080:80  ->  http://localhost:8080)"
