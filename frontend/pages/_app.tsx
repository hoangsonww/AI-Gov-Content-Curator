import { useEffect, useState } from "react";
import type { AppProps } from "next/app";
import "../styles/globals.css";
import "../styles/theme.css";
import Layout from "../components/Layout";

function App({ Component, pageProps }: AppProps) {
  const [theme, setTheme] = useState<"light" | "dark" | "system">(() => {
    // Apply theme **before** rendering to prevent flicker
    if (typeof window !== "undefined") {
      const storedTheme = localStorage.getItem("theme") as
        | "light"
        | "dark"
        | "system"
        | null;
      if (storedTheme) {
        document.documentElement.setAttribute("data-theme", storedTheme);
        return storedTheme;
      }
      // If no stored preference, default to system preference
      const prefersDark = window.matchMedia(
        "(prefers-color-scheme: dark)",
      ).matches;
      const defaultTheme = prefersDark ? "dark" : "light";
      document.documentElement.setAttribute("data-theme", defaultTheme);
      return defaultTheme;
    }
    return "system";
  });

  useEffect(() => {
    const applyTheme = (selectedTheme: "light" | "dark" | "system") => {
      if (selectedTheme === "system") {
        const prefersDark = window.matchMedia(
          "(prefers-color-scheme: dark)",
        ).matches;
        setTheme(prefersDark ? "dark" : "light");
        document.documentElement.setAttribute(
          "data-theme",
          prefersDark ? "dark" : "light",
        );
      } else {
        setTheme(selectedTheme);
        document.documentElement.setAttribute("data-theme", selectedTheme);
      }
    };

    const storedTheme = localStorage.getItem("theme") as
      | "light"
      | "dark"
      | "system"
      | null;
    if (storedTheme) {
      applyTheme(storedTheme);
    }

    // Listen for system changes if "system" is selected
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleSystemChange = (e: MediaQueryListEvent) => {
      if (localStorage.getItem("theme") === "system") {
        applyTheme("system");
      }
    };

    mediaQuery.addEventListener("change", handleSystemChange);
    return () => mediaQuery.removeEventListener("change", handleSystemChange);
  }, []);

  const toggleTheme = (selectedTheme: "light" | "dark" | "system") => {
    localStorage.setItem("theme", selectedTheme);
    setTheme(selectedTheme);
    document.documentElement.setAttribute("data-theme", selectedTheme);

    if (selectedTheme === "system") {
      const prefersDark = window.matchMedia(
        "(prefers-color-scheme: dark)",
      ).matches;
      document.documentElement.setAttribute(
        "data-theme",
        prefersDark ? "dark" : "light",
      );
    }
  };

  return (
    <Layout theme={theme} toggleTheme={toggleTheme}>
      <Component {...pageProps} />
    </Layout>
  );
}

export default App;
