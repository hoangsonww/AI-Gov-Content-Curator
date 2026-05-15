"use client";

import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { MdPerson } from "react-icons/md";
import { validateToken, clearAuthToken, AUTH_EVENT } from "../services/api";
import { toast } from "react-toastify";
import Tooltip from "./Tooltip";

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

  // Check token validity. Validates once on mount, then every 5 minutes —
  // never more frequently (the prior 500ms poll caused Vercel's edge to
  // return 403 to busy tabs).
  //
  // For instant UI updates on the SAME tab after login/logout, we listen for
  // the `auth:change` CustomEvent that setAuthToken/clearAuthToken dispatch.
  // The native `storage` event only fires in OTHER tabs, so without this the
  // dropdown would only catch up on focus or the next 5-min tick.
  useEffect(() => {
    let cancelled = false;
    const REVALIDATE_MS = 5 * 60 * 1000;

    const applyTokenPresence = (token: string | null) => {
      if (cancelled) return;
      setIsLoggedIn(!!token);
    };

    const checkOnce = async () => {
      const token = localStorage.getItem("token");
      if (!token) {
        applyTokenPresence(null);
        return;
      }
      // Optimistic — show logged-in immediately, then verify in the background.
      applyTokenPresence(token);
      try {
        const valid = await validateToken(token);
        if (cancelled) return;
        if (!valid) {
          clearAuthToken();
          setIsLoggedIn(false);
        }
      } catch {
        // Network blip — keep current state, don't wipe the token.
      }
    };

    checkOnce();
    const interval = setInterval(checkOnce, REVALIDATE_MS);

    const onStorage = (e: StorageEvent) => {
      if (e.key === "token") checkOnce();
    };
    const onAuthChange = (e: Event) => {
      const detail = (e as CustomEvent<{ token: string | null }>).detail;
      // Reflect the change instantly; verify in the background.
      applyTokenPresence(detail?.token ?? localStorage.getItem("token"));
      checkOnce();
    };
    const onFocus = () => checkOnce();
    window.addEventListener("storage", onStorage);
    window.addEventListener(AUTH_EVENT, onAuthChange);
    window.addEventListener("focus", onFocus);

    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(AUTH_EVENT, onAuthChange);
      window.removeEventListener("focus", onFocus);
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
    clearAuthToken();
    setIsLoggedIn(false);
    toggle();
    setTimeout(() => window.location.reload(), 1000);
  };

  // Highlight icon when on any auth route
  const authPaths = [
    "/auth/login",
    "/auth/register",
    "/auth/reset-password",
    "/account/passkeys",
    "/account/privacy",
  ];
  const isAuthRoute = authPaths.includes(router.pathname);

  return (
    <div className="auth-dropdown-container" ref={containerRef}>
      <Tooltip text="Account">
        <button
          className={`auth-toggle-btn${isAuthRoute ? " active-icon" : ""}`}
          onClick={handleClick}
          aria-label="User menu"
        >
          <MdPerson size={24} />
        </button>
      </Tooltip>

      {open && (
        <div className="auth-dropdown">
          <div className="auth-section">
            {isLoggedIn ? (
              <>
                <Link href="/account/passkeys" legacyBehavior>
                  <a
                    className={`auth-option${
                      router.pathname === "/account/passkeys"
                        ? " active-auth-option"
                        : ""
                    }`}
                    onClick={toggle}
                  >
                    Manage Passkeys
                  </a>
                </Link>
                <Link href="/account/privacy" legacyBehavior>
                  <a
                    className={`auth-option${
                      router.pathname === "/account/privacy"
                        ? " active-auth-option"
                        : ""
                    }`}
                    onClick={toggle}
                  >
                    Privacy &amp; Data
                  </a>
                </Link>
                <button
                  className="auth-option logout-option"
                  onClick={handleLogout}
                >
                  Logout
                </button>
              </>
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
