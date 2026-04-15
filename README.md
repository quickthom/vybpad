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

## Environment

1. Copy the root template and keep it git-ignored:

   ```bash
   cp .env.example .env
   ```

2. Edit `.env` with real values for local development (for example `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`). Never commit `.env` or other secret-bearing files.

3. **`docker-compose.yml`** reads the root `.env` where configured; see [`ENVIRONMENTS.md`](ENVIRONMENTS.md) for variable purposes and defaults.

4. Any new variable introduced in code must be reflected in **`.env.example` in the same PR**.

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

**Full CI parity (build, lint, unit tests, Playwright):** use [docs/CI_LOCAL.md](docs/CI_LOCAL.md) or run `./scripts/ci-local.sh` from the repo root when validating before push (especially if GitHub Actions minutes are limited).

### End-to-end (Playwright)

E2E specs live under `client/tests/e2e/` and exercise the real Fastify API plus the Vite client (see `ARCHITECTURE.md` — Playwright). You need PostgreSQL reachable via `DATABASE_URL` (see `.env.example`), JWT secrets set, and no other process on ports **3001** (API) and **5173** (Vite).

**Option A — let Playwright start the API and client** (default when `PLAYWRIGHT_SKIP_WEBSERVER` is unset): Playwright waits for **both** `GET /api/health` and the Vite dev server before running tests.

```bash
# from repo root, after `cp .env.example .env` and `npx prisma db push --schema=prisma/schema.prisma`
npm install
npx playwright install chromium
npm run test:e2e
```

**Option B — servers already running** (reuse existing dev stack):

```bash
PLAYWRIGHT_SKIP_WEBSERVER=1 npm run test:e2e
```

Optional overrides: `PLAYWRIGHT_BASE_URL` (default `http://127.0.0.1:5173`) and `PLAYWRIGHT_API_URL` (default `http://127.0.0.1:3001`) for API assertions from tests.

CI runs `npm run test:e2e` with a PostgreSQL service and auto-starts the stack; see `.github/workflows/ci.yml`.

## Documentation map

| Document                               | Role                                                       |
| -------------------------------------- | ---------------------------------------------------------- |
| [`ARCHITECTURE.md`](ARCHITECTURE.md)   | Canonical stack, structure, and technical decisions        |
| [`INTERFACES.md`](INTERFACES.md)       | API contracts, shared types, and UI boundaries             |
| [`ROADMAP.md`](ROADMAP.md)             | Phased delivery plan                                       |
| [`CHANGELOG.md`](CHANGELOG.md)         | Delivered work by phase milestone                          |
| [`ENVIRONMENTS.md`](ENVIRONMENTS.md)   | Environment variables, defaults, and  secrets rules |
| [`docs/CI_LOCAL.md`](docs/CI_LOCAL.md) | Local commands matching GitHub Actions (`ci.yml`) for pre-push checks |
| [`UX_GUIDELINES.md`](UX_GUIDELINES.md) | UI/UX standards                                            |

## Monorepo layout

npm workspaces packages:

| Package          | Path      | Role                                            |
| ---------------- | --------- | ----------------------------------------------- |
| `@vybpad/client` | `client/` | React + Vite SPA, canvas editor, Zustand stores |
| `@vybpad/server` | `server/` | Fastify API, Prisma client                      |
| `@vybpad/shared` | `shared/` | Shared TypeScript types and exports             |

Root `package.json` holds workspace-wide scripts (`test`, `build`, `lint`). The Prisma schema lives under `prisma/`. Docker assets live under `docker/`.
