# Authenticated editor shell — E2E and visual baselines

The interactive grid editor lives behind authentication (`RequireAuth`). **Unauthenticated Playwright runs cannot reach `/editor/:id` for screenshots or flows** unless the spec logs in or restores a session.

## Required pattern for editor E2E

1. **Seeded test user + API login** — Register/login via the API (or reuse fixtures) and inject auth state the app expects (access token in client store / refresh cookie per `ARCHITECTURE.md`). Existing specs already follow this pattern; extend them rather than inventing one-off auth per spec.
2. **Centralized session (optional improvement)** — Prefer a shared helper or Playwright `storageState` once multiple specs need the same logged-in shell, so baselines stay consistent and login code is not duplicated.

## Visual regression / Designer baselines

- **Primary path:** Full-app E2E with authenticated navigation to the editor, then capture screenshots at agreed viewports (minimum **1024×768** per `UX_GUIDELINES.md` §4).
- **Storybook** for isolated shell components is **not** in the monorepo today; treating it as optional future work if components need stories without the full app. Do not block Phase 8 QA on Storybook unless the Tech Lead opens a dedicated scaffold task.

### Updating screenshot baselines (`TASK-8.4`)

Playwright stores PNGs under `client/tests/e2e/*.visual.spec.ts-snapshots/` (one folder per spec file). Regenerate after intentional UI changes (Designer-approved):

1. Start from the repo root with the same **PAT-030** port stack as local E2E (`PLAYWRIGHT_BASE_URL`, `PLAYWRIGHT_API_URL`, `CORS_ORIGIN`, `VITE_API_URL` — see `PATTERNS.md` PAT-030).
2. Run only the visual project and refresh snapshots:

   ```bash
   npx playwright test --project=visual --update-snapshots
   ```

3. Review the diffed PNGs; commit the updated `*-snapshots/**` files with the PR and note Designer approval in the PR description.

The default `visual` viewport in `playwright.config.ts` is **1280×768** (meets the §4 minimum).

## Accessibility (axe) — non-canvas surfaces (`TASK-8.3`)

Automated checks use **`@axe-core/playwright`** on DOM chrome only. Per `UX_GUIDELINES.md` §9, the grid **canvas** is excluded from full semantic/ARIA expectations; E2E excludes `[role="application"]` (Song editor) and raw `canvas` nodes so scans focus on toolbar, panels, transport, and auth routes. The `color-contrast` rule is disabled in automation where token tiers still need a Designer pass; structural rules use WCAG 2.0/2.1 AA tags.

## Phase 8 checklist

When `ROADMAP.md` Phase 8 QA tasks (coverage audit, full workflow E2E, visual regression, a11y audit) are opened, **reference this document** for any task that requires an authenticated editor viewport or screenshot baseline.
