import { type FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useAuthStore } from '../../store/authStore';
import { getApiErrorMessage } from '../../utils/errorMessages';

/**
 * TASK-3.1 — Login (INTERFACES.md LoginRequest). UX §5.9; §3 max-width 480px.
 */
export function LoginForm() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email.trim(), password);
      navigate('/projects', { replace: true });
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full max-w-[480px] rounded-xl border border-[var(--color-border,#E5E7EB)] bg-[var(--color-surface,#FFFFFF)] p-6 shadow-sm">
      <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-text-primary,#111827)]">Sign in</h1>
      {error ? (
        <p role="alert" className="mt-4 text-sm text-[var(--color-destructive,#DC2626)]">
          {error}
        </p>
      ) : null}
      <form onSubmit={(e) => void onSubmit(e)} className="mt-6 flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label htmlFor="login-email" className="text-sm font-medium text-[var(--color-text-primary,#111827)]">
            Email <span aria-hidden="true">*</span>
          </label>
          <input
            id="login-email"
            name="email"
            type="email"
            autoComplete="email"
            aria-required="true"
            value={email}
            onChange={(ev) => setEmail(ev.target.value)}
            className="h-10 rounded-lg border border-[var(--color-border,#E5E7EB)] bg-[var(--color-surface,#FFFFFF)] px-3 text-sm outline-none transition hover:border-[var(--color-border-strong,#D1D5DB)] focus:border-[var(--color-primary,#4F46E5)] focus:shadow-[0_0_0_1px_var(--color-primary,#4F46E5)]"
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="login-password" className="text-sm font-medium text-[var(--color-text-primary,#111827)]">
            Password <span aria-hidden="true">*</span>
          </label>
          <input
            id="login-password"
            name="password"
            type="password"
            autoComplete="current-password"
            aria-required="true"
            value={password}
            onChange={(ev) => setPassword(ev.target.value)}
            className="h-10 rounded-lg border border-[var(--color-border,#E5E7EB)] bg-[var(--color-surface,#FFFFFF)] px-3 text-sm outline-none transition hover:border-[var(--color-border-strong,#D1D5DB)] focus:border-[var(--color-primary,#4F46E5)] focus:shadow-[0_0_0_1px_var(--color-primary,#4F46E5)]"
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="mt-2 inline-flex h-10 w-full items-center justify-center rounded-lg bg-[var(--color-primary,#4F46E5)] px-4 text-sm font-medium text-[var(--color-text-on-primary,#FFFFFF)] outline-none transition hover:bg-[var(--color-primary-hover,#4338CA)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-[var(--color-text-secondary,#4B5563)]">
        No account?{' '}
        <Link to="/register" className="font-medium text-[var(--color-primary,#4F46E5)] underline-offset-2 hover:underline">
          Create account
        </Link>
      </p>
    </div>
  );
}
