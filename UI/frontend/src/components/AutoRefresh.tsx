// AutoRefresh Component
// Toggle auto-refresh, configurable interval, manual refresh button
import React, { useEffect, useRef } from 'react';

interface AutoRefreshProps {
  enabled: boolean;
  interval?: number;
  onRefresh: () => void | Promise<void>;
  children?: React.ReactNode;
}

export default function AutoRefresh({
  enabled,
  interval = 60000,
  onRefresh,
  children,
}: AutoRefreshProps) {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (enabled) {
      intervalRef.current = setInterval(() => {
        onRefresh();
      }, interval);

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
  }, [enabled, interval, onRefresh]);

  return <>{children}</>;
}

