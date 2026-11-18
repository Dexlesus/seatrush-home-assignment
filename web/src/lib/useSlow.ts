import { useEffect, useState } from 'react';

/** True once `busy` has lasted longer than `afterMs`: "the server is slow". */
export function useSlow(busy: boolean, afterMs = 2500): boolean {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (!busy) {
      return undefined;
    }
    const timer = setTimeout(() => setSlow(true), afterMs);
    return () => {
      clearTimeout(timer);
      setSlow(false);
    };
  }, [busy, afterMs]);

  return busy && slow;
}
