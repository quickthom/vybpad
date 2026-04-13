/**
 * TASK-3.1 — Login (INTERFACES.md LoginRequest). QA scaffold: layout only;
 * Builder adds validation (UX_GUIDELINES §5.9), submit wiring, and error display.
 */
export function LoginForm() {
  return (
    <div>
      <h1>Sign in</h1>
      <form
        onSubmit={(e) => {
          e.preventDefault();
        }}
      >
        <div>
          <label htmlFor="login-email">
            Email <span aria-hidden="true">*</span>
          </label>
          <input
            id="login-email"
            name="email"
            type="email"
            autoComplete="email"
            aria-required="true"
          />
        </div>
        <div>
          <label htmlFor="login-password">
            Password <span aria-hidden="true">*</span>
          </label>
          <input
            id="login-password"
            name="password"
            type="password"
            autoComplete="current-password"
            aria-required="true"
          />
        </div>
        <button type="submit">Sign in</button>
      </form>
    </div>
  );
}
