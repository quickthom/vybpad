#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [ ! -f ".env" ]; then
  cp .env.example .env
  echo "Created .env from .env.example."
fi

echo "Running full local E2E bootstrap + ci-local flow."
./scripts/ci-local.sh
