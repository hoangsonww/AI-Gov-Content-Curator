# Root Dockerfile
FROM node:18-bullseye

# Create app dir
WORKDIR /workspace

# Copy root package files (npm workspaces)
COPY package.json package-lock.json ./

# Install all dependencies for all workspaces
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
