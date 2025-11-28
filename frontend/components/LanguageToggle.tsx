import React, { useState, useEffect } from "react";
import { MdLanguage, MdTranslate } from "react-icons/md";

interface LanguageToggleProps {
  /** Summary in the original language */
  summaryOriginal?: string;
  /** Summary translated to English */
  summaryTranslated?: string;
  /** ISO 639-3 language code */
  language?: string;
  /** Human-readable language name */
  languageName?: string;
  /** Callback when the displayed summary changes */
  onSummaryChange: (summary: string) => void;
}

/**
 * A toggle component that allows users to switch between original and translated summaries.
 */
export default function LanguageToggle({
  summaryOriginal,
  summaryTranslated,
  language,
  languageName,
  onSummaryChange,
}: LanguageToggleProps) {
  // Default to showing translated (English) summary
  const [showOriginal, setShowOriginal] = useState(false);

  // Check if this article is in a non-English language
  const isNonEnglish = language && language !== "eng" && language !== "und";
  const hasBothSummaries = summaryOriginal && summaryTranslated;

  // Update parent when toggle changes
  useEffect(() => {
    if (showOriginal && summaryOriginal) {
      onSummaryChange(summaryOriginal);
    } else if (summaryTranslated) {
      onSummaryChange(summaryTranslated);
    }
  }, [showOriginal, summaryOriginal, summaryTranslated, onSummaryChange]);

  // Don't render the toggle if both summaries aren't available or it's English
  if (!isNonEnglish || !hasBothSummaries) {
    return null;
  }

  return (
    <>
      <div className="language-toggle-container">
        <div className="language-indicator">
          {/* @ts-ignore */}
          <MdLanguage size={16} />
          <span className="language-name">
            Original: {languageName || language}
          </span>
        </div>

        <button
          className={`language-toggle-btn ${showOriginal ? "original" : "translated"}`}
          onClick={() => setShowOriginal(!showOriginal)}
          aria-label={`Switch to ${showOriginal ? "English" : "original"} summary`}
          title={`View ${showOriginal ? "English" : `original (${languageName})`} summary`}
        >
          {/* @ts-ignore */}
          <MdTranslate size={16} />
          <span>{showOriginal ? "View English" : "View Original"}</span>
        </button>

        <div className="language-status">
          {showOriginal ? (
            <span className="status-badge original">
              Showing: {languageName || language}
            </span>
          ) : (
            <span className="status-badge translated">Showing: English</span>
          )}
        </div>
      </div>

      <style>{`
        .language-toggle-container {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 0.75rem 1rem;
          background: var(--card-bg, #f8f9fa);
          border-radius: 8px;
          margin-bottom: 1rem;
          flex-wrap: wrap;
          border: 1px solid var(--card-border, #e0e0e0);
        }

        [data-theme="dark"] .language-toggle-container {
          background: var(--card-bg, #1e1e1e);
          border-color: var(--card-border, #333);
        }

        .language-indicator {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          color: var(--text-muted, #666);
          font-size: 0.9rem;
        }

        [data-theme="dark"] .language-indicator {
          color: var(--text-muted, #aaa);
        }

        .language-name {
          font-weight: 500;
        }

        .language-toggle-btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 1rem;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 0.875rem;
          font-weight: 500;
          transition: all 0.2s ease;
        }

        .language-toggle-btn.translated {
          background: #3b82f6;
          color: white;
        }

        .language-toggle-btn.original {
          background: #10b981;
          color: white;
        }

        .language-toggle-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        }

        .language-toggle-btn:active {
          transform: translateY(0);
        }

        .language-status {
          margin-left: auto;
        }

        .status-badge {
          display: inline-flex;
          align-items: center;
          padding: 0.25rem 0.75rem;
          border-radius: 9999px;
          font-size: 0.75rem;
          font-weight: 500;
        }

        .status-badge.translated {
          background: #dbeafe;
          color: #1e40af;
        }

        .status-badge.original {
          background: #d1fae5;
          color: #065f46;
        }

        [data-theme="dark"] .status-badge.translated {
          background: #1e3a5f;
          color: #93c5fd;
        }

        [data-theme="dark"] .status-badge.original {
          background: #064e3b;
          color: #6ee7b7;
        }

        @media (max-width: 640px) {
          .language-toggle-container {
            flex-direction: column;
            align-items: flex-start;
            gap: 0.5rem;
          }

          .language-status {
            margin-left: 0;
            width: 100%;
          }
        }
      `}</style>
    </>
  );
}
