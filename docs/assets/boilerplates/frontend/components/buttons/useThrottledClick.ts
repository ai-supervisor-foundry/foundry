import { useCallback, useRef, type MouseEvent } from 'react';
import { throttle } from '../../utils/throttle';

/**
 * Returns a throttled onClick handler. Ignores clicks within throttleMs of the last invocation.
 * Pass throttleMs={0} to disable throttling.
 * 
 * FIX: This implementation now correctly initializes on the first render and 
 * handles unstable onClick handlers by using a ref to the latest function.
 */
export function useThrottledClick(
  onClick: ((e: MouseEvent<HTMLButtonElement>) => void) | undefined,
  throttleMs: number = 500
): ((e: MouseEvent<HTMLButtonElement>) => void) | undefined {
  // Store the latest onClick in a ref so the throttled function always calls the current version
  const onClickRef = useRef(onClick);
  onClickRef.current = onClick;

  // Track the throttled function and the current limit
  const throttledRef = useRef<((e: MouseEvent<HTMLButtonElement>) => void) | null>(null);
  const lastLimitMs = useRef<number>(throttleMs);

  // Initialize or recreate throttle if limit changes
  if (!throttledRef.current || lastLimitMs.current !== throttleMs) {
    lastLimitMs.current = throttleMs;
    throttledRef.current = throttleMs > 0 
      ? (throttle((e: MouseEvent<HTMLButtonElement>) => {
          onClickRef.current?.(e);
        }, throttleMs) as (e: MouseEvent<HTMLButtonElement>) => void)
      : null;
  }

  return useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      if (!onClick) return;
      if (throttleMs <= 0 || !throttledRef.current) {
        onClick(e);
        return;
      }
      throttledRef.current(e);
    },
    [onClick === undefined, throttleMs] // eslint-disable-line react-hooks/exhaustive-deps
  );
}
