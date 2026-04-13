/** @vitest-environment jsdom */

/*
 * QA COVERAGE PLAN — TASK-3.1 (criterion 3)
 *
 * Routing: unauthenticated vs authenticated — `AppRoutes` + `RequireAuth` / `RootRedirect`.
 */

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { AppRoutes } from '@/app/AppRoutes';
import { useAuthStore } from '@/store/authStore';

const sampleUser = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  email: 'ada@example.com',
  displayName: 'Ada',
  createdAt: '2026-01-01T00:00:00.000Z',
};

beforeEach(() => {
  useAuthStore.setState({
    user: null,
    accessToken: null,
    isAuthenticated: false,
    /** Prevent AppRoutes SessionInitializer from navigating away from public routes during tests. */
    refreshToken: async () => {
      throw new Error('TEST_ABORT_SILENT_REFRESH');
    },
  });
});

afterEach(() => {
  cleanup();
});

describe('App routing — TASK-3.1', () => {
  describe('unauthenticated', () => {
    it('does not show the editor chrome when visiting /editor without a session', async () => {
      render(
        <MemoryRouter initialEntries={['/editor']}>
          <AppRoutes />
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /^sign in$/i })).toBeInTheDocument();
      });
      expect(screen.queryByRole('button', { name: /^log out$/i })).not.toBeInTheDocument();
    });

    it('shows the sign-in screen at /login', () => {
      render(
        <MemoryRouter initialEntries={['/login']}>
          <AppRoutes />
        </MemoryRouter>,
      );

      expect(screen.getByRole('heading', { name: /^sign in$/i })).toBeInTheDocument();
    });

    it('shows the register screen at /register', () => {
      render(
        <MemoryRouter initialEntries={['/register']}>
          <AppRoutes />
        </MemoryRouter>,
      );

      expect(screen.getByRole('heading', { name: /create account/i })).toBeInTheDocument();
    });
  });

  describe('authenticated', () => {
    it('navigates from / to the editor shell when authenticated', async () => {
      useAuthStore.setState({
        user: sampleUser,
        accessToken: 'jwt',
        isAuthenticated: true,
        refreshToken: async () => {},
      });

      render(
        <MemoryRouter initialEntries={['/']}>
          <AppRoutes />
        </MemoryRouter>,
      );

      await waitFor(() => {
        const buttons = screen.getAllByRole('button', { name: /^log out$/i });
        expect(buttons.length).toBeGreaterThan(0);
      });
    });

    it('shows the editor when visiting /editor with a session', async () => {
      useAuthStore.setState({
        user: sampleUser,
        accessToken: 'jwt',
        isAuthenticated: true,
        refreshToken: async () => {},
      });

      render(
        <MemoryRouter initialEntries={['/editor']}>
          <AppRoutes />
        </MemoryRouter>,
      );

      await waitFor(() => {
        const buttons = screen.getAllByRole('button', { name: /^log out$/i });
        expect(buttons.length).toBeGreaterThan(0);
      });
    });
  });
});
