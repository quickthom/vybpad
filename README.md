# vYbpad

**vYbpad** is a web application that recreates core [Hookpad](https://www.hooktheory.com/hookpad)-style workflows: a scale-degree-first chord and melody grid editor backed by a music-theory engine, with a Fastify API and PostgreSQL for projects and auth. The repo is a TypeScript monorepo (Vite + React client, Node server, shared types). Deeper stack and design decisions live in [`ARCHITECTURE.md`](ARCHITECTURE.md).

## Prerequisites

- **Node.js** 22 LTS (matches the toolchain in `ARCHITECTURE.md`)
- **npm** (workspaces root)
- **Docker** and **Docker Compose** (recommended for PostgreSQL + aligned dev ports)

## Clone and install

```bash
git clone https://github.com/quickthom/vybpad.git
cd vybpad
npm install
```

## Environment (PAT-026)

1. Copy the root template and keep it git-ignored:

   ```bash
   cp .env.example .env
   ```

2. Edit `.env` with real values for local development (for example `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`). Never commit `.env` or other secret-bearing files.

3. **`docker-compose.yml`** reads the root `.env` where configured; see [`ENVIRONMENTS.md`](ENVIRONMENTS.md) for variable purposes and defaults.

4. Any new variable introduced in code must be reflected in **`.env.example` in the same PR** (PAT-026).

## Run with Docker Compose

From the repository root:

```bash
docker compose up
```

This starts **PostgreSQL 16**, the **API** on port **3001**, and the **Vite dev server** on port **5173** (see `docker-compose.yml`). Ensure `.env` is present; Compose also wires `DATABASE_URL` for the API service.

## Run dev servers without Compose (optional)

1. Start PostgreSQL and point `DATABASE_URL` at it (or use only the `postgres` service: `docker compose up postgres`).
2. Apply the Prisma schema to your database using your usual Prisma workflow (`prisma/schema.prisma` at the repo root).
3. In one terminal: `cd server && npm run dev` (API, default port from `PORT` / `.env`).
4. In another: `cd client && npm run dev` (Vite, typically `http://localhost:5173`). Set `VITE_API_URL` if the API is not on the default in `.env.example`.

## Build and quality checks

```bash
npm run build      # TypeScript project references
npm run lint
npm run format:check
```

## Tests

Vitest is configured at the repo root for `client/tests` and `server/tests`:

```bash
npm test
```

You can also run `npm test` inside `client` for client-focused runs.

## Documentation map

| Document | Role |
|----------|------|
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | Canonical stack, structure, and technical decisions |
| [`INTERFACES.md`](INTERFACES.md) | API contracts, shared types, and UI boundaries |
| [`ROADMAP.md`](ROADMAP.md) | Phased delivery plan |
| [`CHANGELOG.md`](CHANGELOG.md) | Delivered work by phase milestone |
| [`ENVIRONMENTS.md`](ENVIRONMENTS.md) | Environment variables, defaults, and PAT-026 secrets rules |
| [`UX_GUIDELINES.md`](UX_GUIDELINES.md) | UI/UX standards |

## Monorepo layout

npm workspaces packages:

| Package | Path | Role |
|---------|------|------|
| `@vybpad/client` | `client/` | React + Vite SPA, canvas editor, Zustand stores |
| `@vybpad/server` | `server/` | Fastify API, Prisma client |
| `@vybpad/shared` | `shared/` | Shared TypeScript types and exports |

Root `package.json` holds workspace-wide scripts (`test`, `build`, `lint`). The Prisma schema lives under `prisma/`. Docker assets live under `docker/`.
