# Production operations (Phase 8)

## Stack

- **web:** Nginx serves the Vite `client/build` SPA and proxies `/api/*` to the Node API (`docker/prod.web.Dockerfile`, `docker/nginx.prod.conf`).
- **api:** Fastify (`docker/prod.api.Dockerfile`); runs `prisma migrate deploy` before `node server/dist/index.js`.
- **postgres:** PostgreSQL 16 (`docker-compose.prod.yml`).

## Environment contract (PAT-013)

| Variable | Required | Notes |
|----------|----------|--------|
| `DATABASE_URL` | yes | e.g. `postgresql://USER:PASS@postgres:5432/DB` on the Compose network |
| `JWT_SECRET` | yes | ≥ 32 characters |
| `JWT_REFRESH_SECRET` | yes | ≥ 32 characters |
| `CORS_ORIGIN` | yes | Must equal the **browser origin** (scheme + host + port) users open — e.g. `https://app.example.com` or `http://localhost:8080` |
| `PUBLIC_ORIGIN` | yes at **client build time** | Same string as `CORS_ORIGIN` — passed as `VITE_API_URL` when building the SPA so `fetch` targets the same host; Nginx proxies `/api` to the API container |
| `NODE_ENV` | `production` | Set in the API image |
| `PORT` | optional | API listens on `3001` inside the stack |

## Database migrations

- **Production:** `prisma migrate deploy` only (API container entrypoint). Do **not** use `db push` on databases that serve real users.
- **Local CI:** `scripts/ci-local.sh` runs `migrate deploy` against a throwaway DB (same as production path).
- **New schema changes:** add a migration under `prisma/migrations/` (e.g. `prisma migrate dev` against a dev DB), commit, then deploy.
- **Existing DBs created with `db push` only:** if `migrate deploy` fails with **P3005**, either drop/recreate the database or mark the initial migration applied when the schema already matches:  
  `node node_modules/prisma/build/index.js migrate resolve --applied 20260415120000_init --schema=prisma/schema.prisma`

## Compose (local / single VM)

```bash
# Example .env next to docker-compose.prod.yml
POSTGRES_USER=vybpad
POSTGRES_PASSWORD=vybpad
POSTGRES_DB=vybpad
DATABASE_URL=postgresql://vybpad:vybpad@postgres:5432/vybpad
JWT_SECRET=<32+ chars>
JWT_REFRESH_SECRET=<32+ chars>
# Origin users type in the browser (must match CORS + Vite build):
PUBLIC_ORIGIN=http://127.0.0.1:8080
CORS_ORIGIN=http://127.0.0.1:8080
PUBLIC_PORT=8080

docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

Smoke: `curl -fsS http://127.0.0.1:8080/api/health`

## Backups

- Schedule `pg_dump` (or provider snapshots) for the Postgres volume — provider-specific; not automated in-repo.
