# Root Dockerfile for SynthoraAI monorepo
# This Dockerfile is designed for CI/CD pipelines to build and test the entire monorepo.
# It installs all dependencies, builds all workspaces, and runs tests for the backend,
# crawler, and frontend (including E2E tests with Playwright).

# Use Node.js 18 on Debian Bullseye for better compatibility with Playwright and other dependencies.
FROM node:18-bullseye

# Create app dir
WORKDIR /workspace

# Copy root package files (npm workspaces)
COPY package.json package-lock.json ./

# Install all dependencies for all workspaces in this repo
RUN npm ci

# Copy everything else
COPY . .

# Install Playwright browsers for frontend tests
RUN npm --workspace frontend exec playwright install --with-deps
# 1) Lint entire monorepo
RUN npm run lint

# 2) Build all workspaces
RUN npm run build:frontend
RUN npm run build:backend
RUN npm run build:crawler

# 3) Run backend tests
RUN npm --workspace backend test

# 4) Run crawler tests
RUN npm --workspace crawler test

# 5) Run frontend E2E tests in headless mode
RUN npm --workspace frontend test:e2e

# If we reach here, everything passed
CMD ["echo", "✅ CI build & tests passed"]
