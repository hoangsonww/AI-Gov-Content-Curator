"use client";
import { useEffect, useState } from "react";

const ConsentBanner: React.FC = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem("cookieConsent");
    if (!consent) setVisible(true);
  }, []);

  const handleConsent = (value: "accepted" | "rejected" | "customize") => {
    localStorage.setItem("cookieConsent", value);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="consent-banner-overlay">
      <div className="consent-banner">
        <p>
          We use cookies to improve your experience. Please choose your preferences.
        </p>
        <div className="consent-buttons">
          <button onClick={() => handleConsent("accepted")}>Accept</button>
          <button onClick={() => handleConsent("rejected")}>Reject All</button>
          <button onClick={() => handleConsent("customize")}>Customize</button>
        </div>
      </div>
    </div>
  );
};

export default ConsentBanner;