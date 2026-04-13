import { useEffect, useState, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';

import { LoginForm } from '../components/auth/LoginForm';
import { RegisterForm } from '../components/auth/RegisterForm';
import { ToastHost } from '../components/common/ToastHost';
import { ProjectListPage } from '../components/projects/ProjectListPage';
import { useAuthStore } from '../store/authStore';
import { EditorLayout } from './EditorLayout';

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
      try {
        await useAuthStore.getState().refreshToken();
        if (cancelled) return;
        if (location.pathname === '/' || location.pathname === '/login' || location.pathname === '/register') {
          navigate('/projects', { replace: true });
        }
      } catch {
        /* no valid refresh cookie */
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
    </AuthBootstrap>
  );
}
