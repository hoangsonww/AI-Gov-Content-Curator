import { BASE_URL, getAuthToken } from "./api";

export type FeatureFlagsMap = Record<string, boolean>;

const ANON_ID_KEY = "ff_anon_id";

/**
 * SSR-safe anonymous id for logged-out percentage bucketing. Client-side
 * only — a logged-out user can reset/fabricate this at will, so it must
 * never be used for anything beyond statistically distributing a rollout.
 */
export const getAnonymousId = (): string => {
  if (typeof window === "undefined") return "ssr";
  try {
    let id = localStorage.getItem(ANON_ID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(ANON_ID_KEY, id);
    }
    return id;
  } catch {
    // localStorage unavailable (private mode, blocked, etc.) — fall back to
    // a per-call random id rather than throwing.
    return crypto.randomUUID();
  }
};

/**
 * Throws on any network/parse/non-2xx failure — must NOT swallow errors
 * into an empty object, since {} would be indistinguishable from "fetched
 * successfully, no flags exist" once the caller applies fail-closed logic.
 */
export async function fetchFeatureFlags(): Promise<FeatureFlagsMap> {
  const token = getAuthToken();
  const res = await fetch(`${BASE_URL}/flags/evaluate`, {
    headers: {
      ...(token ? { Authorization: token } : {}),
      "x-anonymous-id": getAnonymousId(),
    },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch feature flags: ${res.status}`);
  }
  const data = await res.json();
  return data.flags ?? {};
}

/**
 * Shared header helper for any frontend call to a `requireFeatureFlag`-gated
 * backend route. A caller missing these headers is only let through once a
 * flag reaches 100% rollout (see FEATURE_FLAGS.md), so it would work today
 * and silently break the moment a partial rollout starts — use this instead
 * of inlining headers per call site.
 */
export const gatedRequestHeaders = (): Record<string, string> => {
  const token = getAuthToken();
  return {
    ...(token ? { Authorization: token } : {}),
    "x-anonymous-id": getAnonymousId(),
  };
};
