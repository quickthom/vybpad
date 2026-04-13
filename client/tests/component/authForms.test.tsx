/** @vitest-environment jsdom */

/*
 * QA COVERAGE PLAN — TASK-3.1 (criteria 2–3)
 *
 * Login/register: client-side validation (UX_GUIDELINES §5.9), inline errors (§5.2), submit wiring to auth store + endpoints.
 */

import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LoginForm } from '../../src/components/auth/LoginForm';
import { RegisterForm } from '../../src/components/auth/RegisterForm';

function jsonResponse(data: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(data), {
    status: init?.status ?? 200,
    headers: { 'Content-Type': 'application/json', ...(init?.headers as HeadersInit) },
  });
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
  vi.stubEnv('VITE_API_URL', 'http://api.test');
});

afterEach(() => {
  cleanup();
});

describe('LoginForm — TASK-3.1', () => {
  describe('error handling', () => {
    it('shows inline validation errors and does not call the API when email and password are empty on submit', async () => {
      render(
        <MemoryRouter>
          <LoginForm />
        </MemoryRouter>,
      );
      const user = userEvent.setup();

      await user.click(screen.getAllByRole('button', { name: /^sign in$/i })[0]!);

      expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);
      expect(vi.mocked(fetch)).not.toHaveBeenCalled();
    });
  });

  describe('happy path', () => {
    it('submits LoginRequest to POST /api/auth/login with entered credentials when valid', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        jsonResponse(
          {
            user: {
              id: 'u1',
              email: 'ada@example.com',
              displayName: 'Ada',
              createdAt: '2026-01-01T00:00:00.000Z',
            },
            accessToken: 'jwt',
          },
          { status: 200 },
        ),
      );

      render(
        <MemoryRouter>
          <LoginForm />
        </MemoryRouter>,
      );
      const user = userEvent.setup();

      await user.type(screen.getByRole('textbox', { name: /email/i }), 'ada@example.com');
      await user.type(screen.getByLabelText(/^password/i), 'password12');
      await user.click(screen.getAllByRole('button', { name: /^sign in$/i })[0]!);

      expect(vi.mocked(fetch).mock.calls[0]![0]).toBe('http://api.test/api/auth/login');
      expect((vi.mocked(fetch).mock.calls[0]![1] as RequestInit).method).toBe('POST');
      expect((vi.mocked(fetch).mock.calls[0]![1] as RequestInit).body).toBe(
        JSON.stringify({ email: 'ada@example.com', password: 'password12' }),
      );
    });
  });
});

describe('RegisterForm — TASK-3.1', () => {
  describe('error handling', () => {
    it('shows a password validation error when password is shorter than 8 characters', async () => {
      render(
        <MemoryRouter>
          <RegisterForm />
        </MemoryRouter>,
      );
      const user = userEvent.setup();

      await user.type(screen.getByRole('textbox', { name: /email/i }), 'new@example.com');
      await user.type(screen.getByRole('textbox', { name: /display name/i }), 'Neo');
      await user.type(screen.getByLabelText(/^password/i), 'short');
      await user.click(screen.getAllByRole('button', { name: /create account/i })[0]!);

      expect(screen.getByRole('alert')).toHaveTextContent(/8/i);
      expect(vi.mocked(fetch)).not.toHaveBeenCalled();
    });
  });

  describe('happy path', () => {
    it('submits RegisterRequest to POST /api/auth/register when fields are valid', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        jsonResponse(
          {
            user: {
              id: 'u1',
              email: 'new@example.com',
              displayName: 'Neo',
              createdAt: '2026-01-01T00:00:00.000Z',
            },
            accessToken: 'jwt',
          },
          { status: 201 },
        ),
      );

      render(
        <MemoryRouter>
          <RegisterForm />
        </MemoryRouter>,
      );
      const user = userEvent.setup();

      await user.type(screen.getByRole('textbox', { name: /email/i }), 'new@example.com');
      await user.type(screen.getByRole('textbox', { name: /display name/i }), 'Neo');
      await user.type(screen.getByLabelText(/^password/i), 'password12');
      await user.click(screen.getAllByRole('button', { name: /create account/i })[0]!);

      expect(vi.mocked(fetch).mock.calls[0]![0]).toBe('http://api.test/api/auth/register');
      expect((vi.mocked(fetch).mock.calls[0]![1] as RequestInit).body).toBe(
        JSON.stringify({
          email: 'new@example.com',
          password: 'password12',
          displayName: 'Neo',
        }),
      );
    });
  });
});
