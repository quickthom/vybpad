import { create } from 'zustand';

import { authApi } from '../utils/apiClient';
import type { AuthStore } from './authStore.types';

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,

  login: async (email: string, password: string) => {
    const res = await authApi.login({ email, password });
    set({
      user: res.user,
      accessToken: res.accessToken,
      isAuthenticated: true,
    });
  },

  register: async (email: string, password: string, displayName: string) => {
    const res = await authApi.register({
      email,
      password,
      displayName: displayName.trim(),
    });
    set({
      user: res.user,
      accessToken: res.accessToken,
      isAuthenticated: true,
    });
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
