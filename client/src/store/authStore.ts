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
    await authApi.logout();
    set({ user: null, accessToken: null, isAuthenticated: false });
  },

  refreshToken: async () => {
    const res = await authApi.refresh();
    set({ accessToken: res.accessToken, isAuthenticated: true });
  },
}));

export type { AuthStore } from './authStore.types';
