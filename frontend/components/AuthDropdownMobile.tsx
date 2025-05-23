"use client";
import React, { useEffect, useState, useRef } from "react";
import { useRouter } from "next/router";
import {
  MdPerson,
  MdLogout,
  MdLogin,
  MdPersonAdd,
  MdLockReset,
} from "react-icons/md";
import { validateToken } from "../services/api";
import { toast } from "react-toastify";

interface AuthDropdownProps {
  open: boolean;
  toggle: () => void;
  closeOther: () => void;
}

export default function AuthDropdownMobile({
                                             open,
                                             toggle,
                                             closeOther,
                                           }: AuthDropdownProps) {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Refresh login state
  useEffect(() => {
    const interval = setInterval(async () => {
      const token = localStorage.getItem("token");
      setIsLoggedIn(token ? await validateToken(token) : false);
      if (!token) localStorage.removeItem("token");
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // Close on click **(not mousedown!)** outside
  // useEffect(() => {
  //   if (!open) return;
  //   const handler = (e: MouseEvent) => {
  //     // if click landed outside our container, close panel
  //     if (
  //       containerRef.current &&
  //       !containerRef.current.contains(e.target as Node)
  //     ) {
  //       toggle();
  //     }
  //   };
  //   document.addEventListener("click", handler);
  //   return () => document.removeEventListener("click", handler);
  // }, [open, toggle]);

  const navTo = (path: string) => {
    router.push(path);
  };

  const handleLogout = (e: React.MouseEvent) => {
    e.stopPropagation(); // prevent bubbling to document click
    toast("Logged out successfully 🚪");
    localStorage.removeItem("token");
    setIsLoggedIn(false);
    setTimeout(() => window.location.reload(), 1000);
  };

  const authPaths = ["/auth/login", "/auth/register", "/auth/reset-password"];
  const isAuthRoute = authPaths.includes(router.pathname);

  return (
    <div
      className="mobile-auth"
      ref={containerRef}
      onClick={(e) => e.stopPropagation()} // swallow ALL clicks inside
    >
      {/* Trigger */}
      <button
        className={`mobile-link${isAuthRoute ? " active-link" : ""}`}
        onClick={() => {
          closeOther();
          toggle();
        }}
      >
        <MdPerson size={20} />
        <span>Account</span>
      </button>

      {/* Panel */}
      {open && (
        <div className="auth-dropdown mobile-dropdown-panel">
          <div className="auth-section">
            {isLoggedIn ? (
              <button
                className="mobile-link logout-option"
                onClick={handleLogout}
              >
                <MdLogout size={20} />
                <span>Logout</span>
              </button>
            ) : (
              <>
                <button
                  className="mobile-link"
                  onClick={() => navTo("/auth/login")}
                >
                  <MdLogin size={20} />
                  <span>Login</span>
                </button>
                <button
                  className="mobile-link"
                  onClick={() => navTo("/auth/register")}
                >
                  <MdPersonAdd size={20} />
                  <span>Sign Up</span>
                </button>
                <button
                  className="mobile-link"
                  onClick={() => navTo("/auth/reset-password")}
                >
                  <MdLockReset size={20} />
                  <span>Reset Password</span>
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
