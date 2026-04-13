import type { UserResponse } from '@vybpad/shared';

/** INTERFACES.md — AuthStore */
export interface AuthStore {
  user: UserResponse | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
}
