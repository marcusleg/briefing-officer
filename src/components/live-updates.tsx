"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const REFRESH_THROTTLE_MS = 2_000;

/** How long after the reader presses Refresh new articles merge in on their own. */
export const USER_REFRESH_WINDOW_MS = 5 * 60_000;

interface LiveUpdatesContextValue {
  /** True for a short while after the reader asked for a refresh themselves. */
  userRefreshActive: boolean;
  noteUserRefresh: () => void;
}

export const LiveUpdatesContext = createContext<LiveUpdatesContextValue>({
  userRefreshActive: false,
  noteUserRefresh: () => {},
});

export const useLiveUpdates = () => useContext(LiveUpdatesContext);

/**
 * Keeps the page in step with the background worker. Every "changed" event
 * from /api/events re-renders the server components through
 * `router.refresh()`, throttled so a burst of finished jobs costs one refresh
 * every two seconds and the last event is never dropped.
 */
const LiveUpdates = ({ children }: { children: ReactNode }) => {
  const router = useRouter();
  const [userRefreshActive, setUserRefreshActive] = useState(false);
  const windowTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  const noteUserRefresh = useCallback(() => {
    setUserRefreshActive(true);
    clearTimeout(windowTimer.current);
    windowTimer.current = setTimeout(
      () => setUserRefreshActive(false),
      USER_REFRESH_WINDOW_MS,
    );
  }, []);

  useEffect(() => () => clearTimeout(windowTimer.current), []);

  useEffect(() => {
    if (typeof EventSource === "undefined") {
      return;
    }

    let lastRefreshAt = 0;
    let trailing: ReturnType<typeof setTimeout> | undefined;

    const refresh = () => {
      lastRefreshAt = Date.now();
      trailing = undefined;
      router.refresh();
    };

    const source = new EventSource("/api/events");
    source.onmessage = () => {
      const elapsed = Date.now() - lastRefreshAt;
      if (elapsed >= REFRESH_THROTTLE_MS) {
        refresh();
      } else if (!trailing) {
        trailing = setTimeout(refresh, REFRESH_THROTTLE_MS - elapsed);
      }
    };

    return () => {
      source.close();
      clearTimeout(trailing);
    };
  }, [router]);

  const value = useMemo(
    () => ({ userRefreshActive, noteUserRefresh }),
    [userRefreshActive, noteUserRefresh],
  );

  return (
    <LiveUpdatesContext.Provider value={value}>
      {children}
    </LiveUpdatesContext.Provider>
  );
};

export default LiveUpdates;
