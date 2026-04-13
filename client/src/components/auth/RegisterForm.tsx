/**
 * TASK-3.1 — Register (INTERFACES.md RegisterRequest). QA scaffold: layout only;
 * Builder adds validation and auth store wiring.
 */
export function RegisterForm() {
  return (
    <div>
      <h1>Create account</h1>
      <form
        onSubmit={(e) => {
          e.preventDefault();
        }}
      >
        <div>
          <label htmlFor="register-email">
            Email <span aria-hidden="true">*</span>
          </label>
          <input
            id="register-email"
            name="email"
            type="email"
            autoComplete="email"
            aria-required="true"
          />
        </div>
        <div>
          <label htmlFor="register-display-name">
            Display name <span aria-hidden="true">*</span>
          </label>
          <input
            id="register-display-name"
            name="displayName"
            type="text"
            autoComplete="nickname"
            aria-required="true"
          />
        </div>
        <div>
          <label htmlFor="register-password">
            Password <span aria-hidden="true">*</span>
          </label>
          <input
            id="register-password"
            name="password"
            type="password"
            autoComplete="new-password"
            aria-required="true"
          />
        </div>
        <button type="submit">Create account</button>
      </form>
    </div>
  );
}
