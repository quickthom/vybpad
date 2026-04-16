#!/bin/sh
set -eu
cd /app
# Production DB schema — never use `db push` on public traffic (docs/PRODUCTION.md)
node node_modules/prisma/build/index.js migrate deploy --schema=prisma/schema.prisma
exec node server/dist/index.js
