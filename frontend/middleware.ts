import { NextRequest, NextResponse } from "next/server";

/**
 * Region-based consent regime mapping.
 *
 * strict  — GDPR-style opt-in (EU/EEA, UK, Brazil, Switzerland, etc.)
 * optout  — CCPA-style opt-out (USA)
 * notice  — Informational only (rest of world)
 */

// EU/EEA 27 + 3 non-EU EEA
const EU_EEA = new Set([
  "AT",
  "BE",
  "BG",
  "CY",
  "CZ",
  "DE",
  "DK",
  "EE",
  "ES",
  "FI",
  "FR",
  "GR",
  "HR",
  "HU",
  "IE",
  "IT",
  "LT",
  "LU",
  "LV",
  "MT",
  "NL",
  "PL",
  "PT",
  "RO",
  "SE",
  "SI",
  "SK",
  "IS",
  "LI",
  "NO",
]);

// Other countries with strict opt-in cookie requirements
const STRICT_OTHER = new Set([
  "GB", // UK GDPR + PECR
  "BR", // LGPD
  "CH", // Swiss revDSG/nFADP
  "ZA", // POPIA
  "CN", // PIPL
  "KR", // PIPA
  "TH", // PDPA
  "IL", // PPL
  "SG", // PDPA
  "JP", // APPI
  "IN", // DPDPA
]);

const OPTOUT_COUNTRIES = new Set([
  "US", // CCPA/CPRA + state laws
]);

export type ConsentRegion = "strict" | "optout" | "notice";

function getConsentRegion(countryCode: string | null): ConsentRegion {
  if (!countryCode) return "strict"; // Safe default
  const code = countryCode.toUpperCase();
  if (EU_EEA.has(code) || STRICT_OTHER.has(code)) return "strict";
  if (OPTOUT_COUNTRIES.has(code)) return "optout";
  return "notice";
}

const COOKIE_NAME = "__consent_region";

export function middleware(request: NextRequest) {
  const country = request.headers.get("x-vercel-ip-country") || null;

  const region = getConsentRegion(country);

  const response = NextResponse.next();
  response.cookies.set(COOKIE_NAME, region, {
    path: "/",
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24, // 1 day — refresh on every visit
  });

  return response;
}

export const config = {
  matcher: [
    // Run on all pages except static assets, _next internals, and API routes
    "/((?!_next/static|_next/image|favicon.ico|api/).*)",
  ],
};
