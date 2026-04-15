# Authenticated editor shell — E2E and visual baselines

The interactive grid editor lives behind authentication (`RequireAuth`). **Unauthenticated Playwright runs cannot reach `/editor/:id` for screenshots or flows** unless the spec logs in or restores a session.

## Required pattern for editor E2E

1. **Seeded test user + API login** — Register/login via the API (or reuse fixtures) and inject auth state the app expects (access token in client store / refresh cookie per `ARCHITECTURE.md`). Existing specs already follow this pattern; extend them rather than inventing one-off auth per spec.
2. **Centralized session (optional improvement)** — Prefer a shared helper or Playwright `storageState` once multiple specs need the same logged-in shell, so baselines stay consistent and login code is not duplicated.

## Visual regression / Designer baselines

- **Primary path:** Full-app E2E with authenticated navigation to the editor, then capture screenshots at agreed viewports (minimum **1024×768** per `UX_GUIDELINES.md` §4).
- **Storybook** for isolated shell components is **not** in the monorepo today; treating it as optional future work if components need stories without the full app. Do not block Phase 8 QA on Storybook unless the Tech Lead opens a dedicated scaffold task.

## Phase 8 checklist

When `ROADMAP.md` Phase 8 QA tasks (coverage audit, full workflow E2E, visual regression, a11y audit) are opened, **reference this document** for any task that requires an authenticated editor viewport or screenshot baseline.
