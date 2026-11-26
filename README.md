# Gridlock — plateforme hackathon, conteneurisée (Docker Compose & Kubernetes)

Application micro-services : **front React (nginx)**, **API Express**, **PostgreSQL**
(données) et **Redis** (bus d'événements temps réel partagé entre réplicas).
Projet Cloud — *Proposition 2 : Conteneurisation et orchestration locale vs Cloud*.
Le rapport technique est dans [`RAPPORT.md`](RAPPORT.md).

```
                    ┌────────────── réseau "frontend" ──────────────┐   ┌──── réseau "backend" ────┐
 navigateur ──► web (nginx :8080) ──/api──► api (Express :4000) ×N ─┼──► db    (PostgreSQL + volume)
                 │ fichiers statiques SPA                            └──► redis (pub/sub SSE + AOF)
```

| Service | Image | Rôle | Persistance |
|---|---|---|---|
| `web` | `nginx-unprivileged` (build multi-stage) | sert la SPA, reverse-proxy `/api` (SSE compris) | — |
| `api` | `node:20-alpine` (multi-stage, non-root) | API sans état, **scalable** | — |
| `db` | `postgres:16-alpine` | données métier | volume `pg_data` / PVC 1 Gi |
| `redis` | `redis:7-alpine` | flux live partagé entre réplicas | volume `redis_data` / PVC |

## Partie 1 — Docker Compose

```bash
cp .env.example .env              # adapter les secrets
docker compose up -d --build      # ou : make compose-up
```
- Application : http://localhost:8080 — Admin : http://localhost:8080/admin (`ADMIN_PASSWORD`)
- Santé de l'API : http://localhost:8080/api/health (champ `instance` = conteneur qui répond)
- Explorateur BD (optionnel) : `docker compose --profile tools up -d adminer` → http://localhost:8081 (serveur `db`, user `postgres`)

**Scalabilité locale**
```bash
docker compose up -d --scale api=3 --no-recreate
docker compose exec web nginx -s reload     # nginx relit les IP des réplicas
for i in $(seq 10); do curl -s localhost:8080/api/health; echo; done   # "instance" varie
```

**Persistance** : `docker compose down` conserve les données (volumes nommés) ;
`docker compose down -v` les supprime.

## Partie 2 — Kubernetes (Minikube)

Prérequis : Docker, `kubectl`, `minikube` (≥ 2 CPU, 4 Go RAM).
```bash
make k8s-up          # = scripts/k8s-up.sh : addons, build des images dans Minikube, kubectl apply -k k8s
```
Accès : `http://$(minikube ip)/` — ou, quel que soit le driver :
`kubectl -n gridlock port-forward svc/web 8080:80` → http://localhost:8080

| Fichier `k8s/` | Objets |
|---|---|
| `00-namespace.yaml` | Namespace `gridlock` |
| `01-config.yaml` | ConfigMap (réglages) + Secret (valeurs de **dev**) |
| `10-postgres.yaml` | StatefulSet + Service headless + `volumeClaimTemplates` (PVC 1 Gi) |
| `20-redis.yaml` | Deployment + PVC + Service |
| `30-api.yaml` | Deployment (2 réplicas, probes startup/readiness/liveness, securityContext) + Service |
| `40-web.yaml` | Deployment (2 réplicas) + Service |
| `50-ingress.yaml` | Ingress nginx (timeouts longs pour SSE) |
| `60-hpa.yaml` | HorizontalPodAutoscaler de l'API (2→6, CPU 50 %) |
| `70-networkpolicy.yaml` | deny-all + `ingress→web→api→{db,redis}` |

**Test de scalabilité**
```bash
make k8s-scale N=5                 # kubectl scale + 20 requêtes : répartition par pod
kubectl -n gridlock scale deployment/api --replicas=1   # redimensionner à la main
make k8s-hpa-load                  # charge CPU → surveiller : kubectl -n gridlock get hpa api -w
```

**Test de persistance**
```bash
kubectl -n gridlock delete pod db-0          # le StatefulSet recrée le pod…
kubectl -n gridlock get pvc                   # …sur le même PVC : les équipes sont toujours là
```

**Nettoyage** : `make k8s-down` (garde les PVC) · `make k8s-reset` (supprime tout, données incluses).

> Passage à AWS EKS : mêmes manifestes ; pousser `gridlock-api`/`gridlock-web` sur ECR et adapter
> `image:`, la StorageClass (gp3/EBS CSI) et l'Ingress (AWS Load Balancer Controller, `COOKIE_SECURE=true` derrière HTTPS).

## Développement sans conteneurs

```bash
docker compose up -d db redis        # (publier 5432/6379 via un override si besoin)
cd server && cp .env.example .env && npm ci && npm start
cd frontend && VITE_API_URL=http://localhost:4000 pnpm dev      # http://localhost:8443
```

## Tests
- Backend : `cd server && npm test` (60 tests, nécessite PostgreSQL — voir `server/README.md`).
- Charge : `API_URL=http://localhost:8080 npm run test:load` (dans `server/`).

## Sécurité — à faire avant tout partage
- Les secrets de `.env.example` et `k8s/01-config.yaml` sont des **valeurs de développement**.
  Générer les vrais : `openssl rand -hex 32` ; ne jamais committer `.env`.
- Une ancienne version de ce dépôt contenait en clair une `DATABASE_URL` d'une base distante :
  **révoquer/changer ce mot de passe** et le purger de l'historique git si le dépôt est public.

## Structure
```
frontend/   React + Vite → image nginx (Dockerfile multi-stage, nginx.conf)
server/     API Express, migrations SQL, tests (Dockerfile multi-stage)
k8s/        manifestes Kubernetes (kustomize)
scripts/    k8s-up.sh · demo-scaling.sh · load-hpa.sh
docker-compose.yml · Makefile · .env.example · RAPPORT.md
```

## Tableau de bord de scalabilité

`/admin` → onglet **Scalability** (session admin requise). Il montre en direct, pour tous les réplicas :
réplicas actifs, req/s, latence p50/p95/p99 (histogramme), taux de 5xx, flux SSE ouverts, CPU / mémoire /
lag de la boucle d'événements par réplica, pool de connexions, connexions Postgres, état de Redis,
routes les plus sollicitées et journal des montées/descentes en charge (HPA ou `--scale`).

Fonctionnement : chaque réplica garde une fenêtre glissante de 60 s (`server/src/metrics.js`) et publie un
instantané dans Redis (`gridlock:metrics:<hostname>`, TTL 10 s) toutes les 3 s ; `GET /api/admin/scalability`
agrège les instantanés vivants — un réplica qui meurt disparaît seul. Sans `REDIS_URL`, seul le processus
courant est affiché. Pour voir le dashboard réagir : `make compose-scale` ou `make k8s-hpa-load`.

### Onglet « Pods » (Kubernetes)
Pods du namespace (statut, prêts, redémarrages + cause du dernier, CPU/mémoire vs requests/limits, nœud, âge),
workloads (prêts/désirés), état du HPA (courant → désiré, CPU vs cible) et événements `Warning`.
L'API lit l'API Kubernetes avec son propre ServiceAccount `api-observer`, en **lecture seule** et limité au
namespace (`k8s/80-rbac.yaml`, appliqué par `kubectl apply -k k8s`). CPU/mémoire demandent metrics-server
(déjà requis par le HPA). Hors Kubernetes (Compose), l'onglet l'indique au lieu d'échouer.
