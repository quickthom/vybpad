import { type FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useAuthStore } from '../../store/authStore';
import { getApiErrorMessage } from '../../utils/errorMessages';

type RegisterField = 'email' | 'displayName' | 'password';

function validateRegister(
  email: string,
  password: string,
  displayName: string,
): Record<string, string> {
  const fields: Record<string, string> = {};
  const e = email.trim();
  const name = displayName.trim();
  if (!e) fields.email = 'Email is required.';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) fields.email = 'Enter a valid email address.';
  if (!name) fields.displayName = 'Display name is required.';
  else if (name.length > 50) fields.displayName = 'Display name must be 50 characters or fewer.';
  if (!password) fields.password = 'Password is required.';
  else if (password.length < 8) fields.password = 'Password must be at least 8 characters.';
  else if (password.length > 128) fields.password = 'Password must be 128 characters or fewer.';
  return fields;
}

/**
 * Register — INTERFACES.md RegisterRequest; validation and errors per UX_GUIDELINES §5.2 / §5.9.
 */
export function RegisterForm() {
  const navigate = useNavigate();
  const register = useAuthStore((s) => s.register);

  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [touched, setTouched] = useState<Partial<Record<RegisterField, boolean>>>({});

  function mergeFieldFromValidation(field: RegisterField, next: Record<string, string>) {
    setFieldErrors((prev) => {
      const p = { ...prev };
      if (next[field]) p[field] = next[field]!;
      else delete p[field];
      return p;
    });
  }

  function handleBlur(field: RegisterField) {
    setTouched((t) => ({ ...t, [field]: true }));
    const next = validateRegister(email, password, displayName);
    mergeFieldFromValidation(field, next);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const next = validateRegister(email, password, displayName);
    setFieldErrors(next);
    if (Object.keys(next).length > 0) {
      setTouched({ email: true, displayName: true, password: true });
      return;
    }

    setSubmitting(true);
    try {
      await register(email.trim(), password, displayName);
      navigate('/projects', { replace: true });
    } catch (err) {
      setFormError(getApiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  const showEmailError = Boolean(fieldErrors.email && touched.email);
  const showDisplayNameError = Boolean(fieldErrors.displayName && touched.displayName);
  const showPasswordError = Boolean(fieldErrors.password && touched.password);

  return (
    <div className="w-full max-w-[480px] rounded-xl border border-[var(--color-border,#E5E7EB)] bg-[var(--color-surface,#FFFFFF)] p-6 shadow-sm">
      <h1 className="mb-6 text-2xl font-semibold leading-tight tracking-tight text-[var(--color-text-primary,#111827)]">
        Create account
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
            htmlFor="register-email"
          >
            Email <span aria-hidden="true">*</span>
          </label>
          <input
            id="register-email"
            name="email"
            type="email"
            autoComplete="email"
            aria-required="true"
            aria-invalid={showEmailError}
            aria-describedby={showEmailError ? 'register-email-error' : undefined}
            className="h-10 w-full rounded-lg border border-[var(--color-border,#E5E7EB)] bg-[var(--color-surface,#FFFFFF)] px-3 text-sm text-[var(--color-text-primary,#111827)] outline-none hover:border-[var(--color-border-strong,#D1D5DB)] focus:border-[var(--color-primary,#4F46E5)] focus:shadow-[0_0_0_1px_var(--color-primary,#4F46E5)]"
            value={email}
            onChange={(ev) => {
              const v = ev.target.value;
              setEmail(v);
              if (touched.email) mergeFieldFromValidation('email', validateRegister(v, password, displayName));
            }}
            onBlur={() => handleBlur('email')}
          />
          {showEmailError ? (
            <p id="register-email-error" className="text-xs leading-snug text-[var(--color-destructive,#DC2626)]" role="alert">
              {fieldErrors.email}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-2">
          <label
            className="text-[13px] font-medium leading-snug tracking-wide text-[var(--color-text-primary,#111827)]"
            htmlFor="register-display-name"
          >
            Display name <span aria-hidden="true">*</span>
          </label>
          <input
            id="register-display-name"
            name="displayName"
            type="text"
            autoComplete="nickname"
            aria-required="true"
            aria-invalid={showDisplayNameError}
            aria-describedby={showDisplayNameError ? 'register-display-name-error' : undefined}
            className="h-10 w-full rounded-lg border border-[var(--color-border,#E5E7EB)] bg-[var(--color-surface,#FFFFFF)] px-3 text-sm text-[var(--color-text-primary,#111827)] outline-none hover:border-[var(--color-border-strong,#D1D5DB)] focus:border-[var(--color-primary,#4F46E5)] focus:shadow-[0_0_0_1px_var(--color-primary,#4F46E5)]"
            value={displayName}
            onChange={(ev) => {
              const v = ev.target.value;
              setDisplayName(v);
              if (touched.displayName)
                mergeFieldFromValidation('displayName', validateRegister(email, password, v));
            }}
            onBlur={() => handleBlur('displayName')}
          />
          {showDisplayNameError ? (
            <p
              id="register-display-name-error"
              className="text-xs leading-snug text-[var(--color-destructive,#DC2626)]"
              role="alert"
            >
              {fieldErrors.displayName}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-2">
          <label
            className="text-[13px] font-medium leading-snug tracking-wide text-[var(--color-text-primary,#111827)]"
            htmlFor="register-password"
          >
            Password <span aria-hidden="true">*</span>
          </label>
          <input
            id="register-password"
            name="password"
            type="password"
            autoComplete="new-password"
            aria-required="true"
            aria-invalid={showPasswordError}
            aria-describedby={showPasswordError ? 'register-password-error' : undefined}
            className="h-10 w-full rounded-lg border border-[var(--color-border,#E5E7EB)] bg-[var(--color-surface,#FFFFFF)] px-3 text-sm text-[var(--color-text-primary,#111827)] outline-none hover:border-[var(--color-border-strong,#D1D5DB)] focus:border-[var(--color-primary,#4F46E5)] focus:shadow-[0_0_0_1px_var(--color-primary,#4F46E5)]"
            value={password}
            onChange={(ev) => {
              const v = ev.target.value;
              setPassword(v);
              if (touched.password) mergeFieldFromValidation('password', validateRegister(email, v, displayName));
            }}
            onBlur={() => handleBlur('password')}
          />
          {showPasswordError ? (
            <p id="register-password-error" className="text-xs leading-snug text-[var(--color-destructive,#DC2626)]" role="alert">
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
          className="mt-2 inline-flex h-10 w-full items-center justify-center rounded-lg bg-[var(--color-primary,#4F46E5)] px-4 text-sm font-medium text-[var(--color-text-on-primary,#FFFFFF)] hover:bg-[var(--color-primary-hover,#4338CA)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring,#4F46E5)] disabled:cursor-not-allowed disabled:bg-[var(--color-surface-muted,#F9FAFB)] disabled:text-[var(--color-text-muted,#9CA3AF)]"
        >
          {submitting ? 'Creating account…' : 'Create account'}
        </button>
        <p className="text-center text-sm text-[var(--color-text-secondary,#4B5563)]">
          Already have an account?{' '}
          <Link className="font-medium text-[var(--color-primary,#4F46E5)] hover:underline" to="/login">
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );
}
