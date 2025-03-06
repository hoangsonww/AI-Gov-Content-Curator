import React from "react";
import Link from "next/link";
import { MdArticle } from "react-icons/md";
import ThemeToggle from "./ThemeToggle";

const ArticleIcon = MdArticle as React.FC<{ size?: number }>;

interface NavbarProps {
  theme: "light" | "dark" | "system";
  onThemeChange: (t: "light" | "dark" | "system") => void;
}

export default function Navbar({ theme, onThemeChange }: NavbarProps) {
  return (
    <header className="navbar-container">
      <nav className="navbar-content">
        <Link href="/" className="brand-link">
          <div className="navbar-brand">
            <ArticleIcon size={26} />
            <span className="brand-text">Article Curator</span>
          </div>
        </Link>
        <ThemeToggle theme={theme} onThemeChange={onThemeChange} />
      </nav>
    </header>
  );
}
