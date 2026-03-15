"use client";
import React, { useEffect, useState, useRef } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import {
  MdArticle,
  MdFavorite,
  MdMailOutline,
  MdHome,
  MdMenu,
  MdClose,
  MdSmartToy,
} from "react-icons/md";
import { validateToken } from "../services/api";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import ThemeToggle from "./ThemeToggle";
import AuthDropdown from "./AuthDropdown";
import Tooltip from "./Tooltip";
import TranslateDropdown from "./TranslateDropdown";

const ArticleIcon = MdArticle as React.FC<{ size?: number }>;
const MailIcon = MdMailOutline as React.FC<{ size?: number }>;

interface NavbarProps {
  theme: "light" | "dark" | "system";
  onThemeChange: (t: "light" | "dark" | "system") => void;
}

export default function Navbar({ theme, onThemeChange }: NavbarProps) {
  const router = useRouter();

  // Desktop popovers
  const [openDropdown, setOpenDropdown] = useState<
    "theme" | "auth" | "translate" | null
  >(null);
  const toggleDesktop = (which: "theme" | "auth" | "translate") =>
    setOpenDropdown((prev) => (prev === which ? null : which));
  const closeDesktop = () => setOpenDropdown(null);

  // Mobile menu + exit animation
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const mobileRef = useRef<HTMLDivElement>(null);

  // Mobile-only popovers
  const [mobileThemeOpen, setMobileThemeOpen] = useState(false);
  const [mobileAuthOpen, setMobileAuthOpen] = useState(false);
  const [mobileTranslateOpen, setMobileTranslateOpen] = useState(false);
  const toggleMobileTheme = () => {
    setMobileAuthOpen(false);
    setMobileTranslateOpen(false);
    setMobileThemeOpen((o) => !o);
  };
  const closeMobileTheme = () => setMobileThemeOpen(false);
  const toggleMobileAuth = () => {
    setMobileThemeOpen(false);
    setMobileTranslateOpen(false);
    setMobileAuthOpen((o) => !o);
  };
  const closeMobileAuth = () => setMobileAuthOpen(false);
  const toggleMobileTranslate = () => {
    setMobileThemeOpen(false);
    setMobileAuthOpen(false);
    setMobileTranslateOpen((o) => !o);
  };
  const closeMobileOtherDropdowns = () => {
    closeMobileTheme();
    closeMobileAuth();
  };

  // Click outside mobile menu to close it
  useEffect(() => {
    if (!mobileOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (mobileRef.current && !mobileRef.current.contains(e.target as Node)) {
        setIsClosing(true);
        setTimeout(() => {
          setMobileOpen(false);
          setIsClosing(false);
          setMobileThemeOpen(false);
          setMobileAuthOpen(false);
          setMobileTranslateOpen(false);
          closeDesktop();
        }, 300);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [mobileOpen]);

  // const [isLoggedIn, setIsLoggedIn] = useState(false);
  // useEffect(() => {
  //   const interval = setInterval(async () => {
  //     const token = localStorage.getItem("token");
  //     setIsLoggedIn(token ? await validateToken(token) : false);
  //     if (!token) localStorage.removeItem("token");
  //   }, 500);
  //   return () => clearInterval(interval);
  // }, []);

  // const handleLogout = () => {
  //   toast("Logged out successfully 🚪");
  //   localStorage.removeItem("token");
  //   setIsLoggedIn(false);
  //   setTimeout(() => window.location.reload(), 1000);
  // };

  return (
    <header className="navbar-container fade-down">
      <nav className="navbar-content">
        {/* Brand */}
        <Link href="/home" className="brand-link">
          <div className="navbar-brand">
            <ArticleIcon size={26} />
            <span className="brand-text">SynthoraAI</span>
          </div>
        </Link>

        {/* Desktop Nav */}
        <div className="navbar-right">
          <Tooltip text="Home">
            <Link href="/home" legacyBehavior>
              <a
                className={`nav-link${router.pathname === "/home" ? " active-link" : ""}`}
              >
                <MdHome size={24} />
              </a>
            </Link>
          </Tooltip>
          <Tooltip text="Newsletter">
            <Link href="/newsletter" legacyBehavior>
              <a
                className={`nav-link${router.pathname === "/newsletter" ? " active-link" : ""}`}
              >
                <MailIcon size={24} />
              </a>
            </Link>
          </Tooltip>
          <Tooltip text="Favorites">
            <Link href="/favorites/favorites" legacyBehavior>
              <a
                className={`nav-link${
                  router.pathname === "/favorites/favorites"
                    ? " active-link"
                    : ""
                }`}
              >
                <MdFavorite size={24} />
              </a>
            </Link>
          </Tooltip>
          <Tooltip text="Ask AI">
            <Link href="/ai_chat" legacyBehavior>
              <a
                className={`nav-link${
                  router.pathname === "/ai_chat" ? " active-link" : ""
                }`}
              >
                <MdSmartToy size={24} />
              </a>
            </Link>
          </Tooltip>

          <ThemeToggle
            theme={theme}
            onThemeChange={onThemeChange}
            open={openDropdown === "theme"}
            toggle={() => toggleDesktop("theme")}
            closeOther={closeDesktop}
          />

          <TranslateDropdown
            open={openDropdown === "translate"}
            toggle={() => toggleDesktop("translate")}
            closeOther={closeDesktop}
          />

          <AuthDropdown
            theme={theme}
            onThemeChange={onThemeChange}
            open={openDropdown === "auth"}
            toggle={() => toggleDesktop("auth")}
            closeOther={closeDesktop}
          />
        </div>

        {/* Mobile Nav */}
        <div className="mobile-dropdown-container" ref={mobileRef}>
          <button
            className="mobile-menu-button"
            aria-label="Menu"
            onClick={() => {
              if (mobileOpen) {
                // closing
                setIsClosing(true);
                setTimeout(() => {
                  setMobileOpen(false);
                  setIsClosing(false);
                  setMobileThemeOpen(false);
                  setMobileAuthOpen(false);
                  setMobileTranslateOpen(false);
                  closeDesktop();
                }, 300);
              } else {
                // opening
                setMobileOpen(true);
              }
            }}
          >
            {mobileOpen ? <MdClose size={24} /> : <MdMenu size={24} />}
          </button>

          {(mobileOpen || isClosing) && (
            <div
              className={`mobile-dropdown ${isClosing ? "closing" : "opening"}`}
            >
              {/* main links */}
              <Link href="/home" legacyBehavior>
                <a
                  className={`mobile-link${
                    router.pathname === "/home" ? " active-link" : ""
                  }`}
                >
                  <MdHome size={20} />
                  <span>Home</span>
                </a>
              </Link>

              <Link href="/newsletter" legacyBehavior>
                <a
                  className={`mobile-link${
                    router.pathname === "/newsletter" ? " active-link" : ""
                  }`}
                >
                  <MailIcon size={20} />
                  <span>Newsletter</span>
                </a>
              </Link>
              <Link href="/favorites/favorites" legacyBehavior>
                <a
                  className={`mobile-link${
                    router.pathname === "/favorites/favorites"
                      ? " active-link"
                      : ""
                  }`}
                >
                  <MdFavorite size={20} />
                  <span>Favorites</span>
                </a>
              </Link>
              <Link href="/ai_chat" legacyBehavior>
                <a
                  className={`mobile-link${
                    router.pathname === "/ai_chat" ? " active-link" : ""
                  }`}
                >
                  <MdSmartToy size={20} />
                  <span>Ask AI</span>
                </a>
              </Link>

              {/* bottom controls */}
              <div className="mobile-bottom-controls">
                <ThemeToggle
                  theme={theme}
                  onThemeChange={onThemeChange}
                  open={mobileThemeOpen}
                  toggle={toggleMobileTheme}
                  closeOther={closeMobileAuth}
                />
                <TranslateDropdown
                  variant="mobile"
                  open={mobileTranslateOpen}
                  toggle={toggleMobileTranslate}
                  closeOther={closeMobileOtherDropdowns}
                />
                <AuthDropdown
                  theme={theme}
                  onThemeChange={onThemeChange}
                  open={mobileAuthOpen}
                  toggle={toggleMobileAuth}
                  closeOther={closeMobileTheme}
                />
              </div>
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
    </header>
  );
}
