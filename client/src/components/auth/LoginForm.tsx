import { type FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useAuthStore } from '../../store/authStore';
import { getApiErrorMessage } from '../../utils/errorMessages';

type LoginField = 'email' | 'password';

function validateLogin(email: string, password: string): Record<string, string> {
  const fields: Record<string, string> = {};
  const e = email.trim();
  if (!e) fields.email = 'Email is required.';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) fields.email = 'Enter a valid email address.';
  if (!password) fields.password = 'Password is required.';
  return fields;
}

/**
 * Login — INTERFACES.md LoginRequest; validation and errors per UX_GUIDELINES §5.2 / §5.9.
 */
export function LoginForm() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [touched, setTouched] = useState<Partial<Record<LoginField, boolean>>>({});

  function mergeFieldFromValidation(field: LoginField, next: Record<string, string>) {
    setFieldErrors((prev) => {
      const p = { ...prev };
      if (next[field]) p[field] = next[field]!;
      else delete p[field];
      return p;
    });
  }

  function handleBlur(field: LoginField) {
    setTouched((t) => ({ ...t, [field]: true }));
    const next = validateLogin(email, password);
    mergeFieldFromValidation(field, next);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const next = validateLogin(email, password);
    setFieldErrors(next);
    if (Object.keys(next).length > 0) {
      setTouched({ email: true, password: true });
      return;
    }

    setSubmitting(true);
    try {
      await login(email.trim(), password);
      navigate('/projects', { replace: true });
    } catch (err) {
      setFormError(getApiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  const showEmailError = Boolean(fieldErrors.email && touched.email);
  const showPasswordError = Boolean(fieldErrors.password && touched.password);

  return (
    <div className="w-full max-w-[480px] rounded-xl border border-[var(--color-border,#E5E7EB)] bg-[var(--color-surface,#FFFFFF)] p-6 shadow-sm">
      <h1 className="mb-6 text-2xl font-semibold leading-tight tracking-tight text-[var(--color-text-primary,#111827)]">
        Sign in
      </h1>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          void handleSubmit(e);
        }}
        noValidate
      >
        <div className="flex flex-col gap-2">
          <label
            className="text-[13px] font-medium leading-snug tracking-wide text-[var(--color-text-primary,#111827)]"
            htmlFor="login-email"
          >
            Email <span aria-hidden="true">*</span>
          </label>
          <input
            id="login-email"
            name="email"
            type="email"
            autoComplete="email"
            aria-required="true"
            aria-invalid={showEmailError}
            aria-describedby={showEmailError ? 'login-email-error' : undefined}
            className="h-10 w-full rounded-lg border border-[var(--color-border,#E5E7EB)] bg-[var(--color-surface,#FFFFFF)] px-3 text-sm text-[var(--color-text-primary,#111827)] outline-none hover:border-[var(--color-border-strong,#D1D5DB)] focus:border-[var(--color-primary,#4F46E5)] focus:shadow-[0_0_0_1px_var(--color-primary,#4F46E5)]"
            value={email}
            onChange={(ev) => {
              const v = ev.target.value;
              setEmail(v);
              if (touched.email) mergeFieldFromValidation('email', validateLogin(v, password));
            }}
            onBlur={() => handleBlur('email')}
          />
          {showEmailError ? (
            <p id="login-email-error" className="text-xs leading-snug text-[var(--color-destructive,#DC2626)]" role="alert">
              {fieldErrors.email}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-2">
          <label
            className="text-[13px] font-medium leading-snug tracking-wide text-[var(--color-text-primary,#111827)]"
            htmlFor="login-password"
          >
            Password <span aria-hidden="true">*</span>
          </label>
          <input
            id="login-password"
            name="password"
            type="password"
            autoComplete="current-password"
            aria-required="true"
            aria-invalid={showPasswordError}
            aria-describedby={showPasswordError ? 'login-password-error' : undefined}
            className="h-10 w-full rounded-lg border border-[var(--color-border,#E5E7EB)] bg-[var(--color-surface,#FFFFFF)] px-3 text-sm text-[var(--color-text-primary,#111827)] outline-none hover:border-[var(--color-border-strong,#D1D5DB)] focus:border-[var(--color-primary,#4F46E5)] focus:shadow-[0_0_0_1px_var(--color-primary,#4F46E5)]"
            value={password}
            onChange={(ev) => {
              const v = ev.target.value;
              setPassword(v);
              if (touched.password) mergeFieldFromValidation('password', validateLogin(email, v));
            }}
            onBlur={() => handleBlur('password')}
          />
          {showPasswordError ? (
            <p id="login-password-error" className="text-xs leading-snug text-[var(--color-destructive,#DC2626)]" role="alert">
              {fieldErrors.password}
            </p>
          ) : null}
        </div>
        {formError ? (
          <p className="text-xs leading-snug text-[var(--color-destructive,#DC2626)]" role="alert">
            {formError}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={submitting}
          className="mt-2 inline-flex h-10 w-full items-center justify-center rounded-lg bg-[var(--color-primary,#4F46E5)] px-4 text-sm font-medium text-[var(--color-text-on-primary,#FFFFFF)] outline-none hover:bg-[var(--color-primary-hover,#4338CA)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#4F46E5)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-[var(--color-surface-muted,#F9FAFB)] disabled:text-[var(--color-text-muted,#9CA3AF)]"
        >
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
        <p className="text-center text-sm text-[var(--color-text-secondary,#4B5563)]">
          Need an account?{' '}
          <Link className="font-medium text-[var(--color-primary,#4F46E5)] hover:underline" to="/register">
            Register
          </Link>
        </p>
      </form>
    </div>
  );
}
