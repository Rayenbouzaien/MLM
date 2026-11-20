# Rapport technique — Conteneurisation et orchestration de Gridlock

*Cloud Computing — Proposition 2 : Docker & Kubernetes (Minikube)*
Auteurs : _à compléter_ · Date : _à compléter_

## 1. Objectif et application

Gridlock est une plateforme de hackathon (inscription d'équipes, choix de défis, dépôt de
rendus, tableau de bord organisateur, fil d'activité temps réel). L'application était déployée
sur un PaaS (front statique + API + base managée). L'objectif du projet est de la **conteneuriser**
puis de l'**orchestrer** (Docker Compose en local, Kubernetes/Minikube ensuite), en démontrant
la scalabilité, la persistance des données et l'isolation réseau.

## 2. Architecture

```
 navigateur ─► [Ingress] ─► web (nginx) ─/api─► api ×N ─► db (PostgreSQL, PVC)
                                                   └────► redis (pub/sub + AOF, PVC)
```

| Composant | Technologie | Remarque |
|---|---|---|
| web | React/Vite servi par nginx | reverse-proxy `/api` : navigateur et API sur **la même origine** |
| api | Node 20 / Express | sans état (sessions = JWT en cookie) → réplicable |
| db | PostgreSQL 16 | un primaire, données sur volume persistant |
| redis | Redis 7 | bus pub/sub du flux SSE `/api/live` partagé entre réplicas |

Pourquoi Redis ? Le flux temps réel (Server-Sent Events) utilisait un bus **en mémoire** : avec
plusieurs réplicas, un événement créé sur le réplica A n'atteignait pas les navigateurs connectés
au réplica B. Redis rend l'API réellement scalable (§7). Le choix Redis correspond à l'une des
options du sujet (Redis/MongoDB) ; PostgreSQL est conservé pour les données métier (schéma relationnel
existant : équipes, membres, défis, rendus).

## 3. Dockerfiles (3 pts)

**API** (`server/Dockerfile`) — 2 étapes : (1) `npm ci --omit=dev` dans une étape `deps` ;
(2) image d'exécution `node:20-alpine` ne recopiant que `node_modules`, `src`, `migrations`.
Utilisateur **non-root** (`node`), `HEALTHCHECK`, forme *exec* du `CMD` (node = PID 1, reçoit
SIGTERM → arrêt propre du pool), `.dockerignore` (tests, docs, `.env*` exclus).

**Front** (`frontend/Dockerfile`) — 2 étapes : (1) build Vite avec pnpm (couche de dépendances
mise en cache grâce à la copie préalable de `package.json` + lockfile) ; (2) `nginx-unprivileged`
qui ne contient **que** `dist/` : plus de Node, de sources ni de `devDependencies` en production
(l'ancienne image lançait `vite preview`). Non-root, port 8080, `HEALTHCHECK` sur `/healthz`.

Mesure de la légèreté (à compléter) : `docker images | grep gridlock`

| Image | Avant (single-stage) | Après (multi-stage) |
|---|---|---|
| gridlock-web | _à mesurer_ | _à mesurer_ |
| gridlock-api | _à mesurer_ | _à mesurer_ |

## 4. Docker Compose (3 pts)

`docker-compose.yml` : 4 services (+ `adminer` en profil optionnel `tools`).
- **Ordre de démarrage fiable** : `depends_on` + `condition: service_healthy` (db/redis → api → web).
- **Réseaux** : `frontend` (web↔api) et `backend` (api↔db/redis). Le `web` n'a aucune route vers
  les bases ; seules `web` (8080) et `adminer` (127.0.0.1:8081) publient un port sur l'hôte.
- **Configuration** par variables (`.env`), `DATABASE_URL` construite à partir de `POSTGRES_PASSWORD`.
- L'API n'a ni `container_name` ni port hôte : `docker compose up --scale api=3` fonctionne.

## 5. Déploiement Kubernetes (5 pts)

Manifestes dans `k8s/` (kustomize), déployés par `make k8s-up`. Validés par `kubeconform --strict`
(K8s 1.30) : 19 ressources valides.

- **Deployments** `api` et `web` (2 réplicas, `RollingUpdate` `maxUnavailable: 0`).
- **StatefulSet** `db` (identité stable + `volumeClaimTemplates`) ; **Deployment** `redis` (+ PVC).
- **Services** : `api` et `web` (ClusterIP), `db` (headless), `redis`. Les noms (`api`, `db`, `redis`)
  sont **identiques à ceux de Compose** → `nginx.conf` et l'application n'ont pas changé entre les deux mondes.
- **Ingress** nginx → `web` (timeouts 1 h pour le flux SSE).
- **Probes** : `startupProbe` (migrations au démarrage), `readinessProbe` `/api/ready` (le pod
  n'entre dans le Service que si la base répond), `livenessProbe` `/api/health`.
- **Ressources** requests/limits partout (nécessaires au HPA) ; `securityContext` : non-root,
  `readOnlyRootFilesystem` + `drop ALL` sur l'API.
- **Migrations concurrentes** : N réplicas démarrant ensemble lançaient les migrations en parallèle ;
  un verrou consultatif PostgreSQL (`pg_advisory_lock`) les sérialise.
- **Secrets / ConfigMap** : séparation réglages / secrets (valeurs de dev fournies, à remplacer).

## 6. Volumes, données persistantes et réseau (3 pts)

| Donnée | Compose | Kubernetes |
|---|---|---|
| PostgreSQL | volume nommé `pg_data` | PVC 1 Gi via `volumeClaimTemplates` (`PGDATA` en sous-dossier) |
| Redis (AOF) | volume `redis_data` | PVC `redis-data` (stratégie `Recreate`, volume RWO) |

Test de persistance (à capturer) : créer une équipe → `docker compose down && up` (Compose) ou
`kubectl delete pod db-0` (K8s) → l'équipe est toujours présente.

Réseau : DNS interne (`db`, `redis`, `api`), deux réseaux Compose, et en K8s des **NetworkPolicies** :
deny-all en entrée, puis `ingress-nginx→web`, `web→api`, `api→db`, `api→redis`. *Elles ne sont
appliquées que par un CNI compatible (ex. `minikube start --cni=calico`).*

## 7. Scalabilité (inclus dans les 5 pts)

- **Manuelle** : `kubectl -n gridlock scale deployment/api --replicas=5` (ou `make k8s-scale N=5`) ;
  `/api/health` renvoie `instance` (nom du pod) : 20 requêtes montrent la répartition entre pods.
- **Automatique** : HPA `api` (2→6, cible CPU 50 %), déclenché par `make k8s-hpa-load`
  (`kubectl -n gridlock get hpa api -w`).
- **Ce qui a dû être corrigé pour que cela fonctionne** : (a) bus d'événements → Redis ;
  (b) migrations concurrentes → verrou consultatif ; (c) cookies `SameSite=None; Secure` imposés
  en production, incompatibles avec HTTP → rendus configurables et `SameSite=Lax` grâce à
  l'origine unique ; (d) limiteur de débit : `TRUST_PROXY` = nombre de proxies (2 sur K8s :
  ingress + nginx) pour que chaque utilisateur ait son propre quota.
- **Limite connue** : PostgreSQL reste un primaire unique (pas de réplication) ; seule la couche sans état
  scale horizontalement. Budget connexions : `réplicas × PGPOOL_MAX < 100`.

## 8. Nettoyage de l'ancien déploiement PaaS

Supprimés/remplacés : `RENDER_ENV_VARS.md`, `DOCKER.md`, instructions Render/Neon/Vercel du
README serveur, URL `onrender.com` dans compose, tests et configuration ; plugin Vite de contournement
`404.html` propre à ce PaaS ; `DATABASE_URL` distante codée en dur dans `docker-compose.yml`
(secret exposé : à révoquer). `.gitignore` corrigé pour versionner `.env.example` uniquement.

## 9. Vérifications effectuées

| Vérification | Résultat |
|---|---|
| Tests backend (`npm test`, PostgreSQL réel) | 60/60 |
| 2 réplicas API + Redis : événement créé sur l'un reçu en SSE sur l'autre | OK |
| 2 réplicas démarrés simultanément (verrou de migration) | OK |
| nginx (`nginx.conf` du projet) : SPA `/admin`, proxy `/api`, flux SSE | OK |
| Build front (`pnpm build`) | OK |
| Manifestes K8s (`kubeconform --strict`) | 19/19 valides |
| `docker compose up`, build des images, déploiement Minikube | **à exécuter et capturer par l'équipe** |

## 10. Reproductibilité

```bash
git clone <dépôt> && cd MLM-main
cp .env.example .env && docker compose up -d --build          # Partie 1  → http://localhost:8080
make k8s-up                                                    # Partie 2  → http://$(minikube ip)/
make k8s-scale N=5                                             # démo scalabilité
```
Versions : Docker ≥ 24, Compose v2, Minikube ≥ 1.33, kubectl ≥ 1.29.

## 11. Captures et résultats à joindre

1. `docker compose ps` (services *healthy*) et `docker images | grep gridlock`
2. `docker compose up --scale api=3` + sortie des `/api/health` (instances différentes)
3. `kubectl -n gridlock get pods,svc,pvc,ingress,hpa`
4. `kubectl scale … --replicas=5` + répartition des requêtes
5. Test de persistance (avant/après suppression de `db-0`)
6. HPA en action sous charge

## 12. Pistes d'amélioration
Réplication PostgreSQL (opérateur CloudNativePG) ou base managée (RDS), Redis managé (ElastiCache),
secrets via un gestionnaire dédié, TLS (cert-manager / ALB), CI de build/scan d'images,
variante **AWS ECS/Fargate** (Task Definitions équivalentes aux Deployments).
