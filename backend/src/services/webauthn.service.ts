import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import type {
  GenerateRegistrationOptionsOpts,
  GenerateAuthenticationOptionsOpts,
  VerifyRegistrationResponseOpts,
  VerifyAuthenticationResponseOpts,
} from "@simplewebauthn/server";

/**
 * Relying Party (RP) configuration. RP_ID must be the *frontend* apex domain
 * (eTLD+1) — not the backend's host. WebAuthn binds credentials to the page
 * that runs navigator.credentials.create/get, which is the frontend.
 *
 * Production: synthoraai.vercel.app (vercel.app is on the Public Suffix List,
 * so the subdomain itself is the registrable domain).
 * Dev: localhost.
 */
export const RP_ID = process.env.RP_ID || "localhost";
export const RP_NAME = process.env.RP_NAME || "SynthoraAI";

/**
 * Comma-separated list of allowed full origins. The library accepts an array
 * for `expectedOrigin`, which prevents sibling subdomains from completing a
 * ceremony.
 */
export const RP_ORIGINS: string[] = (
  process.env.RP_ORIGIN || "http://localhost:3000,https://synthoraai.vercel.app"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export const CHALLENGE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
};

export type {
  GenerateRegistrationOptionsOpts,
  GenerateAuthenticationOptionsOpts,
  VerifyRegistrationResponseOpts,
  VerifyAuthenticationResponseOpts,
};
