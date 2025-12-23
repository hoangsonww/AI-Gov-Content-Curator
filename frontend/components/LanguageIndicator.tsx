import React from "react";

interface LanguageIndicatorProps {
  /** ISO 639-3 language code */
  language?: string;
  /** Human-readable language name */
  languageName?: string;
  /** Show compact version (just the flag/icon) */
  compact?: boolean;
}

/**
 * Map of language codes to their flag emoji representations
 */
const LANGUAGE_FLAGS: Record<string, string> = {
  eng: "🇬🇧",
  spa: "🇪🇸",
  fra: "🇫🇷",
  deu: "🇩🇪",
  ita: "🇮🇹",
  por: "🇵🇹",
  nld: "🇳🇱",
  rus: "🇷🇺",
  zho: "🇨🇳",
  jpn: "🇯🇵",
  kor: "🇰🇷",
  ara: "🇸🇦",
  hin: "🇮🇳",
  tur: "🇹🇷",
  pol: "🇵🇱",
  ukr: "🇺🇦",
  vie: "🇻🇳",
  tha: "🇹🇭",
  ind: "🇮🇩",
  msa: "🇲🇾",
  swe: "🇸🇪",
  nor: "🇳🇴",
  dan: "🇩🇰",
  fin: "🇫🇮",
  ces: "🇨🇿",
  ell: "🇬🇷",
  heb: "🇮🇱",
  ron: "🇷🇴",
  hun: "🇭🇺",
  bul: "🇧🇬",
  hrv: "🇭🇷",
  slk: "🇸🇰",
  slv: "🇸🇮",
  srp: "🇷🇸",
  lit: "🇱🇹",
  lav: "🇱🇻",
  est: "🇪🇪",
  cat: "🏴",
  eus: "🏴",
  glg: "🏴",
  afr: "🇿🇦",
  fil: "🇵🇭",
};

/**
 * A small indicator showing the article's original language.
 * Shows a flag emoji and optionally the language name.
 */
export default function LanguageIndicator({
  language,
  languageName,
  compact = false,
}: LanguageIndicatorProps) {
  // Don't render for English articles or unknown languages
  if (!language || language === "eng" || language === "und") {
    return null;
  }

  const flag = LANGUAGE_FLAGS[language] || "🌐";
  const displayName = languageName || language.toUpperCase();

  return (
    <>
      <span
        className={`language-indicator-badge ${compact ? "compact" : ""}`}
        title={`Original language: ${displayName}`}
        aria-label={`Article originally in ${displayName}`}
      >
        <span className="flag-emoji">{flag}</span>
        {!compact && <span className="lang-text">{displayName}</span>}
      </span>

      <style>{`
        .language-indicator-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          padding: 0.2rem 0.5rem;
          background: var(--badge-bg, #f0f0f0);
          border-radius: 4px;
          font-size: 0.75rem;
          color: var(--text-muted, #666);
          white-space: nowrap;
        }

        [data-theme="dark"] .language-indicator-badge {
          background: var(--badge-bg, #2d2d2d);
          color: var(--text-muted, #aaa);
        }

        .language-indicator-badge.compact {
          padding: 0.2rem;
        }

        .flag-emoji {
          font-size: 1rem;
          line-height: 1;
        }

        .lang-text {
          font-weight: 500;
        }
      `}</style>
    </>
  );
}
