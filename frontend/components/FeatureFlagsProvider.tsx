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

  const refresh = useCallback(() => {
    fetchFeatureFlags()
      .then((fetched) => {
        setFlags(fetched);
        setHasLoadedOnce(true);
        setHasAttemptedOnce(true);
      })
      .catch((error) => {
        // Keep the last known-good `flags` map and `hasLoadedOnce` as-is —
        // one failed poll must not blank out every gated feature in every
        // open tab. Only mark the attempt as settled so `loading` resolves.
        console.error("Failed to refresh feature flags:", error);
        setHasAttemptedOnce(true);
      });
  }, []);

  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    refreshRef.current();

    const onAuthChange = () => refreshRef.current();
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
