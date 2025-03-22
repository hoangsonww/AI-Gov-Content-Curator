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
import "../styles/footer.css";
import Layout from "../components/Layout";
import { MdArrowUpward } from "react-icons/md";

function App({ Component, pageProps }: AppProps) {
  const [theme, setTheme] = useState<"light" | "dark" | "system">(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("theme") as
        | "light"
        | "dark"
        | "system"
        | null;
      if (stored) {
        document.documentElement.setAttribute("data-theme", stored);
        return stored;
      }
      const prefersDark = window.matchMedia(
        "(prefers-color-scheme: dark)",
      ).matches;
      const defaultTheme = prefersDark ? "dark" : "light";
      document.documentElement.setAttribute("data-theme", defaultTheme);
      return defaultTheme;
    }
    return "system";
  });

  const [showScroll, setShowScroll] = useState(false);

  useEffect(() => {
    const applyTheme = (selected: "light" | "dark" | "system") => {
      if (selected === "system") {
        const prefersDark = window.matchMedia(
          "(prefers-color-scheme: dark)",
        ).matches;
        const themeToApply = prefersDark ? "dark" : "light";
        setTheme(themeToApply);
        document.documentElement.setAttribute("data-theme", themeToApply);
      } else {
        setTheme(selected);
        document.documentElement.setAttribute("data-theme", selected);
      }
    };

    const stored = localStorage.getItem("theme") as
      | "light"
      | "dark"
      | "system"
      | null;
    if (stored) applyTheme(stored);

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e: MediaQueryListEvent) => {
      if (localStorage.getItem("theme") === "system") applyTheme("system");
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const handleScroll = () => setShowScroll(window.scrollY > 300);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const toggleTheme = (selected: "light" | "dark" | "system") => {
    localStorage.setItem("theme", selected);
    setTheme(selected);
    document.documentElement.setAttribute("data-theme", selected);
    if (selected === "system") {
      const prefersDark = window.matchMedia(
        "(prefers-color-scheme: dark)",
      ).matches;
      document.documentElement.setAttribute(
        "data-theme",
        prefersDark ? "dark" : "light",
      );
    }
  };

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  return (
    <Layout theme={theme} toggleTheme={toggleTheme}>
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
