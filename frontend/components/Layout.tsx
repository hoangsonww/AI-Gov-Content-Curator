import { ReactNode } from "react";
import Navbar from "./Navbar";
import Footer from "./Footer";

interface LayoutProps {
  theme: "light" | "dark" | "system";
  toggleTheme: (selectedTheme: "light" | "dark" | "system") => void;
  children: ReactNode;
}

export default function Layout({ theme, toggleTheme, children }: LayoutProps) {
  return (
    <div>
      <Navbar theme={theme} onThemeChange={toggleTheme} />
      <main>{children}</main>
      <Footer />
    </div>
  );
}
