import { useCallback, useEffect, useRef, useState } from 'react';

import { SleepTimer } from '@/services/sleepTimer';

/** A sleep timer that calls `onElapsed` (pause the story) when it runs out. Cleared on leaving the screen. */
export function useSleepTimer(onElapsed: () => void) {
  const latest = useRef(onElapsed);
  useEffect(() => {
    latest.current = onElapsed;
  });
  const timer = useRef<SleepTimer | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    const t = new SleepTimer(() => latest.current());
    timer.current = t;
    const unsubscribe = t.subscribe(setSecondsLeft);
    return () => {
      unsubscribe();
      t.cancel();
      timer.current = null;
    };
  }, []);

  const start = useCallback((minutes: number) => timer.current?.start(minutes), []);
  const cancel = useCallback(() => timer.current?.cancel(), []);
  return { secondsLeft, start, cancel };
}
