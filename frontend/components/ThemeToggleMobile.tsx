"use client";
import React, { useEffect, useRef, useState } from "react";
import {
  MdDarkMode,
  MdLightMode,
  MdSettingsBrightness,
} from "react-icons/md";
import { toast } from "react-toastify";

interface ThemeToggleProps {
  theme: "light" | "dark" | "system";
  onThemeChange: (t: "light" | "dark" | "system") => void;
  open: boolean;
  toggle: () => void;
  closeOther: () => void;
}

const DarkModeIcon = MdDarkMode as React.FC<{ size?: number }>;
const LightModeIcon = MdLightMode as React.FC<{ size?: number }>;
const SettingsBrightnessIcon = MdSettingsBrightness as React.FC<{
  size?: number;
}>;

export default function ThemeToggleMobile({
                                            theme,
                                            onThemeChange,
                                            open,
                                            toggle,
                                            closeOther,
                                          }: ThemeToggleProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [appliedTheme, setAppliedTheme] = useState<"light" | "dark">("light");

  // Detect system/dark
  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    const apply = (isDark: boolean) => {
      const newTheme = isDark ? "dark" : "light";
      setAppliedTheme(newTheme);
      document.documentElement.setAttribute("data-theme", newTheme);
      if (meta)
        meta.setAttribute("content", newTheme === "dark" ? "#121212" : "#ffffff");
    };
    if (theme === "system") {
      const mql = window.matchMedia("(prefers-color-scheme: dark)");
      apply(mql.matches);
      mql.addEventListener("change", (e) => apply(e.matches));
      return () => mql.removeEventListener("change", (e) => apply(e.matches));
    } else {
      apply(theme === "dark");
    }
  }, [theme]);

  // Close on outside click (capture)
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        open &&
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        toggle();
      }
    };
    document.addEventListener("click", handler, true);
    return () => document.removeEventListener("click", handler, true);
  }, [open, toggle]);

  const handleSelect = (
    e: React.MouseEvent,
    newTheme: "light" | "dark" | "system"
  ) => {
    e.stopPropagation();
    localStorage.setItem("theme", newTheme);
    onThemeChange(newTheme);
    toast(
      newTheme === "system"
        ? `Using System Preference (${appliedTheme.charAt(0).toUpperCase() +
        appliedTheme.slice(1)})`
        : `Switched to ${newTheme
          .charAt(0)
          .toUpperCase() + newTheme.slice(1)} Mode`
    );
    // do NOT toggle here
  };

  const icon =
    appliedTheme === "light" ? (
      <LightModeIcon size={20} />
    ) : (
      <DarkModeIcon size={20} />
    );

  return (
    <div className="mobile-theme" ref={containerRef}>
      {/* Trigger */}
      <a
        className="mobile-link"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          closeOther();
          toggle();
        }}
      >
        {icon}
        <span>Theme</span>
      </a>

      {/* Panel */}
      {open && (
        <div
          className="theme-dropdown mobile-dropdown-panel"
          style={{ position: "absolute", top: "100%", left: 0 }}
        >
          <button
            className="mobile-link"
            onClick={(e) => handleSelect(e, "light")}
          >
            <MdLightMode size={20} />
            <span>Light</span>
          </button>
          <button
            className="mobile-link"
            onClick={(e) => handleSelect(e, "dark")}
          >
            <MdDarkMode size={20} />
            <span>Dark</span>
          </button>
          <button
            className="mobile-link"
            onClick={(e) => handleSelect(e, "system")}
          >
            <SettingsBrightnessIcon size={20} />
            <span>System</span>
          </button>
        </div>
      )}
    </div>
  );
}
