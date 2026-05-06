import React from "react";
import { useCookieConsent } from "./CookieConsentProvider";

export default function Footer() {
  const currentYear = new Date().getFullYear();
  const { region, openPreferences } = useCookieConsent();

  return (
    <footer className="footer hover-animate fade-down">
      <p>
        © {currentYear}{" "}
        <a
          target="_blank"
          href="https://github.com/hoangsonww/AI-Gov-Content-Curator"
        >
          SynthoraAI
        </a>
        . All rights reserved.{" "}
        <button className="footer-manage-cookies" onClick={openPreferences}>
          Manage Cookies
        </button>
        {region === "optout" && (
          <>
            {" · "}
            <button className="footer-manage-cookies" onClick={openPreferences}>
              Do Not Sell or Share My Personal Information
            </button>
          </>
        )}
      </p>
    </footer>
  );
}
