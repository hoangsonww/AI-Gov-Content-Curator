import { useEffect, useState } from "react";
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
}

export default function ThemeToggle({
  theme,
  onThemeChange,
}: ThemeToggleProps) {
  const [open, setOpen] = useState(false);

  // If user chooses system, detect OS preference once
  useEffect(() => {
    if (theme === "system") {
      const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      onThemeChange(isDark ? "dark" : "light");
    }
  }, [theme, onThemeChange]);

  const handleSelect = (newTheme: "light" | "dark" | "system") => {
    // If user explicitly picks system, we'll re-check below
    onThemeChange(newTheme);
    setOpen(false);
  };

  // For UI display: if user picks system, we interpret the UI icon based on actual OS preference
  let displayedTheme = theme;
  if (theme === "system") {
    const isDark =
      typeof window !== "undefined"
        ? window.matchMedia("(prefers-color-scheme: dark)").matches
        : false;
    displayedTheme = isDark ? "dark" : "light";
  }

  return (
    <div style={{ position: "relative" }}>
      <button
        className="theme-toggle-btn"
        onClick={() => setOpen(!open)}
        aria-label="Toggle theme"
      >
        {displayedTheme === "light" && <LightModeIcon size={18} />}
        {displayedTheme === "dark" && <DarkModeIcon size={18} />}
      </button>
      {open && (
        <div className="theme-dropdown">
          <Option
            label="Light"
            icon={<LightModeIcon size={16} />}
            isSelected={theme === "light"}
            onClick={() => handleSelect("light")}
          />
          <Option
            label="Dark"
            icon={<DarkModeIcon size={16} />}
            isSelected={theme === "dark"}
            onClick={() => handleSelect("dark")}
          />
          <Option
            label="System"
            icon={<SettingsBrightnessIcon size={16} />}
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
