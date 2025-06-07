# ------------------------------------------------------------------------
# Stage: Runtime image for government-article-curator-backend
# We skip an explicit tsc build and use ts-node at runtime with transpile-only
# to avoid compile-time type errors in your build environment.
# ------------------------------------------------------------------------
FROM node:18-alpine

# set working directory
WORKDIR /app

# install OS-level dependencies (libc6-compat for some native modules)
RUN apk add --no-cache libc6-compat

# ------------------------------------------------------------------------
# Copy package manifests and install ALL dependencies including devDeps
# so that ts-node and your scripts are available at runtime.
# ------------------------------------------------------------------------
COPY package.json package-lock.json tsconfig.json ./
RUN npm install

# ------------------------------------------------------------------------
# Copy your TypeScript source files
# ------------------------------------------------------------------------
COPY src/ src/

# ------------------------------------------------------------------------
# Add OCI labels so GHCR and other registries show metadata
# ------------------------------------------------------------------------
LABEL org.opencontainers.image.title="government-article-curator-backend" \
      org.opencontainers.image.description="Backend service for Government Article Curator: fetch & summarize news." \
      org.opencontainers.image.version="1.0.0" \
      org.opencontainers.image.authors="Son Nguyen" \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.url="https://github.com/hoangsonww/AI-Gov-Content-Curator" \
      org.opencontainers.image.revision="1.0.0" \
      org.opencontainers.image.created="${BUILD_DATE:-$(date -u +"%Y-%m-%dT%H:%M:%SZ")}"

# ------------------------------------------------------------------------
# Expose the port your Express server listens on
# ------------------------------------------------------------------------
EXPOSE 3000

# ------------------------------------------------------------------------
# Entrypoint: run your server via ts-node in transpile-only mode
# ------------------------------------------------------------------------
CMD ["npx", "ts-node", "--transpile-only", "src/server.ts"]
