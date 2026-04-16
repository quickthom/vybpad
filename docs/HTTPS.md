# HTTPS termination (TASK-8.6)

Web Audio and Web MIDI require a **secure context** ([ARCHITECTURE.md](../ARCHITECTURE.md)). TLS must terminate in front of the Nginx + API stack.

## Modes (choose one per environment)

### A — Caddy or Traefik (automatic ACME)

- Place Caddy/Traefik on host or as an extra Compose service with volumes for certs.
- Upstream: `web:80` from `docker-compose.prod.yml` (or publish `web` only on `127.0.0.1` and reverse-proxy to it).
- Set `PUBLIC_ORIGIN` / `CORS_ORIGIN` / `VITE_API_URL` (at build) to `https://<your-hostname>`.

### B — Cloud load balancer TLS (e.g. AWS ALB, GCP LB, Fly.io, Render)

- Terminate TLS at the edge; forward HTTP to the container host port mapped to `web:80`.
- Set `X-Forwarded-Proto` / `X-Forwarded-For` at the load balancer (Nginx config forwards them to the API for logging).

### C — Nginx + Certbot on the host

- Classic VM: host Nginx handles TLS and proxies to `127.0.0.1:8080` (or wherever `web` is bound).
- Renew certs with Certbot timer.

## Alignment checklist

1. **`CORS_ORIGIN`** equals the **https** origin users open (no trailing slash).
2. **Rebuild the `web` image** when `PUBLIC_ORIGIN` changes — `VITE_API_URL` is compile-time.
3. **HTTP → HTTPS** redirect at the TLS terminator (not required inside the `web` container for first boot).
4. **HSTS:** enable only after HTTPS is verified end-to-end; avoid pinning in pure dev.
5. **Cookies:** refresh token uses `Secure` in production (`NODE_ENV=production`); ensure users only hit `https://` for login.

## Verification

- Browser padlock on the app URL.
- In DevTools console: `window.isSecureContext === true`.
- `curl -fsS https://<host>/api/health` returns JSON `{ "status": "ok" }`.
