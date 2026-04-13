import { useCallback, useEffect, useState } from 'react';

import type { ProjectSummary } from '@vybpad/shared';

import { getApiErrorMessage } from '../utils/errorMessages';
import { projectsApi } from '../utils/apiClient';

type LoadStatus = 'loading' | 'ready' | 'error';

/**
 * Loads and refreshes the authenticated user's project list (GET /api/projects).
 */
export function useProjects() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setStatus('loading');
    setErrorMessage(null);
    try {
      const { projects: rows } = await projectsApi.list();
      setProjects(rows);
      setStatus('ready');
    } catch (e) {
      setErrorMessage(getApiErrorMessage(e));
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { projects, status, errorMessage, refresh };
}
