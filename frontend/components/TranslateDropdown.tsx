"use client";

import React, { useEffect, useRef } from "react";
import { MdGTranslate } from "react-icons/md";
import Tooltip from "./Tooltip";
import { useTranslate } from "./TranslateProvider";

interface TranslateDropdownProps {
  open: boolean;
  toggle: () => void;
  closeOther: () => void;
  variant?: "desktop" | "mobile";
}

export default function TranslateDropdown({
  open,
  toggle,
  closeOther,
  variant = "desktop",
}: TranslateDropdownProps) {
  const { ready, error, language, options, setLanguage, resetLanguage } =
    useTranslate();
  const containerRef = useRef<HTMLDivElement>(null);
  const isActive = language !== "en";
  const panelId =
    variant === "mobile" ? "translate-menu-mobile" : "translate-menu-desktop";

  const handleToggle = () => {
    if (open) toggle();
    else {
      closeOther();
      toggle();
    }
  };

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node) &&
        open
      ) {
        toggle();
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open, toggle]);

  const trigger = (
    <button
      className={`translate-toggle-btn${open || isActive ? " active-icon" : ""}`}
      onClick={handleToggle}
      aria-label="Translate"
      aria-expanded={open}
      aria-controls={panelId}
    >
      <MdGTranslate size={22} />
    </button>
  );

  return (
    <div
      className={`translate-dropdown-container ${variant}`}
      ref={containerRef}
    >
      {variant === "desktop" ? (
        <Tooltip text="Translate">{trigger}</Tooltip>
      ) : (
        trigger
      )}

      {open && (
        <div
          id={panelId}
          className={`translate-dropdown${variant === "mobile" ? " mobile" : ""}`}
        >
          <div className="translate-dropdown-header">
            <div>
              <div className="translate-title">Translate</div>
              <div className="translate-subtitle">Google Translate</div>
            </div>
            <button
              type="button"
              className="translate-reset-btn"
              onClick={resetLanguage}
              disabled={!isActive}
            >
              Turn off
            </button>
          </div>

          {!ready && !error && (
            <div className="translate-status">Loading languages...</div>
          )}
          {error && (
            <div className="translate-status error">
              Translation unavailable.
            </div>
          )}
          {ready && options.length > 0 && (
            <select
              className="translate-select"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            >
              {options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          )}
        </div>
      )}
    </div>
  );
}
