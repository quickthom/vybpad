# Testing guide — current build (through Phase 4 wave 2, in progress)

This guide helps **HITL** validate what is **merged on `develop`** versus what is still **in flight on open PRs**. Canonical stack and decisions: [`ARCHITECTURE.md`](ARCHITECTURE.md). Env variables: [`ENVIRONMENTS.md`](ENVIRONMENTS.md). Delivery state: [`TASK_STATUS.md`](TASK_STATUS.md), [`PM_STATE.md`](PM_STATE.md).

**Snapshot (2026-04-13):** `develop` includes Phase 3 complete and **TASK-4.1** (PR [#34](https://github.com/quickthom/vybpad/pull/34)). Phase 4 **wave 2** PRs [#35](https://github.com/quickthom/vybpad/pull/35) / [#36](https://github.com/quickthom/vybpad/pull/36) were open with CI failures/remediation in progress — re-verify tip with `git fetch origin && git rev-parse origin/develop`.

---

## 1) Prerequisites and environment setup

### Required

| Requirement | Notes |
|-------------|--------|
| **Node.js 22 LTS** | Matches [`ARCHITECTURE.md`](ARCHITECTURE.md). |
| **npm** | Workspaces root at repo root. |
| **Docker + Docker Compose** | Recommended for PostgreSQL 16 + aligned ports (API **3001**, Vite **5173**). |
| **Root `.env`** | Copy from `.env.example` (`cp .env.example .env`) and set `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET` (see [`ENVIRONMENTS.md`](ENVIRONMENTS.md)). |
| **Prisma client + schema** | Before first run against a DB: `npx prisma generate --schema=prisma/schema.prisma` and `npx prisma db push --schema=prisma/schema.prisma` (or your migration workflow). |

### Playwright / browser (E2E)

- Install **Chromium** for Playwright: `npx playwright install chromium` (CI uses `npx playwright install chromium --with-deps` — see [`.github/workflows/ci.yml`](.github/workflows/ci.yml)).
- E2E reads the same secrets/DB as local dev when using the auto-started stack. Optional overrides are documented in `.env.example`: `PLAYWRIGHT_BASE_URL`, `PLAYWRIGHT_API_URL`, `PLAYWRIGHT_SKIP_WEBSERVER`.
- **Use `127.0.0.1` consistently** for client and API in dev (matches defaults and avoids cookie/CORS mismatches vs `localhost`).

### Known local limitations (operator awareness)

- **CI is the E2E source of truth** when local Playwright cannot be installed or run (see [`PM_STATE.md`](PM_STATE.md): environments with **disk quota** or browser install failures — e.g. `write error -122` during `playwright install`).
- **Wave 2 PRs** may add or tighten E2E; local green does not replace a green GitHub Actions run on the PR branch.

---

## 2) How to run the app locally

### Option A — Docker Compose (full stack)

From repo root (after `.env` exists):

```bash
docker compose up
```

Services: PostgreSQL, API on **3001**, Vite on **5173** (see `docker-compose.yml`).

### Option B — Native dev servers

1. PostgreSQL reachable with `DATABASE_URL` set (or only DB via `docker compose up postgres`).
2. `npx prisma db push --schema=prisma/schema.prisma` (or migrations) as needed.
3. Terminal 1: `cd server && npm run dev`
4. Terminal 2: `cd client && npm run dev` (set `VITE_API_URL` if API is not `http://127.0.0.1:3001`).

Open the client at the URL Vite prints (default **http://127.0.0.1:5173**).

Full detail: [`README.md`](README.md) and [`ENVIRONMENTS.md`](ENVIRONMENTS.md).

---

## 3) Manual smoke-test checklist — merged functionality

Use **`develop`** (or latest `origin/develop`). Check off high-value paths; adjust if UX labels differ slightly.

### Phases 0–2 — editor and theory

**Access:** `/editor` and `/projects` are behind **RequireAuth** — log in or register first, then open a project (see Phase 3 path below).

- [ ] App loads without a blank crash; public routes (`/login`, `/register`) render; authenticated redirect to `/projects` works when expected.
- [ ] **Canvas editor** (`role="application"`, name like “Song editor”): grid, measures, chords and notes visible per [`CHANGELOG.md`](CHANGELOG.md) Phase 2 scope.
- [ ] **Chord entry** — place/edit chord blocks; Roman labels update plausibly.
- [ ] **Melody / note entry** — place notes; selection and drag behave.
- [ ] **Keyboard shortcuts** — degree/duration entry and navigation (see Phase 2 changelog / UX).
- [ ] **Undo/redo** — song changes revert and reapply.
- [ ] **Measure bar** — add/delete measures; selection coherent.
- [ ] **Viewport / scroll** — editor remains usable.

### Phase 3 — auth and persistence (merged TASK-3.0–3.5)

- [ ] **Register** — new account; lands on **projects** list.
- [ ] **Create project** — opens **editor** with a project id in the URL.
- [ ] **Wait for load** — “Loading project…” clears (timeout ~30s acceptable on slow machines).
- [ ] **Edit song** — e.g. click canvas to trigger changes; **autosave** completes (network: `PUT /api/projects/:id` succeeds).
- [ ] **Refresh browser** — project reloads; edits still present.
- [ ] **Logout and login** — project appears in list; opening editor shows persisted song.
- [ ] **API sanity** (optional): with access token, `GET /api/projects/:id` returns expected `songData` after edits.

Automated mirror: `client/tests/e2e/persistence.happy.spec.ts` (TASK-3.5 happy path).

### Phase 4.1 — merged on `develop` (TASK-4.1 / PR #34)

- [ ] **Transport toolbar** — visible (`role="toolbar"`, name **Transport**).
- [ ] Before first successful init, toolbar has **`data-audio-ready="false"`** (or equivalent documented attribute).
- [ ] **First Play / “Start audio and play”** — user gesture starts audio; toolbar moves to **`data-audio-ready="true"`** within ~20s on a healthy machine.
- [ ] **Reload** — readiness resets; a **second** Play gesture succeeds again.
- [ ] **Rapid clicks on Play during init** — no hard page errors; toolbar still reaches ready (matches E2E intent).

Automated mirror: `client/tests/e2e/playback-init.task-4-1.spec.ts`.

**Not merged on `develop` yet (wave 2):** full **piano sample loading** polish (TASK-4.2 / #35), **harmony voicing engine** breadth (TASK-4.3 / #36), scheduler/transport/cursor tasks 4.4+ — see §4.

---

## 4) Open Wave 2 branches / PRs (#35 / #36) and CI status

| PR | Task | Branch (per [`TASK_STATUS.md`](TASK_STATUS.md)) | What to validate (when merged or checked out) |
|----|------|-----------------------------------------------|-----------------------------------------------|
| [#35](https://github.com/quickthom/vybpad/pull/35) | TASK-4.2 | `phase-4/piano-sample-loading` | Piano **sample loading** UX and stability; E2E/transport interactions (PR aimed at Playwright locator + autosave timing issues in CI). |
| [#36](https://github.com/quickthom/vybpad/pull/36) | TASK-4.3 | `phase-4/harmony-voicing-engine` | **Harmony voicing** behavior and related theory/audio tests; prior CI notes included voicing/metrics edge cases — follow latest PR description and Reviewer comments. |

### How to check CI status

**GitHub UI**

1. Open the PR: [#35](https://github.com/quickthom/vybpad/pull/35), [#36](https://github.com/quickthom/vybpad/pull/36).
2. Scroll to **Checks** / latest workflow run; confirm **CI** job (lint, build, `npm test`, `npm run test:e2e` per workflow).

**CLI (`gh`, authenticated)**

```bash
gh pr checks 35 --repo quickthom/vybpad
gh pr checks 36 --repo quickthom/vybpad
gh pr view 35 --repo quickthom/vybpad --json statusCheckRollup,commits
gh run list --repo quickthom/vybpad --branch phase-4/piano-sample-loading --limit 5
gh run list --repo quickthom/vybpad --branch phase-4/harmony-voicing-engine --limit 5
```

**Local validation of a PR branch** (optional): fetch branch, `npm install`, `npx prisma generate`, `npx prisma db push`, then unit tests + E2E as in §5.

---

## 5) Commands — unit, integration, E2E

All from **repository root** unless noted.

| Goal | Command |
|------|---------|
| **Unit + integration (Vitest)** | `npm test` |
| **Client-only Vitest** | `cd client && npm test` |
| **E2E (Playwright)** | `npm run test:e2e` |
| **E2E with servers already running** | `PLAYWRIGHT_SKIP_WEBSERVER=1 npm run test:e2e` |
| **Typecheck / project build** | `npm run build` |
| **Lint** | `npm run lint` |
| **Format check** | `npm run format:check` |

**Typical first-time E2E setup** (matches [`README.md`](README.md)):

```bash
cp .env.example .env   # if needed
# edit .env — DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET
npx prisma generate --schema=prisma/schema.prisma
npx prisma db push --schema=prisma/schema.prisma
npm install
npx playwright install chromium
npm run test:e2e
```

- Playwright config: [`playwright.config.ts`](playwright.config.ts) — tests under `client/tests/e2e/`, `webServer` runs `npm run e2e:devstack` unless `PLAYWRIGHT_SKIP_WEBSERVER` is set.
- Vitest includes `client/tests/**/*.test.*` and `server/tests/**/*.test.*` ([`vitest.config.ts`](vitest.config.ts)).

---

## 6) Troubleshooting

| Symptom | What to try |
|---------|-------------|
| **`npx playwright install` fails** (e.g. disk **quota**, `write error -122`) | Free disk space; install deps on a volume with room. Rely on **GitHub Actions** for E2E until local install works ([`PM_STATE.md`](PM_STATE.md)). |
| **E2E flaky PUT / autosave** | Ensure stable DB; use **127.0.0.1** for API and Vite; avoid competing processes on 3001/5173; see TASK-3.5 remediation history in [`TASK_STATUS.md`](TASK_STATUS.md). |
| **CORS / cookies / login oddities** | Align **browser URL** with `CORS_ORIGIN` and `VITE_API_URL` (do not mix `localhost` and `127.0.0.1`). |
| **Database connection errors** | Verify `DATABASE_URL`, Postgres up, `prisma db push` applied. |
| **Port already in use** | Stop other API/Vite instances or change ports in `.env` / Compose consistently. |

---

## Quick reference links

| Doc | Use |
|-----|-----|
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | Stack, testing strategy, ports |
| [`ENVIRONMENTS.md`](ENVIRONMENTS.md) | Env vars, Playwright table, Compose |
| [`README.md`](README.md) | Clone, install, run, tests |
| [`CHANGELOG.md`](CHANGELOG.md) | Milestone-delivered features |
| [`TASK_STATUS.md`](TASK_STATUS.md) | Phase/task/PR truth |
