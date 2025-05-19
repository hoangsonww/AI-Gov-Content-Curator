# 1) Builder stage
FROM node:18-slim AS builder
WORKDIR /app

# Copy manifests
COPY package.json package-lock.json tsconfig.json jest.config.js ./

# Copy source code
COPY pages/ pages/
COPY models/ models/
COPY public/ public/
COPY schedule/ schedule/
COPY scripts/ scripts/
COPY services/ services/
COPY styles/ styles/
COPY utils/ utils/

# Install dependencies and build
RUN npm install && npm run build

# 2) Runtime stage
FROM node:18-slim
WORKDIR /app

# Metadata labels
LABEL org.opencontainers.image.title="government-article-curator-crawler"
LABEL org.opencontainers.image.version="1.1.0"
LABEL org.opencontainers.image.description="A crawler that fetches and summarizes government articles on a schedule, powered by Puppeteer, Google Generative AI, Cheerio, CRON, and more."

# Copy the built app and runtime files
COPY --from=builder /app ./

# Default to running the crawler
CMD ["npm", "run", "crawl"]
