.PHONY: compose-up compose-scale compose-down compose-reset k8s-up k8s-scale k8s-hpa-load k8s-url k8s-down k8s-reset test

# ---- Docker Compose --------------------------------------------------------
compose-up:                ## build + start the stack on http://localhost:8080
	@test -f .env || cp .env.example .env
	docker compose up -d --build
compose-scale:             ## 3 API replicas, then reload nginx so it sees them
	docker compose up -d --scale api=3 --no-recreate
	docker compose exec web nginx -s reload
compose-down:              ## stop, KEEP data volumes
	docker compose down
compose-reset:             ## stop and DELETE data volumes
	docker compose down -v

# ---- Kubernetes (Minikube) -------------------------------------------------
k8s-up:
	./scripts/k8s-up.sh
k8s-scale:                 ## make k8s-scale N=5
	./scripts/demo-scaling.sh $(or $(N),5)
k8s-hpa-load:
	./scripts/load-hpa.sh
k8s-url:
	@echo http://$$(minikube ip)/
k8s-down:                  ## remove the app, KEEP the PVCs
	kubectl delete -k k8s --ignore-not-found --wait=false || true
k8s-reset:                 ## remove everything including data
	kubectl delete namespace gridlock --ignore-not-found

# ---- Tests -----------------------------------------------------------------
test:                      ## backend tests (needs Postgres, see server/README.md)
	cd server && npm test
