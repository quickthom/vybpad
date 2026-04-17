#!/usr/bin/env bash
# Rebuild and restart the production-shaped Docker stack (TASK-8.5).
# The SPA is baked into the `web` image at build time — you must rebuild images
# after pulling new client code, or the browser will keep seeing the old bundle.
#
# Environment (ENVIRONMENTS.md, PAT-013):
#   Production and staging should inject secrets via the hosting platform or
#   orchestrator — do not maintain a hand-written “prod .env” in the repo.
#   This script runs `docker compose`; you can either:
#     • Export the same variable names in your shell (e.g. after your platform
#       or secret manager has populated the environment), then run with no file; or
#     • Pass --env-file PATH to a file your deployment system wrote (not a
#       committed template filled by hand as “production”).
#   For local prod-shaped testing only, docs/PRODUCTION.md shows an example
#   compose invocation with an env file — that is optional and not a substitute
#   for platform injection on real hosts.
#
# Usage:
#   export DATABASE_URL=... JWT_SECRET=... JWT_REFRESH_SECRET=... CORS_ORIGIN=... PUBLIC_ORIGIN=...
#   ./scripts/prod-restart.sh
#
#   ./scripts/prod-restart.sh --env-file /run/secrets/vybpad.env   # example: path from orchestrator
#   VYBPAD_ENV_FILE=/path/to/file ./scripts/prod-restart.sh
#
# Options:
#   --env-file PATH   Pass through to docker compose (optional; default: none — use shell env)
#   --no-build        Only restart containers (does NOT rebuild images). Use only if
#                     you changed runtime env vars and did not change app code.
#   -h, --help        Show this help
#
# Prerequisites: Docker, Docker Compose v2; see docs/PRODUCTION.md and ENVIRONMENTS.md

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

COMPOSE_FILE="docker-compose.prod.yml"
DO_BUILD=1
ENV_FILE=""
# Optional: default file from env only if operator explicitly sets VYBPAD_ENV_FILE
if [[ -n "${VYBPAD_ENV_FILE:-}" ]]; then
  ENV_FILE="$VYBPAD_ENV_FILE"
fi

normalize_compose_database_url() {
  local db_url="$1"
  if [[ "$db_url" == *"@127.0.0.1:5432/"* ]]; then
    db_url="${db_url/@127.0.0.1:5432/@postgres:5432}"
  elif [[ "$db_url" == *"@localhost:5432/"* ]]; then
    db_url="${db_url/@localhost:5432/@postgres:5432}"
  fi
  printf '%s' "$db_url"
}

usage() {
  sed -n '2,/^$/p' "$0" | sed 's/^# \{0,1\}//'
  exit "${1:-0}"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env-file)
      ENV_FILE="${2:?}"
      shift 2
      ;;
    --no-build)
      DO_BUILD=0
      shift
      ;;
    -h | --help)
      usage 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage 1
      ;;
  esac
done

if [[ ! -f "$COMPOSE_FILE" ]]; then
  echo "error: $COMPOSE_FILE not found (run from repo clone)" >&2
  exit 1
fi

if [[ -z "${DATABASE_URL-}" ]]; then
  if [[ -n "$ENV_FILE" ]]; then
    file_database_url="$(awk -F= '$1=="DATABASE_URL" {sub(/^DATABASE_URL=/, ""); print; exit}' "$ENV_FILE" 2>/dev/null || true)"
    if [[ -n "$file_database_url" ]]; then
      rewrote_database_url="$(normalize_compose_database_url "$file_database_url")"
      if [[ "$rewrote_database_url" != "$file_database_url" ]]; then
        echo "==> DATABASE_URL is loopback in $ENV_FILE; remapping to postgres service for compose runtime."
      fi
      DATABASE_URL="$(normalize_compose_database_url "$file_database_url")"
      export DATABASE_URL
    fi
  fi
elif [[ "${DATABASE_URL}" == *"@127.0.0.1:5432/"* || "${DATABASE_URL}" == *"@localhost:5432/"* ]]; then
  original_database_url="$DATABASE_URL"
  DATABASE_URL="$(normalize_compose_database_url "$DATABASE_URL")"
  if [[ "$DATABASE_URL" != "$original_database_url" ]]; then
    echo "==> DATABASE_URL is loopback; remapping to postgres service for compose runtime."
  fi
  unset original_database_url
  export DATABASE_URL
fi

COMPOSE=(docker compose -f "$COMPOSE_FILE")
if [[ -n "$ENV_FILE" ]]; then
  if [[ ! -f "$ENV_FILE" ]]; then
    echo "error: --env-file path does not exist or is not a file: $ENV_FILE" >&2
    exit 1
  fi
  COMPOSE+=(--env-file "$ENV_FILE")
  echo "==> Using env file: $ENV_FILE"
else
  echo "==> No --env-file: using variables from the current shell (see ENVIRONMENTS.md)."
  if [[ -z "${DATABASE_URL:-}" || -z "${JWT_SECRET:-}" || -z "${JWT_REFRESH_SECRET:-}" ]]; then
    echo "warning: DATABASE_URL / JWT_SECRET / JWT_REFRESH_SECRET not all set in the environment." >&2
    echo "         Export them (or use --env-file with a path your platform provides)." >&2
  fi
fi

if [[ "$DO_BUILD" -eq 1 ]]; then
  echo "==> Building images and recreating containers ($COMPOSE_FILE)"
  "${COMPOSE[@]}" up -d --build
else
  echo "==> WARNING: --no-build — images are unchanged. UI/API code updates will NOT appear." >&2
  echo "==> Recreating containers only ($COMPOSE_FILE)"
  "${COMPOSE[@]}" up -d
fi

echo ""
echo "==> Smoke check (default published port is 8080 unless PUBLIC_PORT is set):"
echo "    curl -fsS http://127.0.0.1:8080/api/health"
echo ""
echo "If the UI still looks old: hard-refresh the browser (Ctrl+Shift+R) or clear site cache."
