import { create } from 'zustand';

import { authApi } from '../utils/apiClient';

import type { AuthStore } from './authStore.types';

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,

  login: async (email, password) => {
    const { user, accessToken } = await authApi.login({ email, password });
    set({ user, accessToken, isAuthenticated: true });
  },

  register: async (email, password, displayName) => {
    const { user, accessToken } = await authApi.register({ email, password, displayName });
    set({ user, accessToken, isAuthenticated: true });
  },

  logout: async () => {
    try {
      await authApi.logout();
    } catch {
      /* still clear local session */
    }
    set({ user: null, accessToken: null, isAuthenticated: false });
  },

  refreshToken: async () => {
    const { accessToken } = await authApi.refresh();
    set((s) => ({
      accessToken,
      isAuthenticated: true,
      user: s.user,
    }));
  },
}));

export type { AuthStore } from './authStore.types';
