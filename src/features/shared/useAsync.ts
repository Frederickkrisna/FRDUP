import { useCallback, useEffect, useRef, useState } from 'react';

export type AsyncState<T> =
  | { status: 'loading'; data: T | null; error: null }
  | { status: 'ready'; data: T; error: null }
  | { status: 'error'; data: T | null; error: unknown };

/**
 * Minimal loader for one-shot reads (history, profile charts). Keeps the last good data visible
 * while reloading, ignores stale responses, and exposes `reload` for retry buttons.
 * Live data (roster, session) uses Firestore listeners instead.
 */
export function useAsync<T>(load: () => Promise<T>, deps: ReadonlyArray<unknown>): AsyncState<T> & { reload: () => void } {
  const [state, setState] = useState<AsyncState<T>>({ status: 'loading', data: null, error: null });
  const [nonce, setNonce] = useState(0);
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset to loading when the inputs change
    setState((s) => ({ status: 'loading', data: s.data, error: null }));
    loadRef.current().then(
      (data) => {
        if (!cancelled) setState({ status: 'ready', data, error: null });
      },
      (error: unknown) => {
        if (!cancelled) setState((s) => ({ status: 'error', data: s.data, error }));
      },
    );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deps are supplied by the caller
  }, [...deps, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { ...state, reload } as AsyncState<T> & { reload: () => void };
}
