import { useAuthStore } from '../store/authStore';

/**
 * Single-flight refresh so `/editor/:id` reload does not race `RequireAuth` vs `SessionInitializer`
 * (TASK-4.2 E2E): first paint must not `<Navigate to="/login" />` before cookie refresh restores the access token.
 */
let inflight: Promise<void> | null = null;

export function ensureSessionBootstrapped(): Promise<void> {
  if (useAuthStore.getState().accessToken) {
    return Promise.resolve();
  }
  if (!inflight) {
    inflight = (async () => {
      try {
        await useAuthStore.getState().refreshToken();
      } catch {
        /* INVALID_REFRESH_TOKEN / network — remain logged out */
      }
    })();
  }
  return inflight;
}
