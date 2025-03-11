import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { MdPerson } from "react-icons/md";

interface AuthDropdownProps {
  theme: "light" | "dark" | "system";
  onThemeChange: (theme: "light" | "dark" | "system") => void;
  open: boolean;
  toggle: () => void;
  closeOther: () => void;
}

export default function AuthDropdown({
  theme,
  onThemeChange,
  open,
  toggle,
  closeOther,
}: AuthDropdownProps) {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Poll localStorage every 1 second to detect token changes.
  useEffect(() => {
    const interval = setInterval(() => {
      const token = localStorage.getItem("token");
      setIsLoggedIn(!!token);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Close dropdown if click happens outside the component.
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        if (open) {
          toggle();
        }
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, toggle]);

  const handleClick = () => {
    closeOther();
    toggle();
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    setIsLoggedIn(false);
    toggle();
    window.location.reload();
  };

  return (
    <div className="auth-dropdown-container" ref={containerRef}>
      <button
        className="auth-toggle-btn"
        onClick={handleClick}
        aria-label="User menu"
      >
        <MdPerson size={24} />
      </button>
      {open && (
        <div className="auth-dropdown">
          <div className="auth-section">
            {isLoggedIn ? (
              <button
                className="auth-option logout-option"
                onClick={handleLogout}
              >
                Logout
              </button>
            ) : (
              <>
                <Link href="/auth/login" legacyBehavior>
                  <a className="auth-option" onClick={() => toggle()}>
                    Login
                  </a>
                </Link>
                <Link href="/auth/register" legacyBehavior>
                  <a className="auth-option" onClick={() => toggle()}>
                    Sign Up
                  </a>
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
