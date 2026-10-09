"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { AUTH_EVENT } from "../services/api";
import { fetchFeatureFlags, FeatureFlagsMap } from "../services/featureFlags";

const POLL_INTERVAL_MS = 30_000;

type FeatureFlagsContextValue = {
  flags: FeatureFlagsMap;
  loading: boolean;
  isEnabled: (key: string) => boolean;
  refresh: () => void;
};

const FeatureFlagsContext = createContext<FeatureFlagsContextValue | null>(
  null,
);

export function FeatureFlagsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [flags, setFlags] = useState<FeatureFlagsMap>({});
  // hasLoadedOnce gates isEnabled() (fail-closed until we actually know
  // something). hasAttemptedOnce only gates `loading`, so a spinner built
  // on `loading` resolves even if the very first fetch fails — these are
  // deliberately two different flags, not one.
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [hasAttemptedOnce, setHasAttemptedOnce] = useState(false);

  // Mount, polling, an AUTH_EVENT refresh, and its 2s retry can all have a
  // fetch in flight at once. Without sequencing, a slower *older* request
  // (e.g. one started under the previous identity) can resolve after a
  // newer one and overwrite correct flags with stale data. Each call gets
  // the next sequence number; a response is only applied if no newer call
  // has started since — an older/superseded response is dropped silently.
  const requestSeqRef = useRef(0);

  // Returns whether the fetch succeeded, so callers that care about a
  // failure (see onAuthChange below) can react to it; routine polling
  // ignores the return value and just lets the next cycle try again. A
  // superseded response reports `true` (nothing to retry — a newer
  // request already owns this identity's refresh).
  const attemptRefresh = useCallback(async (): Promise<boolean> => {
    const seq = ++requestSeqRef.current;
    try {
      const fetched = await fetchFeatureFlags();
      if (seq !== requestSeqRef.current) return true;
      setFlags(fetched);
      setHasLoadedOnce(true);
      setHasAttemptedOnce(true);
      return true;
    } catch (error) {
      if (seq !== requestSeqRef.current) return true;
      // Keep the last known-good `flags` map and `hasLoadedOnce` as-is —
      // one failed poll must not blank out every gated feature in every
      // open tab. Only mark the attempt as settled so `loading` resolves.
      console.error("Failed to refresh feature flags:", error);
      setHasAttemptedOnce(true);
      return false;
    }
  }, []);

  const refresh = useCallback(() => {
    void attemptRefresh();
  }, [attemptRefresh]);

  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  const attemptRefreshRef = useRef(attemptRefresh);
  attemptRefreshRef.current = attemptRefresh;

  useEffect(() => {
    refreshRef.current();

    // Identity just changed (login/logout), which can flip cohort
    // membership (internal/premium) and the bucketing identity itself.
    // The previous identity's flags are not just stale here, they're
    // actively wrong for who's asking now — so reset to the fail-closed
    // "unknown" state immediately rather than let them linger while a
    // refresh (and its retry below) might still fail. isEnabled() already
    // reads `false` once hasLoadedOnce is false; clearing `flags` too
    // covers any consumer that reads the map directly instead.
    const onAuthChange = () => {
      setFlags({});
      setHasLoadedOnce(false);
      setHasAttemptedOnce(false);
      void attemptRefreshRef.current().then((ok) => {
        if (!ok) {
          setTimeout(() => {
            void attemptRefreshRef.current();
          }, 2_000);
        }
      });
    };
    window.addEventListener(AUTH_EVENT, onAuthChange);

    const interval = setInterval(() => refreshRef.current(), POLL_INTERVAL_MS);

    return () => {
      window.removeEventListener(AUTH_EVENT, onAuthChange);
      clearInterval(interval);
    };
  }, []);

  const isEnabled = useCallback(
    (key: string): boolean => {
      if (!hasLoadedOnce) return false;
      return flags[key] ?? false;
    },
    [flags, hasLoadedOnce],
  );

  const loading = !hasAttemptedOnce;

  const value = useMemo(
    () => ({ flags, loading, isEnabled, refresh }),
    [flags, loading, isEnabled, refresh],
  );

  return (
    <FeatureFlagsContext.Provider value={value}>
      {children}
    </FeatureFlagsContext.Provider>
  );
}

export function useFeatureFlags() {
  const ctx = useContext(FeatureFlagsContext);
  if (!ctx) {
    throw new Error(
      "useFeatureFlags must be used within FeatureFlagsProvider",
    );
  }
  return ctx;
}
