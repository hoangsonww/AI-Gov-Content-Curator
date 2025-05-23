"use client";

import { ReactNode, useEffect, useRef } from "react";
import Navbar from "./Navbar";
import Footer from "./Footer";

interface LayoutProps {
  theme: "light" | "dark" | "system";
  toggleTheme: (selectedTheme: "light" | "dark" | "system") => void;
  children: ReactNode;
}

export default function Layout({ theme, toggleTheme, children }: LayoutProps) {
  // measure navbar height and set it as a CSS variable
  const navbarWrapper = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updateNavHeight = () => {
      if (navbarWrapper.current) {
        const h = navbarWrapper.current.offsetHeight;
        document.documentElement.style.setProperty("--navbar-height", `${h}px`);
      }
    };

    updateNavHeight();
    window.addEventListener("resize", updateNavHeight);
    return () => {
      window.removeEventListener("resize", updateNavHeight);
    };
  }, []);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
      }}
    >
      <div ref={navbarWrapper}>
        <Navbar theme={theme} onThemeChange={toggleTheme} />
      </div>

      <main style={{ flex: 1 }}>{children}</main>

      <Footer />
    </div>
  );
}
