"use client";
import { useEffect, useState } from "react";
import { getUserRegion } from "../utils/getRegion";

const ConsentBanner: React.FC = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const initConsent = async () => {
      const stored = localStorage.getItem("cookieConsent");


      if (stored === "accepted" || stored === "rejected") {
        return;
      }

      try {
        await getUserRegion();

        setVisible(true);
      } catch (error) {
        console.error("Region detection failed:", error);

        setVisible(true);
      }
    };

    initConsent();
  }, []);

  const handleConsent = async (value: "accepted" | "rejected") => {
  localStorage.setItem("cookieConsent", value);
  localStorage.setItem(
    "cookieConsentUpdatedAt",
    new Date().toISOString()
  );

  try {
    await fetch("/api/consent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        consent: value,
        timestamp: new Date().toISOString(),
      }),
    });
  } catch (error) {
    console.error("Failed to log consent to server:", error);
  }

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
          <button className="accept-btn" onClick={() => handleConsent("accepted")}>
            Accept All
          </button>

          <button className="reject-btn" onClick={() => handleConsent("rejected")}>
            Reject All
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConsentBanner;