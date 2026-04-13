# Local CI parity

Run the same steps as [.github/workflows/ci.yml](../.github/workflows/ci.yml) **before pushing** when GitHub Actions minutes are limited or you want faster feedback.

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

## Environment (match CI job `env`)

Exports below mirror the workflow. Override any as needed.

| Variable | CI-aligned default |
|----------|-------------------|
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/vybpad_ci` |
| `JWT_SECRET` | `ci-jwt-secret-must-be-at-least-32-characters-long` |
| `JWT_REFRESH_SECRET` | `ci-refresh-secret-must-be-at-least-32-characters-long` |
| `CORS_ORIGIN` | `http://127.0.0.1:5173` |
| `VITE_API_URL` | `http://127.0.0.1:3001` |
| `NODE_ENV` | `development` |
| `CI` | `true` |

Repository secrets `CI_JWT_SECRET` / `CI_JWT_REFRESH_SECRET` are not available locally; the literals above match the workflow fallbacks.

## Command sequence (same order as CI)

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

Use this when fixing a **single failing** Playwright test so you do not run the entire suite on every edit (CI still runs the full pipeline on push).

```bash
# One file
npm run test:e2e -- client/tests/e2e/persistence.happy.spec.ts

# One test by title substring
npm run test:e2e -- -g "persistence happy"
```

Same env and prerequisites as the full sequence above. Prefer targeted runs during remediation; run the **full** `npm run test:e2e` locally (or `./scripts/ci-local.sh`) once before you consider the fix ready if you want parity with CI before pushing.

## End-to-end and PAT-029

E2E uses Playwright’s **dual `webServer`** setup: the suite waits for **both** `GET /api/health` (API) and the Vite dev server before running tests (**PAT-029**). Do not skip that unless you intentionally set `PLAYWRIGHT_SKIP_WEBSERVER=1` with both servers already up (see [README.md](../README.md#end-to-end-playwright)).

`npm run e2e:devstack` is a convenience to run API + Vite in one terminal for manual debugging; the **CI-equivalent** path is `npm run test:e2e` with defaults so Playwright starts the stack.

## Verifying GitHub Actions concurrency (manual)

After [.github/workflows/ci.yml](../.github/workflows/ci.yml) `concurrency` + `cancel-in-progress` is enabled:

1. Open or use a PR branch.
2. Push commit **A** and note the Actions run in the PR checks.
3. Before that run finishes, push commit **B** on the same branch.
4. In the Actions tab, the run for **A** should show **Cancelled** (superseded), and the latest run for **B** should proceed.

This confirms overlapping long suites are not left running for the same PR when pushes land in quick succession.
