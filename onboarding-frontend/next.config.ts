import type { NextConfig } from "next";
import path from 'path'

// Mirror key Next.js settings from main frontend config in onboarding frontend.
const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Keep turbopack object to align with root frontend config and avoid mismatched behavior.
  turbopack: {
    root: path.join(__dirname, '..'),
  },
};

export default nextConfig;
