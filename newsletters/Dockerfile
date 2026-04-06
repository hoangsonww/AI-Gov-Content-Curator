# 1) Builder stage
FROM node:18-slim AS builder
WORKDIR /app

COPY package.json package-lock.json tsconfig.json jest.config.js ./

COPY models/ models/
COPY pages/ pages/
COPY public/ public/
COPY schedule/ schedule/
COPY scripts/ scripts/
COPY __tests__/ __tests__/

RUN npm ci && npm run build

# 2) Runtime stage
FROM node:18-slim
WORKDIR /app

LABEL org.opencontainers.image.title="government-article-curator-newsletter"
LABEL org.opencontainers.image.version="1.0.0"
LABEL org.opencontainers.image.description="Daily newsletter service for AI Article Content Curator."

COPY --from=builder /app ./

RUN groupadd -r -g 1001 appgroup && useradd -r -u 1001 -g appgroup appuser
USER appuser

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))" || exit 1

CMD ["npm", "run", "send"]
