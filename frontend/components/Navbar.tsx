import React, { useState } from "react";
import Link from "next/link";
import { MdArticle, MdFavorite } from "react-icons/md";
import ThemeToggle from "./ThemeToggle";
import AuthDropdown from "./AuthDropdown";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const ArticleIcon = MdArticle as React.FC<{ size?: number }>;

interface NavbarProps {
  theme: "light" | "dark" | "system";
  onThemeChange: (t: "light" | "dark" | "system") => void;
}

export default function Navbar({ theme, onThemeChange }: NavbarProps) {
  // Manage which dropdown is open: "theme", "auth", or null.
  const [openDropdown, setOpenDropdown] = useState<"theme" | "auth" | null>(
    null,
  );

  // Toggle a dropdown – if already open, close it; if not, close any open dropdown and open this one.
  const toggleDropdown = (dropdown: "theme" | "auth") => {
    setOpenDropdown((prev) => (prev === dropdown ? null : dropdown));
  };

  // Close any open dropdown.
  const closeDropdowns = () => {
    setOpenDropdown(null);
  };

  return (
    <header className="navbar-container fade-down">
      <nav className="navbar-content">
        <Link href="/" className="brand-link">
          <div className="navbar-brand">
            <ArticleIcon size={26} />
            <span className="brand-text">Article Curator</span>
          </div>
        </Link>
        <div className="navbar-right">
          <Link href="/favorites/favorites" legacyBehavior>
            <a className="favorites-link">
              <MdFavorite size={24} />
            </a>
          </Link>
          <ThemeToggle
            theme={theme}
            onThemeChange={onThemeChange}
            open={openDropdown === "theme"}
            toggle={() => toggleDropdown("theme")}
            closeOther={closeDropdowns}
          />
          <AuthDropdown
            theme={theme}
            onThemeChange={onThemeChange}
            open={openDropdown === "auth"}
            toggle={() => toggleDropdown("auth")}
            closeOther={closeDropdowns}
          />
        </div>
      </nav>
      <ToastContainer
        position="bottom-center"
        autoClose={3000}
        closeOnClick
        toastStyle={{
          backgroundColor: "var(--card-bg)",
          color: "var(--toastify-text)",
          border: "1px solid var(--card-border)",
          borderRadius: "6px",
          boxShadow: "0 2px 10px rgba(0,0,0,0.2)",
          fontFamily: "'Inter', sans-serif",
        }}
      />
    </header>
  );
}
