#!/usr/bin/env bash
# Mirror .github/workflows/ci.yml job steps for local pre-push validation.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

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
echo "==> prisma generate"
# Locked Prisma 6.x at repo root (`npx prisma` may resolve Prisma 7 and break this schema).
npm run db:generate --workspace=@vybpad/server
echo "==> prisma migrate deploy"
node node_modules/prisma/build/index.js migrate deploy --schema=prisma/schema.prisma
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
