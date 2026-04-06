# ------------------------------------------------------------------------
# Stage 1: Build the TypeScript application
# ------------------------------------------------------------------------
FROM node:18-alpine AS builder

WORKDIR /app

RUN apk add --no-cache libc6-compat

COPY package.json package-lock.json tsconfig.json ./
RUN npm ci

COPY src/ src/
RUN npx tsc

# ------------------------------------------------------------------------
# Stage 2: Production runtime
# ------------------------------------------------------------------------
FROM node:18-alpine

WORKDIR /app

RUN apk add --no-cache libc6-compat

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

# OCI labels
LABEL org.opencontainers.image.title="government-article-curator-backend" \
      org.opencontainers.image.description="Backend service for Government Article Curator: fetch & summarize news." \
      org.opencontainers.image.version="1.0.0" \
      org.opencontainers.image.authors="Son Nguyen" \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.url="https://github.com/hoangsonww/AI-Gov-Content-Curator" \
      org.opencontainers.image.revision="1.0.0"

RUN addgroup -g 1001 -S appgroup && adduser -u 1001 -S appuser -G appgroup
USER appuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))" || exit 1

CMD ["node", "dist/server.js"]
