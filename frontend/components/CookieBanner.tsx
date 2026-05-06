"use client";

import React, { useState } from "react";
import { useRouter } from "next/router";
import { useCookieConsent, ConsentCategories } from "./CookieConsentProvider";

export default function CookieBanner() {
  const router = useRouter();
  const {
    categories,
    region,
    acceptAll,
    declineAll,
    savePreferences,
    preferencesOpen,
    openPreferences,
    closePreferences,
    bannerVisible,
  } = useCookieConsent();

  const [draft, setDraft] = useState<ConsentCategories>({ ...categories });

  // Sync draft when the panel opens
  React.useEffect(() => {
    if (preferencesOpen) setDraft({ ...categories });
  }, [preferencesOpen, categories]);

  // Never show on the landing page
  if (router.pathname === "/") return null;

  if (!bannerVisible) return null;

  // --- Preferences panel (shared across all regions) ---
  if (preferencesOpen) {
    return (
      <div
        className="cookie-banner"
        role="dialog"
        aria-label="Cookie preferences"
      >
        <div className="cookie-banner-inner cookie-banner-inner--prefs">
          <div className="cookie-prefs-header">
            <h3 className="cookie-prefs-title">Cookie Preferences</h3>
            <button
              className="cookie-prefs-close"
              onClick={closePreferences}
              aria-label="Close preferences"
            >
              ✕
            </button>
          </div>

          <p className="cookie-prefs-desc">
            Choose which cookies you allow. Necessary cookies cannot be disabled
            as they are required for the site to function.
          </p>

          <div className="cookie-prefs-list">
            <label className="cookie-pref-row">
              <div className="cookie-pref-info">
                <span className="cookie-pref-name">Necessary</span>
                <span className="cookie-pref-detail">
                  Core site functionality, theme, and layout
                </span>
              </div>
              <input
                type="checkbox"
                className="cookie-toggle"
                checked
                disabled
              />
            </label>

            <label className="cookie-pref-row">
              <div className="cookie-pref-info">
                <span className="cookie-pref-name">Analytics</span>
                <span className="cookie-pref-detail">
                  Vercel Analytics for usage insights
                </span>
              </div>
              <input
                type="checkbox"
                className="cookie-toggle"
                checked={draft.analytics}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, analytics: e.target.checked }))
                }
              />
            </label>

            <label className="cookie-pref-row">
              <div className="cookie-pref-info">
                <span className="cookie-pref-name">Translation</span>
                <span className="cookie-pref-detail">
                  Google Translate language preferences
                </span>
              </div>
              <input
                type="checkbox"
                className="cookie-toggle"
                checked={draft.translation}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, translation: e.target.checked }))
                }
              />
            </label>
          </div>

          <div className="cookie-banner-actions cookie-banner-actions--equal">
            <button
              className="cookie-banner-btn cookie-banner-btn--decline"
              onClick={declineAll}
            >
              Decline All
            </button>
            <button
              className="cookie-banner-btn cookie-banner-btn--save"
              onClick={() => savePreferences(draft)}
            >
              Save Preferences
            </button>
            <button
              className="cookie-banner-btn cookie-banner-btn--accept"
              onClick={acceptAll}
            >
              Accept All
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- Region-specific banner copy and buttons ---

  if (region === "strict") {
    // GDPR: opt-in, equal-prominence buttons
    return (
      <div className="cookie-banner" role="dialog" aria-label="Cookie consent">
        <div className="cookie-banner-inner">
          <p className="cookie-banner-text">
            We use cookies for translation and analytics. Please choose which
            cookies you allow. Non-essential cookies are blocked until you
            consent.
          </p>
          <div className="cookie-banner-actions cookie-banner-actions--equal">
            <button
              className="cookie-banner-btn cookie-banner-btn--decline"
              onClick={declineAll}
            >
              Decline All
            </button>
            <button
              className="cookie-banner-btn cookie-banner-btn--manage"
              onClick={openPreferences}
            >
              Manage
            </button>
            <button
              className="cookie-banner-btn cookie-banner-btn--accept"
              onClick={acceptAll}
            >
              Accept All
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (region === "optout") {
    // CCPA: opt-out model, cookies already loading
    return (
      <div className="cookie-banner" role="dialog" aria-label="Cookie notice">
        <div className="cookie-banner-inner">
          <p className="cookie-banner-text">
            This site uses cookies for analytics and translation. You may opt
            out or manage your preferences at any time. We honor Do Not Track
            and Global Privacy Control signals.
          </p>
          <div className="cookie-banner-actions">
            <button
              className="cookie-banner-btn cookie-banner-btn--decline"
              onClick={declineAll}
            >
              Opt Out
            </button>
            <button
              className="cookie-banner-btn cookie-banner-btn--manage"
              onClick={openPreferences}
            >
              Manage
            </button>
            <button
              className="cookie-banner-btn cookie-banner-btn--accept"
              onClick={acceptAll}
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    );
  }

  // notice: rest of world — simple informational
  return (
    <div className="cookie-banner" role="dialog" aria-label="Cookie notice">
      <div className="cookie-banner-inner">
        <p className="cookie-banner-text">
          This site uses cookies for translation and analytics to improve your
          experience.
        </p>
        <div className="cookie-banner-actions">
          <button
            className="cookie-banner-btn cookie-banner-btn--manage"
            onClick={openPreferences}
          >
            Manage
          </button>
          <button
            className="cookie-banner-btn cookie-banner-btn--accept"
            onClick={acceptAll}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
