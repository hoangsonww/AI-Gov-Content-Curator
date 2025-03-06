import React from "react";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="footer hover-animate">
      <p>© {currentYear} Article Curator. All rights reserved.</p>
    </footer>
  );
}
