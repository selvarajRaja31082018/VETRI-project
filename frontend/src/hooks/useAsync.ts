import { useCallback, useEffect, useRef, useState } from 'react';
import { getErrorMessage } from '../utils/errors';

interface AsyncState<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Runs `fetcher` whenever `deps` change, tracking loading/error state and
 * ignoring results from a request that a newer call has superseded.
 */
export function useAsync<T>(fetcher: () => Promise<T>, deps: unknown[]): AsyncState<T> & { reload: () => void } {
  const [state, setState] = useState<AsyncState<T>>({ data: null, isLoading: true, error: null });
  const requestId = useRef(0);

  const load = useCallback(() => {
    const id = ++requestId.current;
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    fetcher()
      .then((data) => {
        if (id === requestId.current) setState({ data, isLoading: false, error: null });
      })
      .catch((error) => {
        if (id === requestId.current) setState({ data: null, isLoading: false, error: getErrorMessage(error) });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    load();
  }, [load]);

  return { ...state, reload: load };
}
