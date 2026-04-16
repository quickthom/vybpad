# Nginx + Vite production client build (TASK-8.5)
# Build arg VITE_API_URL must be the browser-visible origin + scheme (same host Nginx serves), e.g. https://app.example.com
FROM node:22-bookworm AS client-build
WORKDIR /app

COPY package.json package-lock.json ./
COPY client/package.json client/
COPY server/package.json server/
COPY shared/package.json shared/
COPY tsconfig.base.json tsconfig.json ./

COPY shared ./shared
COPY client ./client

ARG VITE_API_URL=http://127.0.0.1
ENV VITE_API_URL=${VITE_API_URL}

RUN npm ci --include-workspace-root
RUN npm run build --workspace=@vybpad/client

FROM nginx:1.27-alpine
COPY docker/nginx.prod.conf /etc/nginx/conf.d/default.conf
COPY --from=client-build /app/client/build /usr/share/nginx/html
EXPOSE 80
