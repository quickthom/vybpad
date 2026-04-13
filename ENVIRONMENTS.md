# Environments

This document summarizes how environment variables are used across tiers (per **PATTERNS.md** PAT-026). It is not a substitute for `.env.example`, which remains the committed template for required keys and placeholders.

The sections below expand this for **operators**: local development, Docker Compose, CI/CD expectations, and a production deployment sketch (per **ARCHITECTURE.md**). If anything here conflicts with PAT-026 or `ARCHITECTURE.md`, follow those sources and escalate to the Architect.

## Rules (PAT-026)

- **Development:** Use git-ignored `.env` files. The repo root provides `.env.example`; copy it to `.env` and fill in secrets. `docker-compose.yml` loads the root `.env` where configured (`env_file` / `environment`).
- **Production:** Inject variables via the hosting platform or orchestrator (no in-app secrets manager for MVP).
- **Never commit** real secrets. `.env` and `*.env.local` are git-ignored.
- **CI (if/when added):** supply secrets through the CI provider (for example GitHub Actions secrets), not inline in workflow files.

## Root variables (local / Compose)

| Variable | Purpose | Default (if any) |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | — (required when DB is used) |
| `JWT_SECRET` | Access token signing | — (required; min 32 chars in production) |
| `JWT_REFRESH_SECRET` | Refresh token / cookie signing | — (required; min 32 chars in production) |
| `PORT` | API listen port | `3001` |
| `NODE_ENV` | Runtime mode | `development` |
| `CORS_ORIGIN` | Allowed browser origin for CORS | `http://localhost:5173` |
| `VITE_API_URL` | Client API base URL (Vite) | `http://localhost:3001` |

When adding a new variable in application code, update **`.env.example` in the same PR** (PAT-026).

---

## Environment tiers

- **Local (developer machine):** run the app locally (Vite dev server + Node API) with optional Docker Compose for a local Postgres instance.
- **Staging:** automatic container-based deployment on merge to `develop`. Mirrors production topology behind HTTPS.
- **Production:** containerized deployment (Nginx reverse proxy + Node API + PostgreSQL). TLS terminated at the reverse proxy. Backups via scheduled `pg_dump` (provider-dependent).

## Local development (quick start)

1. Clone the repo (or create a worktree from `develop`) and `cd` into the project root.
2. Install dependencies:

```bash
# from repo root
npm install
```

Note: if you use git worktrees, each worktree must run `npm install` locally (see PAT-017).

3. Create a local environment file from the committed template:

```bash
cp .env.example .env
# Edit .env to provide secrets and any non-default ports
```

4. Two common development modes:

- Run with native dev servers (recommended for day-to-day frontend/backend development):

  - In one terminal: `cd server && npm run dev` (API on `PORT` from `.env`, default 3001)
  - In another terminal: `cd client && npm run dev -- --host 0.0.0.0` (Vite dev server, default 5173)

- Run via Docker Compose (provides a local Postgres and isolates services):

  ```bash
  docker compose up --build
  ```

5. Database migrations (if applicable): follow the repo's `prisma` or migration README. (No automated migration step is performed by Docker Compose by default.)

6. Tests and lint:

```bash
npm run lint
npm run test
```

Run these before opening PRs.

## Docker Compose (development)

The repository includes `docker-compose.yml` (v3.8) with three services:

- `postgres` — Postgres 16, data persisted in `pgdata` volume, port 5432 exposed locally.
- `api` — built from `docker/dev.api.Dockerfile`, mounts source, runs `cd server && npm run dev`, exposes 3001.
- `client` — built from `docker/dev.client.Dockerfile`, mounts source, runs Vite dev server, exposes 5173.

Key notes:

- `api` service sets `DATABASE_URL` to connect to the `postgres` service internally.
- `.env` is referenced by services via `env_file: .env` — keep secrets out of git.
- Use `docker compose up --build` to start the stack; use `docker compose down --volumes` to tear it down.

Minimum variable expectations align with **Root variables** above and PAT-013; production and staging use the same logical keys, injected by the platform (PAT-026).

## CI / CD expectations

- CI (GitHub Actions recommended) should run on PRs and pushes:

  - Install dependencies
  - Lint
  - Type-check (if applicable)
  - Run unit/component tests (Vitest)
  - Run E2E on PR merge to `develop` (Playwright) if resources allow

- On merge to `develop`: CI should build artifacts and deploy to a staging environment automatically.
- On production promotion (merge to `main` or manual promotion): deploy containers to production; this promotion should require manual approval.

Notes:

- For CI: inject sensitive values via the CI platform’s secret mechanism (for example GitHub Actions secrets). Do not put secrets in workflow files (PAT-026).
- Any new environment variables must be documented here and in `.env.example`, and wired in CI as needed.

## Production deployment sketch (per ARCHITECTURE.md)

- **Topology:**
  - Nginx reverse proxy (TLS termination, serves SPA static files and reverse-proxies API)
  - Node.js API (container)
  - PostgreSQL (managed DB instance recommended)

- **Requirements:**
  - HTTPS required (TLS certs at reverse proxy)
  - Static assets served by Nginx under `/` and piano samples served under `/samples/`
  - Environment variables injected into containers at runtime by the host/platform (PAT-026) — not by an in-app secrets manager for MVP
  - Database backups: scheduled `pg_dump` (provider-dependent)

- **Deployment options** (operator choice — escalate if architecture changes required):

  - Self-hosted VM(s) with Docker Compose + Traefik/Nginx for small installs
  - Managed container service (ECS/Fargate, GKE, Cloud Run) with load-balancer and TLS termination
  - Use a managed Postgres provider for backups and maintenance

Security and secrets:

- Do not store secrets in the repository.
- For MVP, supply production configuration through platform-level environment injection (container env, orchestrator secrets surfaced as env, etc.) per PAT-026 — not through a separate Vault/AWS Secrets Manager integration inside the application.

## Manual actions required

- **Developer:** copy `.env.example` to `.env` and fill values before running locally (PAT-026).
- **DevOps / Architect:**
  - Configure staging/production hosts or platforms to inject the same variables the app expects (documented here and in `.env.example`).
  - Provision DNS and TLS certs for staging/production.
  - Provision a managed Postgres or prepare production-grade Postgres instance and backups.
  - Configure CI to deploy to staging on merge to `develop` and require manual promotion to production.

## Troubleshooting

- **Database connection errors:** ensure `DATABASE_URL` is reachable and credentials match DB container/provider.
- **Port conflicts:** ensure `PORT` and host ports (3001, 5173, 5432) are free or remap in `.env` and `docker-compose.yml`.
- **Hot-reload in Docker:** if changes in mounted volumes are not picked up, check host OS Docker file-watching settings (macOS/Windows specifics).

---

If anything in this document conflicts with `ARCHITECTURE.md`, follow `ARCHITECTURE.md` and escalate to the Architect for resolution.
