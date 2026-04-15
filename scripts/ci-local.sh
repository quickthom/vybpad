#!/usr/bin/env bash
# Mirror .github/workflows/ci.yml job steps for local pre-push validation.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# Optional repo-root `.env` (gitignored): PAT-030 Playwright ports, JWT, DATABASE_URL.
if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

export DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/vybpad_ci}"
export JWT_SECRET="${JWT_SECRET:-ci-jwt-secret-must-be-at-least-32-characters-long}"
export JWT_REFRESH_SECRET="${JWT_REFRESH_SECRET:-ci-refresh-secret-must-be-at-least-32-characters-long}"
export CORS_ORIGIN="${CORS_ORIGIN:-http://127.0.0.1:5173}"
export VITE_API_URL="${VITE_API_URL:-http://127.0.0.1:3001}"
export NODE_ENV="${NODE_ENV:-development}"
export CI="${CI:-true}"

echo "==> ci-local: DATABASE_URL host/db (check Postgres is up)"
echo "    $DATABASE_URL"
echo "==> npm ci"
npm ci
PRISMA_CLI_JS="${ROOT}/node_modules/prisma/build/index.js"
if [[ ! -f "$PRISMA_CLI_JS" ]]; then
  echo "ci-local: missing ${PRISMA_CLI_JS} after npm ci" >&2
  exit 1
fi
echo "==> prisma generate"
# Invoke the locked workspace `prisma` package — `npx prisma` can resolve to Prisma 7 from npx cache.
node "$PRISMA_CLI_JS" generate --schema=prisma/schema.prisma
echo "==> prisma db push"
node "$PRISMA_CLI_JS" db push --schema=prisma/schema.prisma
echo "==> npm run build"
npm run build
echo "==> npm run lint"
npm run lint
echo "==> npm test"
npm test
#echo "==> playwright install chromium"
#npx playwright install chromium --with-deps
echo "==> npm run test:e2e"
npm run test:e2e
echo "==> ci-local: OK"
