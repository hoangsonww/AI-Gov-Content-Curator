"use client";

import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { MdPerson } from "react-icons/md";
import { validateToken } from "../services/api";
import { toast } from "react-toastify";

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
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Check token validity, retrying up to 5 times on error with exponential backoff
  useEffect(() => {
    let cancelled = false;

    async function poll() {
      const token = localStorage.getItem("token");
      if (!token) {
        if (!cancelled) setIsLoggedIn(false);
      } else {
        let valid = false;
        // try up to 5 attempts
        for (let attempt = 0; attempt < 5; attempt++) {
          try {
            valid = await validateToken(token);
            break;
          } catch (err) {
            // on error, wait 2^attempt * 500ms
            const delay = Math.pow(2, attempt) * 500;
            await new Promise((res) => setTimeout(res, delay));
          }
        }

        if (!valid) {
          localStorage.removeItem("token");
          if (!cancelled) setIsLoggedIn(false);
        } else if (!cancelled) {
          setIsLoggedIn(true);
        }
      }

      if (!cancelled) {
        // schedule next poll
        setTimeout(poll, 500);
      }
    }

    poll();
    return () => {
      cancelled = true;
    };
  }, []);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        if (open) toggle();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, toggle]);

  const handleClick = () => {
    if (open) {
      toggle();
    } else {
      closeOther();
      toggle();
    }
  };

  const handleLogout = () => {
    toast("Logged out successfully 🚪");
    localStorage.removeItem("token");
    setIsLoggedIn(false);
    toggle();
    setTimeout(() => window.location.reload(), 1000);
  };

  // Highlight icon when on any auth route
  const authPaths = ["/auth/login", "/auth/register", "/auth/reset-password"];
  const isAuthRoute = authPaths.includes(router.pathname);

  return (
    <div className="auth-dropdown-container" ref={containerRef}>
      <button
        className={`auth-toggle-btn${isAuthRoute ? " active-icon" : ""}`}
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
                  <a
                    className={`auth-option${
                      router.pathname === "/auth/login"
                        ? " active-auth-option"
                        : ""
                    }`}
                    onClick={toggle}
                  >
                    Login
                  </a>
                </Link>
                <Link href="/auth/register" legacyBehavior>
                  <a
                    className={`auth-option${
                      router.pathname === "/auth/register"
                        ? " active-auth-option"
                        : ""
                    }`}
                    onClick={toggle}
                  >
                    Sign Up
                  </a>
                </Link>
                <Link href="/auth/reset-password" legacyBehavior>
                  <a
                    className={`auth-option${
                      router.pathname === "/auth/reset-password"
                        ? " active-auth-option"
                        : ""
                    }`}
                    onClick={toggle}
                  >
                    Reset Password
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
