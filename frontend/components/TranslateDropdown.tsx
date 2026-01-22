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
  const { ready, error, language, resetLanguage } = useTranslate();
  const containerRef = useRef<HTMLDivElement>(null);
  const isActive = language !== "en";
  const panelId =
    variant === "mobile" ? "translate-menu-mobile" : "translate-menu-desktop";
  const slotRef = useRef<HTMLDivElement>(null);

  const handleToggle = () => {
    if (open) {
      toggle();
    } else {
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

  useEffect(() => {
    if (typeof window === "undefined") return;
    const host = document.getElementById("google_translate_element");
    const stash = document.querySelector(
      ".translate-element-stash",
    ) as HTMLDivElement | null;
    const slot = slotRef.current;
    if (!host || !stash) return;
    if (open && slot) {
      document.body.dataset.translateOwner = panelId;
      slot.appendChild(host);
      return;
    }
    if (!open && document.body.dataset.translateOwner === panelId) {
      stash.appendChild(host);
      delete document.body.dataset.translateOwner;
    }
  }, [open, panelId, ready]);

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

      <div
        id={panelId}
        className={`translate-dropdown${variant === "mobile" ? " mobile" : ""}${open ? " open" : " closed"}`}
        aria-hidden={!open}
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

        {error && (
          <div className="translate-status error">Translation unavailable.</div>
        )}

        <div
          className={`translate-element-slot${ready && !error ? " ready" : ""}`}
          ref={slotRef}
        />
        <div className="translate-help">
          If the language list is slow to load or translation is unavailable,
          please wait a few seconds or reload the page. Please check your
          Internet connection if the problem persists.
        </div>
      </div>
    </div>
  );
}
