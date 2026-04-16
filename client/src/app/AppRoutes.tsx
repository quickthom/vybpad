import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';

import { ToastHost } from '../components/common/ToastHost';
import { useAuthStore } from '../store/authStore';
import { AuthViewportGate } from './AuthViewportGate';
import { ensureSessionBootstrapped } from './sessionBootstrap';

const LoginForm = lazy(() =>
  import('../components/auth/LoginForm').then((m) => ({ default: m.LoginForm })),
);
const RegisterForm = lazy(() =>
  import('../components/auth/RegisterForm').then((m) => ({ default: m.RegisterForm })),
);
const ProjectListPage = lazy(() =>
  import('../components/projects/ProjectListPage').then((m) => ({ default: m.ProjectListPage })),
);
const EditorViewportGate = lazy(() =>
  import('./EditorViewportGate').then((m) => ({ default: m.EditorViewportGate })),
);

/** Light-theme loading gate; matches session bootstrap styling (UX: minimal shell). */
function RouteLoadingFallback() {
  return (
    <div
      className="flex min-h-screen items-center justify-center bg-[var(--color-app-bg,#F3F4F6)] text-sm text-[var(--color-text-secondary,#4B5563)]"
      aria-busy="true"
    >
      Loading…
    </div>
  );
}

/**
 * Run cookie refresh before routing so `RequireAuth` does not redirect to `/login` on full reload
 * while the access token is still being restored. Without this gate, `/editor/:id` reload briefly
 * sees `isAuthenticated === false` and swaps the URL before refresh completes.
 *
 * After a successful refresh, only redirect from public entry routes (`/`, `/login`, `/register`).
 * Do not steal focus from deep links such as `/editor/:id` after a hard reload.
 */
function AuthBootstrap({ children }: { children: ReactNode }) {
  const [sessionReady, setSessionReady] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (useAuthStore.getState().accessToken) {
        if (!cancelled) setSessionReady(true);
        return;
      }
      await ensureSessionBootstrapped();
      if (cancelled) return;
      // Do not steal focus from deep links (`/editor/:id`) after a reload.
      // Only redirect from public entry routes once refresh succeeds.
      if (
        useAuthStore.getState().accessToken &&
        (location.pathname === '/' ||
          location.pathname === '/login' ||
          location.pathname === '/register')
      ) {
        navigate('/projects', { replace: true });
      }
      if (!cancelled) setSessionReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [location.pathname, navigate]);

  if (!sessionReady) {
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-[var(--color-app-bg,#F3F4F6)] text-sm text-[var(--color-text-secondary,#4B5563)]"
        aria-busy="true"
      >
        Loading session…
      </div>
    );
  }

  return <>{children}</>;
}

function RequireAuth({ children }: { children: ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [sessionChecked, setSessionChecked] = useState(() => !!useAuthStore.getState().accessToken);

  useEffect(() => {
    if (useAuthStore.getState().accessToken) {
      setSessionChecked(true);
      return;
    }
    let cancelled = false;
    void ensureSessionBootstrapped().finally(() => {
      if (!cancelled) setSessionChecked(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!sessionChecked) {
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-[var(--color-app-bg,#F3F4F6)] px-4 text-sm text-[var(--color-text-secondary,#4B5563)]"
        role="status"
        aria-live="polite"
      >
        Loading session…
      </div>
    );
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

function RootRedirect() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return <Navigate to={isAuthenticated ? '/projects' : '/login'} replace />;
}

export function AppRoutes() {
  return (
    <AuthBootstrap>
      <ToastHost />
      <Suspense fallback={<RouteLoadingFallback />}>
        <Routes>
          <Route
            path="/login"
            element={
              <AuthViewportGate>
                <div className="flex min-h-screen items-center justify-center bg-[var(--color-app-bg,#F3F4F6)] px-4 py-12 font-[ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe_UI',Roboto,'Helvetica_Neue',Arial,'Noto_Sans',sans-serif]">
                  <LoginForm />
                </div>
              </AuthViewportGate>
            }
          />
          <Route
            path="/register"
            element={
              <AuthViewportGate>
                <div className="flex min-h-screen items-center justify-center bg-[var(--color-app-bg,#F3F4F6)] px-4 py-12 font-[ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe_UI',Roboto,'Helvetica_Neue',Arial,'Noto_Sans',sans-serif]">
                  <RegisterForm />
                </div>
              </AuthViewportGate>
            }
          />
          <Route
            path="/editor/:projectId"
            element={
              <RequireAuth>
                <EditorViewportGate />
              </RequireAuth>
            }
          />
          <Route
            path="/editor"
            element={
              <RequireAuth>
                <EditorViewportGate />
              </RequireAuth>
            }
          />
          <Route
            path="/projects"
            element={
              <RequireAuth>
                <ProjectListPage />
              </RequireAuth>
            }
          />
          <Route path="/" element={<RootRedirect />} />
          <Route path="*" element={<RootRedirect />} />
        </Routes>
      </Suspense>
    </AuthBootstrap>
  );
}
