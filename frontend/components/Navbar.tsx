import React, { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { MdArticle, MdFavorite, MdMailOutline, MdHome } from "react-icons/md";
import ThemeToggle from "./ThemeToggle";
import AuthDropdown from "./AuthDropdown";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const ArticleIcon = MdArticle as React.FC<{ size?: number }>;
const MailIcon = MdMailOutline as React.FC<{ size?: number }>;

interface NavbarProps {
  theme: "light" | "dark" | "system";
  onThemeChange: (t: "light" | "dark" | "system") => void;
}

export default function Navbar({ theme, onThemeChange }: NavbarProps) {
  const router = useRouter();
  const [openDropdown, setOpenDropdown] = useState<"theme" | "auth" | null>(
    null,
  );

  const toggleDropdown = (dropdown: "theme" | "auth") =>
    setOpenDropdown((prev) => (prev === dropdown ? null : dropdown));
  const closeDropdowns = () => setOpenDropdown(null);

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
          <Link href="/home" legacyBehavior>
            <a
              className={`home-link${
                router.pathname === "/home" ? " active-link" : ""
              }`}
              title="Home"
            >
              <MdHome size={24} />
            </a>
          </Link>

          <Link href="/newsletter" legacyBehavior>
            <a
              className={`newsletter-link${
                router.pathname === "/newsletter" ? " active-link" : ""
              }`}
              title="Newsletter"
            >
              <MailIcon size={24} />
            </a>
          </Link>

          <Link href="/favorites/favorites" legacyBehavior>
            <a
              className={`favorites-link${
                router.pathname === "/favorites/favorites" ? " active-link" : ""
              }`}
              title="Favorites"
            >
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
