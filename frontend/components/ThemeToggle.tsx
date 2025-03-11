import { useEffect, useState, useRef } from "react";
import React from "react";
import { MdDarkMode, MdLightMode, MdSettingsBrightness } from "react-icons/md";

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

  // Existing effect for system theme.
  useEffect(() => {
    if (theme === "system") {
      const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      onThemeChange(isDark ? "dark" : "light");
    }
  }, [theme, onThemeChange]);

  const handleSelect = (newTheme: "light" | "dark" | "system") => {
    onThemeChange(newTheme);
    toggle();
  };

  let displayedTheme = theme;
  if (theme === "system") {
    const isDark =
      typeof window !== "undefined"
        ? window.matchMedia("(prefers-color-scheme: dark)").matches
        : false;
    displayedTheme = isDark ? "dark" : "light";
  }

  const handleToggle = () => {
    closeOther();
    toggle();
  };

  // Close the dropdown if click happens outside the container.
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        if (open) {
          toggle();
        }
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, toggle]);

  return (
    <div style={{ position: "relative" }} ref={containerRef}>
      <button
        className="theme-toggle-btn"
        onClick={handleToggle}
        aria-label="Toggle theme"
      >
        {displayedTheme === "light" && <LightModeIcon size={24} />}
        {displayedTheme === "dark" && <DarkModeIcon size={24} />}
      </button>

      {open && (
        <div className="theme-dropdown">
          <Option
            label="Light"
            icon={<LightModeIcon size={20} />}
            isSelected={theme === "light"}
            onClick={() => handleSelect("light")}
          />
          <Option
            label="Dark"
            icon={<DarkModeIcon size={20} />}
            isSelected={theme === "dark"}
            onClick={() => handleSelect("dark")}
          />
          <Option
            label="System"
            icon={<SettingsBrightnessIcon size={20} />}
            isSelected={theme === "system"}
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
