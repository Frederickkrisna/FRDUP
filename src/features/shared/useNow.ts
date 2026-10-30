import { useEffect, useState } from 'react';

/** Wall-clock `now` that re-renders every `intervalMs`. Keeps render pure (no Date.now() in render). */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
