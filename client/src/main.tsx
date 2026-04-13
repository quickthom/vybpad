import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import type {} from '@vybpad/shared';

import { App } from './App';
import { useAuthStore } from './store/authStore';
import { configureApiClient } from './utils/apiClient';
import './index.css';

configureApiClient({
  getAccessToken: () => useAuthStore.getState().accessToken,
  onAuthFailure: () => {
    useAuthStore.setState({ user: null, accessToken: null, isAuthenticated: false });
  },
  onAccessTokenRefreshed: (accessToken) => {
    useAuthStore.setState({ accessToken, isAuthenticated: true });
  },
});

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('Missing #root element');
}

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
