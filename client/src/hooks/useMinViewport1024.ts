import { useEffect, useState } from 'react';

const QUERY = '(min-width: 1024px)';

function getMatches(): boolean {
  if (typeof window === 'undefined') return true;
  return window.matchMedia?.(QUERY)?.matches ?? true;
}

/** UX §4 — minimum supported width 1024px; below that, callers should show a blocking message. */
export function useMinViewport1024(): boolean {
  const [ok, setOk] = useState(getMatches);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') {
      setOk(true);
      return;
    }
    const mq = window.matchMedia(QUERY);
    setOk(mq.matches);
    const onChange = () => setOk(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return ok;
}
