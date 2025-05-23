import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { MdArticle, MdFavorite, MdMailOutline, MdHome, MdMenu, MdClose } from "react-icons/md";
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
  const [openDropdown, setOpenDropdown] = useState<"theme" | "auth" | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const mobileRef = useRef<HTMLDivElement>(null);

  const toggleDropdown = (dropdown: "theme" | "auth") =>
    setOpenDropdown((prev) => (prev === dropdown ? null : dropdown));
  const closeDropdowns = () => setOpenDropdown(null);

  // Close mobile menu on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (mobileRef.current && !mobileRef.current.contains(event.target as Node)) {
        setMobileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
              className={`nav-link${router.pathname === "/home" ? " active-link" : ""}`}
              title="Home"
            >
              <MdHome size={24} />
            </a>
          </Link>

          <Link href="/newsletter" legacyBehavior>
            <a
              className={`nav-link${router.pathname === "/newsletter" ? " active-link" : ""}`}
              title="Newsletter"
            >
              <MailIcon size={24} />
            </a>
          </Link>

          <Link href="/favorites/favorites" legacyBehavior>
            <a
              className={`nav-link${router.pathname === "/favorites/favorites" ? " active-link" : ""}`}
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

        {/* mobile hamburger & popover */}
        <div className="mobile-dropdown-container" ref={mobileRef}>
          <button
            className="mobile-menu-button"
            aria-label="Menu"
            onClick={() => setMobileOpen((o) => !o)}
          >
            {mobileOpen ? <MdClose size={24} /> : <MdMenu size={24} />}
          </button>
          {mobileOpen && (
            <div className="mobile-dropdown">
              <Link href="/home" legacyBehavior>
                <a
                  className={`mobile-link${router.pathname === "/home" ? " active-link" : ""}`}
                  onClick={() => setMobileOpen(false)}
                >
                  Home
                </a>
              </Link>
              <Link href="/newsletter" legacyBehavior>
                <a
                  className={`mobile-link${router.pathname === "/newsletter" ? " active-link" : ""}`}
                  onClick={() => setMobileOpen(false)}
                >
                  Newsletter
                </a>
              </Link>
              <Link href="/favorites/favorites" legacyBehavior>
                <a
                  className={`mobile-link${router.pathname === "/favorites/favorites" ? " active-link" : ""}`}
                  onClick={() => setMobileOpen(false)}
                >
                  Favorites
                </a>
              </Link>
              <button
                className="mobile-link"
                onClick={() => {
                  toggleDropdown("theme");
                  setMobileOpen(false);
                }}
              >
                Theme
              </button>
              <button
                className="mobile-link"
                onClick={() => {
                  toggleDropdown("auth");
                  setMobileOpen(false);
                }}
              >
                Account
              </button>
            </div>
          )}
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

      <style jsx>{`
        .navbar-container {
          background-color: var(--navbar-bg);
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.07);
        }

        .navbar-content {
          display: flex;
          align-items: center;
          justify-content: space-between;
          max-width: 1200px;
          margin: 0 auto;
          padding: 0.75rem 1rem;
          position: relative;
        }

        .brand-link {
          text-decoration: none;
          color: var(--navbar-text);
          display: flex;
          align-items: center;
          z-index: 10;
        }

        .brand-link:hover {
          color: var(--accent-color);
        }

        .navbar-brand {
          display: flex;
          align-items: center;
          gap: 0.4rem;
        }

        .brand-text {
          font-size: 1.3rem;
          font-weight: 700;
        }

        .navbar-right {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .nav-link {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 2.5rem;
          height: 2.5rem;
          color: var(--navbar-text);
          text-decoration: none;
          transition: color 0.2s;
        }
        .nav-link:hover,
        .nav-link.active-link {
          color: var(--accent-color);
        }

        .mobile-dropdown-container {
          display: none;
          position: relative;
        }

        .mobile-menu-button {
          background: none;
          border: none;
          color: var(--navbar-text);
          cursor: pointer;
        }

        /* mobile styles */
        @media (max-width: 768px) {
          .navbar-right {
            display: none;
          }
          .mobile-dropdown-container {
            display: block;
          }
          .mobile-dropdown {
            position: absolute;
            top: 100%;
            right: 0;
            background: var(--card-bg);
            border: 1px solid var(--card-border);
            border-radius: 6px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
            display: flex;
            flex-direction: column;
            padding: 0.5rem 0;
            z-index: 50;
          }
          .mobile-link {
            padding: 0.5rem 1rem;
            font-size: 1rem;
            color: var(--navbar-text);
            text-decoration: none;
            background: none;
            border: none;
            text-align: left;
            width: 100%;
            transition: background 0.2s, color 0.2s;
          }
          .mobile-link:hover,
          .mobile-link.active-link {
            background: var(--hover-bg);
            color: var(--accent-color);
          }
        }
      `}</style>
    </header>
  );
}
