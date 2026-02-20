import { URL } from "url";

// --- Configuration ---
const TRUSTED_DOMAINS = [
  "un.org",
  "who.int",
  "europa.eu"
];

const FLAGGED_DOMAINS = [
  "example-bad.com",
  "fake-news.net"
];

// --- Scoring Function ---
export function calculateSourceScore(source: string): number {
  let score = 0;

  try {
    const url = new URL(source);
    const hostname = url.hostname.toLowerCase();

    // +20 HTTPS
    if (url.protocol === "https:") {
      score += 20;
    }

    // +30 trusted TLD
    if (
      hostname.endsWith(".gov") ||
      hostname.endsWith(".int") ||
      hostname.endsWith(".edu")
    ) {
      score += 30;
    }

    // +20 trusted list
    if (TRUSTED_DOMAINS.some(domain => hostname.endsWith(domain))) {
      score += 20;
    }

    // -15 flagged list
    if (FLAGGED_DOMAINS.some(domain => hostname.endsWith(domain))) {
      score -= 15;
    }

  } catch (error) {
    console.error("Invalid URL:", source);
    return -1;
  }

  // Clamp score between 0–100
  return Math.max(0, Math.min(100, score));
}
