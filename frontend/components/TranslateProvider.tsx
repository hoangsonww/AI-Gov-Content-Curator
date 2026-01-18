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
import { useRouter } from "next/router";

const SCRIPT_ID = "google-translate-script";
const STORAGE_LANG_KEY = "app-translate-language";
const DEFAULT_LANG = "en";

type TranslateOption = { value: string; label: string };

type TranslateContextValue = {
  ready: boolean;
  error: boolean;
  language: string;
  options: TranslateOption[];
  setLanguage: (lang: string) => void;
  resetLanguage: () => void;
};

const TranslateContext = createContext<TranslateContextValue | null>(null);

declare global {
  interface Window {
    googleTranslateElementInit?: () => void;
    google?: {
      translate?: {
        TranslateElement: new (
          options: { pageLanguage: string; autoDisplay?: boolean },
          containerId: string,
        ) => void;
      };
    };
    __googleTranslateInitialized?: boolean;
  }
}

export function TranslateProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const [language, setLanguageState] = useState(DEFAULT_LANG);
  const [options, setOptions] = useState<TranslateOption[]>([]);
  const comboListenerAttached = useRef(false);
  const languageRef = useRef(language);

  useEffect(() => {
    languageRef.current = language;
  }, [language]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const storedLang = localStorage.getItem(STORAGE_LANG_KEY);
      if (storedLang) setLanguageState(storedLang);
    } catch {}
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(STORAGE_LANG_KEY, language);
    } catch {}
  }, [language]);

  const setGoogTransCookie = useCallback((lang: string) => {
    if (typeof window === "undefined") return;
    const value = `/auto/${lang}`;
    document.cookie = `googtrans=${value};path=/`;
    const host = window.location.hostname;
    if (host && host !== "localhost") {
      document.cookie = `googtrans=${value};domain=${host};path=/`;
    }
  }, []);

  const applyLanguage = useCallback(
    (lang: string) => {
      if (typeof window === "undefined") return;
      if (!lang) return;
      setGoogTransCookie(lang);
      const combo = document.querySelector(
        ".goog-te-combo",
      ) as HTMLSelectElement | null;
      if (combo && combo.value !== lang) {
        combo.value = lang;
        combo.dispatchEvent(new Event("change"));
      }
    },
    [setGoogTransCookie],
  );

  const setLanguage = useCallback(
    (lang: string) => {
      setLanguageState(lang);
      setGoogTransCookie(lang);
      if (ready) applyLanguage(lang);
    },
    [ready, applyLanguage, setGoogTransCookie],
  );

  const resetLanguage = useCallback(() => {
    setLanguage(DEFAULT_LANG);
  }, [setLanguage]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const initTranslateElement = () => {
      if (window.__googleTranslateInitialized) {
        setReady(true);
        return;
      }
      if (!window.google?.translate?.TranslateElement) return;
      const container = document.getElementById("google_translate_element");
      if (!container) return;
      window.__googleTranslateInitialized = true;
      new window.google.translate.TranslateElement(
        { pageLanguage: "en", autoDisplay: false },
        "google_translate_element",
      );
      setReady(true);
    };

    window.googleTranslateElementInit = initTranslateElement;

    if (window.google?.translate?.TranslateElement) {
      initTranslateElement();
      return;
    }

    const existing = document.getElementById(SCRIPT_ID);
    if (existing) return;

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src =
      "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
    script.async = true;
    script.onerror = () => setError(true);
    document.body.appendChild(script);
  }, []);

  useEffect(() => {
    if (!ready || typeof window === "undefined") return;
    let attempts = 0;
    const interval = window.setInterval(() => {
      if (attempts > 20) {
        window.clearInterval(interval);
        return;
      }
      const combo = document.querySelector(
        ".goog-te-combo",
      ) as HTMLSelectElement | null;
      if (!combo) {
        attempts += 1;
        return;
      }

      if (!comboListenerAttached.current) {
        comboListenerAttached.current = true;
        combo.addEventListener("change", () => {
          const value = combo.value;
          if (!value) return;
          setLanguageState(value);
          setGoogTransCookie(value);
        });
      }

      const nextOptions = Array.from(combo.options)
        .map((opt) => ({
          value: opt.value,
          label: opt.textContent || opt.value,
        }))
        .filter((opt) => opt.value);
      if (nextOptions.length > 0) setOptions(nextOptions);

      const stored = languageRef.current;
      if (stored) applyLanguage(stored);
      window.clearInterval(interval);
    }, 250);

    return () => window.clearInterval(interval);
  }, [ready, applyLanguage, setGoogTransCookie]);

  useEffect(() => {
    if (!ready || typeof window === "undefined") return;
    if (language === DEFAULT_LANG) {
      setGoogTransCookie(DEFAULT_LANG);
      return;
    }
    applyLanguage(language);
  }, [language, ready, applyLanguage, setGoogTransCookie]);

  useEffect(() => {
    const handleRoute = () => {
      const current = languageRef.current;
      if (current && current !== DEFAULT_LANG) {
        setTimeout(() => applyLanguage(current), 250);
      }
    };
    router.events.on("routeChangeComplete", handleRoute);
    return () => {
      router.events.off("routeChangeComplete", handleRoute);
    };
  }, [router.events, applyLanguage]);

  const value = useMemo(
    () => ({
      ready,
      error,
      language,
      options,
      setLanguage,
      resetLanguage,
    }),
    [ready, error, language, options, setLanguage, resetLanguage],
  );

  return (
    <TranslateContext.Provider value={value}>
      {children}
      <div id="google_translate_element" className="translate-element-host" />
    </TranslateContext.Provider>
  );
}

export function useTranslate() {
  const ctx = useContext(TranslateContext);
  if (!ctx) {
    throw new Error("useTranslate must be used within TranslateProvider");
  }
  return ctx;
}
