# Multi-stage API image: workspace build + Prisma migrate deploy at boot (TASK-8.5)
FROM node:22-bookworm AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY client/package.json client/
COPY server/package.json server/
COPY shared/package.json shared/
COPY prisma ./prisma
COPY tsconfig.base.json tsconfig.json ./

COPY shared ./shared
COPY server ./server

RUN npm ci --include-workspace-root

# Shared has no npm `build` script — compile via project references (matches root `npm run build` subset)
RUN npx tsc --build shared server

RUN npm run db:generate --workspace=@vybpad/server

RUN npm prune --omit=dev

# Match OpenSSL with the build stage so Prisma engines resolve (bookworm-slim can differ)
FROM node:22-bookworm AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/server ./server
COPY --from=build /app/shared ./shared
COPY --from=build /app/prisma ./prisma

COPY docker/api-entrypoint.sh /app/api-entrypoint.sh
RUN chmod +x /app/api-entrypoint.sh

EXPOSE 3001
ENTRYPOINT ["/app/api-entrypoint.sh"]
