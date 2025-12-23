"use client";

import { ReactNode, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import Navbar from "./Navbar";
import Footer from "./Footer";

interface LayoutProps {
  theme: "light" | "dark" | "system";
  toggleTheme: (selectedTheme: "light" | "dark" | "system") => void;
  children: ReactNode;
}

export default function Layout({ theme, toggleTheme, children }: LayoutProps) {
  const router = useRouter();
  const isLandingPage = router.pathname === "/";
  // measure navbar height and set it as a CSS variable
  const navbarWrapper = useRef<HTMLDivElement>(null);
  const footerWrapper = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updateChromeHeights = () => {
      const navHeight = navbarWrapper.current?.offsetHeight ?? 0;
      const footerHeight = footerWrapper.current?.offsetHeight ?? 0;
      document.documentElement.style.setProperty(
        "--navbar-height",
        `${navHeight}px`,
      );
      document.documentElement.style.setProperty(
        "--footer-height",
        `${footerHeight}px`,
      );
    };

    updateChromeHeights();
    window.addEventListener("resize", updateChromeHeights);
    return () => {
      window.removeEventListener("resize", updateChromeHeights);
    };
  }, [isLandingPage]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
      }}
    >
      {!isLandingPage && (
        <div ref={navbarWrapper}>
          <Navbar theme={theme} onThemeChange={toggleTheme} />
        </div>
      )}

      {/* @ts-ignore */}
      <main
        className={isLandingPage ? "layout-main landing-main" : "layout-main"}
        style={{ flex: 1 }}
      >
        {children}
      </main>

      {!isLandingPage && (
        <div ref={footerWrapper}>
          <Footer />
        </div>
      )}
    </div>
  );
}
