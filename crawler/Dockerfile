# 1) Builder stage
FROM node:18-slim AS builder
WORKDIR /app

COPY package.json package-lock.json tsconfig.json jest.config.js ./

COPY pages/ pages/
COPY models/ models/
COPY public/ public/
COPY schedule/ schedule/
COPY scripts/ scripts/
COPY services/ services/
COPY styles/ styles/
COPY utils/ utils/

RUN npm ci && npm run build

# 2) Runtime stage
FROM node:18-slim
WORKDIR /app

LABEL org.opencontainers.image.title="government-article-curator-crawler"
LABEL org.opencontainers.image.version="1.1.0"
LABEL org.opencontainers.image.description="A crawler that fetches and summarizes government articles on a schedule, powered by Puppeteer, Google Generative AI, Cheerio, CRON, and more."

COPY --from=builder /app ./

RUN groupadd -r -g 1001 appgroup && useradd -r -u 1001 -g appgroup appuser
USER appuser

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))" || exit 1

CMD ["npm", "run", "crawl"]
