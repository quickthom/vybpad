# Local CI

**Tests are run locally.** GitHub Actions is disabled to conserve minutes. Every agent and contributor must run the full local suite and confirm it passes before signalling a PR as review-ready. There is no remote CI gate — local execution is the gate.

## Prerequisites

- **Node.js 22** and **npm** at the repo root
- **PostgreSQL 16** reachable at the URL you set (see below). To match CI exactly:

  ```bash
  docker run -d --name vybpad-ci-pg -p 5432:5432 \
    -e POSTGRES_PASSWORD=postgres \
    -e POSTGRES_DB=vybpad_ci \
    postgres:16
  ```

  Stop/remove when done: `docker stop vybpad-ci-pg && docker rm vybpad-ci-pg`

  If you use another Postgres (e.g. Docker Compose defaults), set `DATABASE_URL` accordingly and ensure the DB exists before `prisma db push`.

## Worktree setup (agents working in a git worktree)

Each git worktree is an **independent directory** — it does not inherit the parent clone's `.env`. Before running any tests from a worktree you must:

1. **Create a `.env` in the worktree root** (it is gitignored; you must create it yourself):

   ```bash
   cp .env.example .env
   ```

   Then set values. For local E2E against a local Postgres the CI-aligned defaults below work without modification — just paste them into `.env`:

   ```bash
   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/vybpad_ci
   JWT_SECRET=ci-jwt-secret-must-be-at-least-32-characters-long
   JWT_REFRESH_SECRET=ci-refresh-secret-must-be-at-least-32-characters-long
   CORS_ORIGIN=http://127.0.0.1:5173
   VITE_API_URL=http://127.0.0.1:3001
   NODE_ENV=development
   ```

2. **Run `npm install`** from the worktree root (worktrees do not share `node_modules`).

3. **Apply the schema:** `npx prisma db push --schema=prisma/schema.prisma`

4. **Install Playwright browsers:** `npx playwright install chromium`

These four steps replace the `.env`-based setup that the main clone already has. Skip any you have already done in this worktree session.

## Environment (match CI job `env`)

Standard defaults. Override any as needed.

| Variable | CI-aligned default |
|----------|-------------------|
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/vybpad_ci` |
| `JWT_SECRET` | `ci-jwt-secret-must-be-at-least-32-characters-long` |
| `JWT_REFRESH_SECRET` | `ci-refresh-secret-must-be-at-least-32-characters-long` |
| `CORS_ORIGIN` | `http://127.0.0.1:5173` |
| `VITE_API_URL` | `http://127.0.0.1:3001` |
| `NODE_ENV` | `development` |
| `CI` | `true` |

The literals above are non-production CI-only placeholders (min 32 chars). Do not use them in production.

## Command sequence

From the repository root:

```bash
npm ci
npx prisma generate --schema=prisma/schema.prisma
npx prisma db push --schema=prisma/schema.prisma
npm run build
npm run lint
npm test
npx playwright install chromium --with-deps
npm run test:e2e
```

Or run the scripted version: `./scripts/ci-local.sh` (see [scripts/ci-local.sh](../scripts/ci-local.sh)).

## Targeted E2E (remediation / fast loop)

Use this when fixing a **single failing** Playwright test so you do not run the entire suite on every edit.

```bash
# One file
npm run test:e2e -- client/tests/e2e/persistence.happy.spec.ts

# One test by title substring
npm run test:e2e -- -g "persistence happy"
```

Same env and prerequisites as the full sequence above. Prefer targeted runs during remediation; run the **full** `npm run test:e2e` locally (or `./scripts/ci-local.sh`) once before you consider a fix ready — this is the definitive pass/fail signal.

## End-to-end and PAT-029

E2E uses Playwright’s **dual `webServer`** setup: the suite waits for **both** `GET /api/health` (API) and the Vite dev server before running tests (**PAT-029**). Do not skip that unless you intentionally set `PLAYWRIGHT_SKIP_WEBSERVER=1` with both servers already up (see [README.md](../README.md#end-to-end-playwright)).

`npm run e2e:devstack` is a convenience to run API + Vite in one terminal for manual debugging; the **CI-equivalent** path is `npm run test:e2e` with defaults so Playwright starts the stack.

