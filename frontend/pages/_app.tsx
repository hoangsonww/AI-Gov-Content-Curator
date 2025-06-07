"use client";
import { useEffect, useState } from "react";
import type { AppProps } from "next/app";
import "../styles/globals.css";
import "../styles/theme.css";
import "../styles/auth-dropdown.css";
import "../styles/login.css";
import "../styles/register.css";
import "../styles/reset-password.css";
import "../styles/topic-dropdown.css";
import "../styles/articles.css";
import "../styles/favorites.css";
import "../styles/article-search.css";
import "../styles/article-details.css";
import "../styles/auth-page.css";
import "../styles/navbar.css";
import "../styles/theme-toggle.css";
import "../styles/load-more-btn.css";
import "../styles/back-to-top-btn.css";
import "../styles/password-toggle.css";
import "../styles/clear-btn.css";
import "../styles/chatbot.css";
import "../styles/newsletter.css";
import "../styles/footer.css";
import "../styles/landing.css";
import "../styles/comments.css";
import Layout from "../components/Layout";
import { MdArrowUpward } from "react-icons/md";
import { Analytics } from "@vercel/analytics/react";

type ThemeKey = "light" | "dark" | "system";

function App({ Component, pageProps }: AppProps) {
  // Initialize theme from localStorage (allowing "system")
  const [theme, setTheme] = useState<ThemeKey>(() => {
    if (typeof window === "undefined") return "system";
    const stored = localStorage.getItem("theme") as ThemeKey | null;
    // If user explicitly chose "light" or "dark"
    if (stored === "light" || stored === "dark") {
      document.documentElement.setAttribute("data-theme", stored);
      return stored;
    }
    // Else treat both "system" or no value as system mode
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)",
    ).matches;
    document.documentElement.setAttribute(
      "data-theme",
      prefersDark ? "dark" : "light",
    );
    return "system";
  });

  // On mount: re-apply saved theme (and OS changes if in "system" mode)
  useEffect(() => {
    const applyTheme = (selected: ThemeKey) => {
      if (selected === "system") {
        setTheme("system");
        const prefersDark = window.matchMedia(
          "(prefers-color-scheme: dark)",
        ).matches;
        document.documentElement.setAttribute(
          "data-theme",
          prefersDark ? "dark" : "light",
        );
      } else {
        setTheme(selected);
        document.documentElement.setAttribute("data-theme", selected);
      }
    };

    const stored = localStorage.getItem("theme") as ThemeKey | null;
    if (stored === "light" || stored === "dark" || stored === "system") {
      applyTheme(stored);
    }

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e: MediaQueryListEvent) => {
      if (localStorage.getItem("theme") === "system") {
        document.documentElement.setAttribute(
          "data-theme",
          e.matches ? "dark" : "light",
        );
      }
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  // back-to-top button
  const [showScroll, setShowScroll] = useState(false);
  useEffect(() => {
    const handleScroll = () => setShowScroll(window.scrollY > 300);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const toggleTheme = (selected: ThemeKey) => {
    localStorage.setItem("theme", selected);
    if (selected === "system") {
      setTheme("system");
      const prefersDark = window.matchMedia(
        "(prefers-color-scheme: dark)",
      ).matches;
      document.documentElement.setAttribute(
        "data-theme",
        prefersDark ? "dark" : "light",
      );
    } else {
      setTheme(selected);
      document.documentElement.setAttribute("data-theme", selected);
    }
  };

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  return (
    <Layout theme={theme} toggleTheme={toggleTheme}>
      <Analytics />
      <Component {...pageProps} />
      {showScroll && (
        <button
          onClick={scrollToTop}
          className="back-to-top-btn"
          aria-label="Back to top"
        >
          <MdArrowUpward size={24} />
        </button>
      )}
    </Layout>
  );
}

export default App;
