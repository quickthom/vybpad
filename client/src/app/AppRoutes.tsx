import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';

import { LoginForm } from '../components/auth/LoginForm';
import { RegisterForm } from '../components/auth/RegisterForm';
import { ToastHost } from '../components/common/ToastHost';
import { ProjectListPage } from '../components/projects/ProjectListPage';
import { useAuthStore } from '../store/authStore';
import { EditorLayout } from './EditorLayout';

const SessionHydratedContext = createContext(false);

/**
 * One refresh attempt on startup (httpOnly cookie) so deep links to `/editor/:id` work after reload.
 * Must finish before RequireAuth runs — otherwise we redirect to /login before refresh completes.
 * Only auto-navigate to `/projects` from auth forms when refresh succeeds (not from editor/projects).
 */
function useSessionHydration(navigate: ReturnType<typeof useNavigate>): boolean {
  const [hydrated, setHydrated] = useState(() => Boolean(useAuthStore.getState().accessToken));

  useEffect(() => {
    if (useAuthStore.getState().accessToken) {
      return;
    }

    let cancelled = false;
    const pathAtStart = window.location.pathname;

    void (async () => {
      try {
        await useAuthStore.getState().refreshToken();
        if (cancelled) return;
        if (pathAtStart === '/login' || pathAtStart === '/register') {
          navigate('/projects', { replace: true });
        }
      } catch {
        /* stay on current route */
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return hydrated;
}

function RequireAuth({ children }: { children: ReactNode }) {
  const sessionHydrated = useContext(SessionHydratedContext);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!sessionHydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-app-bg,#F3F4F6)] text-sm text-[var(--color-text-secondary,#4B5563)]">
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
  const sessionHydrated = useContext(SessionHydratedContext);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!sessionHydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-app-bg,#F3F4F6)] text-sm text-[var(--color-text-secondary,#4B5563)]">
        Loading session…
      </div>
    );
  }
  return <Navigate to={isAuthenticated ? '/projects' : '/login'} replace />;
}

export function AppRoutes() {
  const navigate = useNavigate();
  const sessionHydrated = useSessionHydration(navigate);

  return (
    <SessionHydratedContext.Provider value={sessionHydrated}>
      <ToastHost />
      <Routes>
        <Route
          path="/login"
          element={
            <div className="flex min-h-screen items-center justify-center bg-[var(--color-app-bg,#F3F4F6)] px-4 py-12 font-[ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe_UI',Roboto,'Helvetica_Neue',Arial,'Noto_Sans',sans-serif]">
              <LoginForm />
            </div>
          }
        />
        <Route
          path="/register"
          element={
            <div className="flex min-h-screen items-center justify-center bg-[var(--color-app-bg,#F3F4F6)] px-4 py-12 font-[ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe_UI',Roboto,'Helvetica_Neue',Arial,'Noto_Sans',sans-serif]">
              <RegisterForm />
            </div>
          }
        />
        <Route
          path="/editor/:projectId"
          element={
            <RequireAuth>
              <EditorLayout />
            </RequireAuth>
          }
        />
        <Route
          path="/editor"
          element={
            <RequireAuth>
              <EditorLayout />
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
    </SessionHydratedContext.Provider>
  );
}
