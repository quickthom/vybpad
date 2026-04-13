import { create } from 'zustand';

import type { AuthStore } from './authStore.types';

/**
 * TASK-3.1 — AuthStore (INTERFACES.md). QA scaffold: shape-only; Builder wires authApi,
 * configureApiClient, and state transitions.
 */
export const useAuthStore = create<AuthStore>(() => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  login: async () => {},
  register: async () => {},
  logout: async () => {},
  refreshToken: async () => {},
}));

export type { AuthStore } from './authStore.types';
