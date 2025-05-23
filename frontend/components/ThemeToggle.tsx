"use client";

import { useEffect, useRef, useState } from "react";
import React from "react";
import { MdDarkMode, MdLightMode, MdSettingsBrightness } from "react-icons/md";
import { toast } from "react-toastify";

const DarkModeIcon = MdDarkMode as React.FC<{ size?: number }>;
const LightModeIcon = MdLightMode as React.FC<{ size?: number }>;
const SettingsBrightnessIcon = MdSettingsBrightness as React.FC<{
  size?: number;
}>;

interface ThemeToggleProps {
  theme: "light" | "dark" | "system";
  onThemeChange: (t: "light" | "dark" | "system") => void;
  open: boolean;
  toggle: () => void;
  closeOther: () => void;
}

export default function ThemeToggle({
  theme,
  onThemeChange,
  open,
  toggle,
  closeOther,
}: ThemeToggleProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [appliedTheme, setAppliedTheme] = useState<"light" | "dark">("light");

  const [chosenMode, setChosenMode] = useState<"light" | "dark" | "system">(
    () => {
      if (typeof window !== "undefined") {
        const stored = localStorage.getItem("theme");
        if (stored === "light" || stored === "dark" || stored === "system") {
          return stored;
        }
      }
      return theme;
    },
  );

  useEffect(() => {
    setChosenMode(theme);
  }, [theme]);

  const handleSelect = (newTheme: "light" | "dark" | "system") => {
    localStorage.setItem("theme", newTheme);
    setChosenMode(newTheme);
    onThemeChange(newTheme);
    toggle();
    toast(
      newTheme === "system"
        ? `Using System Preference (${
            appliedTheme.charAt(0).toUpperCase() + appliedTheme.slice(1)
          })`
        : `Switched to ${newTheme.charAt(0).toUpperCase() + newTheme.slice(1)} Mode`,
    );
  };

  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    const apply = (isDark: boolean) => {
      const newTheme = isDark ? "dark" : "light";
      setAppliedTheme(newTheme);
      document.documentElement.setAttribute("data-theme", newTheme);
      if (meta)
        meta.setAttribute(
          "content",
          newTheme === "dark" ? "#121212" : "#ffffff",
        );
    };

    if (theme === "system") {
      const mql = window.matchMedia("(prefers-color-scheme: dark)");
      apply(mql.matches);

      const listener = (e: MediaQueryListEvent) => {
        apply(e.matches);
        toast(
          `System preference changed to ${e.matches ? "Dark" : "Light"} mode`,
        );
      };

      mql.addEventListener("change", listener);
      return () => mql.removeEventListener("change", listener);
    }

    apply(theme === "dark");
  }, [theme]);

  const displayedTheme =
    appliedTheme === "light" ? (
      <LightModeIcon size={24} />
    ) : (
      <DarkModeIcon size={24} />
    );

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

  return (
    <div style={{ position: "relative" }} ref={containerRef}>
      <button
        className="theme-toggle-btn"
        onClick={handleToggle}
        aria-label="Toggle theme"
      >
        {displayedTheme}
      </button>

      {open && (
        <div className="theme-dropdown">
          <Option
            label="Light"
            icon={<LightModeIcon size={20} />}
            isSelected={chosenMode === "light"}
            onClick={() => handleSelect("light")}
          />
          <Option
            label="Dark"
            icon={<DarkModeIcon size={20} />}
            isSelected={chosenMode === "dark"}
            onClick={() => handleSelect("dark")}
          />
          <Option
            label="System"
            icon={<SettingsBrightnessIcon size={20} />}
            isSelected={chosenMode === "system"}
            onClick={() => handleSelect("system")}
          />
        </div>
      )}
    </div>
  );
}

interface OptionProps {
  label: string;
  icon: React.ReactNode;
  isSelected: boolean;
  onClick: () => void;
}

function Option({ label, icon, isSelected, onClick }: OptionProps) {
  return (
    <button
      onClick={onClick}
      className="theme-option-btn"
      style={{ color: isSelected ? "var(--accent-color)" : "inherit" }}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
