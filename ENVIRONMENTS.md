# Environments

This document summarizes how environment variables are used across tiers (per **PATTERNS.md** PAT-026). It is not a substitute for `.env.example`, which remains the committed template for required keys and placeholders.

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
