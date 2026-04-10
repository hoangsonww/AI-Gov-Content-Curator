"use client";
import { useEffect, useState } from "react";

const ConsentBanner: React.FC = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem("cookieConsent");
    if (!consent) setVisible(true);
  }, []);

  const handleConsent = (value: "accepted" | "rejected") => {
    localStorage.setItem("cookieConsent", value);

    localStorage.setItem(
      "cookieConsentUpdatedAt",
      new Date().toISOString()
    );

    // notify app
    window.dispatchEvent(new Event("cookieConsentUpdated"));

    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="consent-banner-overlay">
      <div className="consent-banner">
        <p>We use cookies to improve your experience.</p>

        <div className="consent-buttons">
          <button onClick={() => handleConsent("accepted")}>
            Accept All
          </button>
          <button onClick={() => handleConsent("rejected")}>
            Reject All
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConsentBanner;