"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import type { ConsentRegion } from "../middleware";

const CONSENT_KEY = "cookie-consent";
const REGION_COOKIE = "__consent_region";
const CURRENT_CONSENT_VERSION = 1;
const CONSENT_MAX_AGE_MS = 180 * 24 * 60 * 60 * 1000; // 6 months

export type ConsentCategories = {
  necessary: true;
  analytics: boolean;
  translation: boolean;
};

type StoredConsent = {
  version: number;
  timestamp: number;
  categories: ConsentCategories;
};

export type ConsentStatus = "accepted" | "partial" | "declined" | null;

type CookieConsentContextValue = {
  consent: ConsentStatus;
  categories: ConsentCategories;
  region: ConsentRegion;
  acceptAll: () => void;
  declineAll: () => void;
  savePreferences: (cats: ConsentCategories) => void;
  preferencesOpen: boolean;
  openPreferences: () => void;
  closePreferences: () => void;
  bannerVisible: boolean;
};

const CookieConsentContext = createContext<CookieConsentContextValue | null>(
  null,
);

const DEFAULT_CATEGORIES: ConsentCategories = {
  necessary: true,
  analytics: false,
  translation: false,
};

const ALL_ACCEPTED: ConsentCategories = {
  necessary: true,
  analytics: true,
  translation: true,
};

function clearCookiesByName(name: string) {
  const paths = ["/"];
  const host = window.location.hostname;
  const domains = ["", host];
  const parts = host.split(".");
  if (parts.length > 2) {
    domains.push("." + parts.slice(-2).join("."));
  }
  for (const domain of domains) {
    for (const path of paths) {
      const domainPart = domain ? `;domain=${domain}` : "";
      document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=${path}${domainPart}`;
    }
  }
}

function deriveStatus(cats: ConsentCategories): ConsentStatus {
  if (cats.analytics && cats.translation) return "accepted";
  if (!cats.analytics && !cats.translation) return "declined";
  return "partial";
}

function isDoNotTrack(): boolean {
  if (typeof navigator === "undefined") return false;
  return navigator.doNotTrack === "1";
}

function isGlobalPrivacyControl(): boolean {
  if (typeof navigator === "undefined") return false;
  return (navigator as any).globalPrivacyControl === true;
}

function readRegionCookie(): ConsentRegion {
  if (typeof document === "undefined") return "strict";
  const match = document.cookie.match(
    new RegExp("(?:^|; )" + REGION_COOKIE + "=([^;]*)"),
  );
  const value = match ? match[1] : null;
  if (value === "strict" || value === "optout" || value === "notice") {
    return value;
  }
  return "strict"; // Safe default
}

function readStored(): StoredConsent | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredConsent;
  } catch {
    return null;
  }
}

function isConsentValid(stored: StoredConsent): boolean {
  if (stored.version !== CURRENT_CONSENT_VERSION) return false;
  if (Date.now() - stored.timestamp > CONSENT_MAX_AGE_MS) return false;
  return true;
}

/** Default categories for opt-out / notice regions (cookies load immediately) */
function getDefaultCategoriesForRegion(
  region: ConsentRegion,
): ConsentCategories {
  if (region === "strict") {
    return { ...DEFAULT_CATEGORIES };
  }
  // optout and notice: cookies load by default
  return { ...ALL_ACCEPTED };
}

export function CookieConsentProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [categories, setCategories] =
    useState<ConsentCategories>(DEFAULT_CATEGORIES);
  const [region, setRegion] = useState<ConsentRegion>("strict");
  const [bannerVisible, setBannerVisible] = useState(false);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const detectedRegion = readRegionCookie();
    setRegion(detectedRegion);

    const dnt = isDoNotTrack();
    const gpc = isGlobalPrivacyControl();
    const stored = readStored();

    if (stored && isConsentValid(stored)) {
      const cats = { ...stored.categories, necessary: true as const };
      // DNT or GPC → downgrade analytics
      if (dnt || gpc) cats.analytics = false;
      setCategories(cats);
      setBannerVisible(false);
    } else {
      // No valid stored consent
      const defaults = getDefaultCategoriesForRegion(detectedRegion);
      // GPC/DNT override
      if (dnt || gpc) defaults.analytics = false;

      if (detectedRegion === "strict") {
        // Must show banner and block cookies until consent
        setCategories({
          necessary: true,
          analytics: false,
          translation: false,
        });
        setBannerVisible(true);
      } else {
        // optout/notice: cookies load immediately, show informational banner
        setCategories(defaults);
        setBannerVisible(true);
      }
    }
    setInitialized(true);
  }, []);

  const persist = useCallback((cats: ConsentCategories) => {
    const data: StoredConsent = {
      version: CURRENT_CONSENT_VERSION,
      timestamp: Date.now(),
      categories: cats,
    };
    localStorage.setItem(CONSENT_KEY, JSON.stringify(data));
  }, []);

  const cleanup = useCallback((cats: ConsentCategories) => {
    if (typeof window === "undefined") return;
    if (!cats.translation) clearCookiesByName("googtrans");
  }, []);

  const acceptAll = useCallback(() => {
    const cats = { ...ALL_ACCEPTED };
    // Respect GPC/DNT even on "accept all"
    if (isDoNotTrack() || isGlobalPrivacyControl()) cats.analytics = false;
    setCategories(cats);
    persist(cats);
    setBannerVisible(false);
    setPreferencesOpen(false);
  }, [persist]);

  const declineAll = useCallback(() => {
    const cats: ConsentCategories = {
      necessary: true,
      analytics: false,
      translation: false,
    };
    setCategories(cats);
    persist(cats);
    cleanup(cats);
    setBannerVisible(false);
    setPreferencesOpen(false);
  }, [persist, cleanup]);

  const savePreferences = useCallback(
    (cats: ConsentCategories) => {
      const final = { ...cats, necessary: true as const };
      if (isDoNotTrack() || isGlobalPrivacyControl()) final.analytics = false;
      setCategories(final);
      persist(final);
      cleanup(final);
      setBannerVisible(false);
      setPreferencesOpen(false);
    },
    [persist, cleanup],
  );

  const openPreferences = useCallback(() => {
    setPreferencesOpen(true);
    setBannerVisible(true);
  }, []);

  const closePreferences = useCallback(() => {
    setPreferencesOpen(false);
    const stored = readStored();
    if (stored && isConsentValid(stored)) {
      setBannerVisible(false);
    }
  }, []);

  const consent = initialized ? deriveStatus(categories) : null;

  const value = useMemo(
    () => ({
      consent,
      categories,
      region,
      acceptAll,
      declineAll,
      savePreferences,
      preferencesOpen,
      openPreferences,
      closePreferences,
      bannerVisible,
    }),
    [
      consent,
      categories,
      region,
      acceptAll,
      declineAll,
      savePreferences,
      preferencesOpen,
      openPreferences,
      closePreferences,
      bannerVisible,
    ],
  );

  return (
    <CookieConsentContext.Provider value={value}>
      {children}
    </CookieConsentContext.Provider>
  );
}

export function useCookieConsent() {
  const ctx = useContext(CookieConsentContext);
  if (!ctx) {
    throw new Error(
      "useCookieConsent must be used within CookieConsentProvider",
    );
  }
  return ctx;
}
