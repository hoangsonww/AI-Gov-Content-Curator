# 1) Builder stage
FROM node:18-slim AS builder
WORKDIR /app

# Copy manifests
COPY package.json package-lock.json tsconfig.json jest.config.js ./

# Copy source code
COPY models/ models/
COPY pages/ pages/
COPY public/ public/
COPY schedule/ schedule/
COPY scripts/ scripts/
COPY __tests__/ __tests__/

# Install dependencies and build
RUN npm install && npm run build

# 2) Runtime stage
FROM node:18-slim
WORKDIR /app

# Metadata labels
LABEL org.opencontainers.image.title="government-article-curator-newsletter"
LABEL org.opencontainers.image.version="1.0.0"
LABEL org.opencontainers.image.description="Daily newsletter service for AI Article Content Curator."

# Copy built artifacts and dependencies
COPY --from=builder /app ./

# Default command: send the newsletter
CMD ["npm", "run", "send"]
