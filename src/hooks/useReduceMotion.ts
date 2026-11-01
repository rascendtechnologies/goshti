import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/** True when the phone's "reduce motion" setting is on — animations stay off then. */
export function useReduceMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((r) => active && setReduce(r))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', setReduce);
    return () => {
      active = false;
      sub?.remove();
    };
  }, []);
  return reduce;
}
