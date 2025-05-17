# Stage 1: install & build
FROM node:18-alpine AS builder
WORKDIR /app

# Copy package manifests and lockfile
COPY package.json package-lock.json tsconfig.json ./

# Install all deps
RUN npm install

# Copy everything else
COPY . .

# Build Next.js (UI) and compile TS
RUN npm run build
RUN npm run build   # ensures schedule/sendNewsletter.ts is compiled to dist/

# Stage 2: production image
FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Only production deps
COPY package.json package-lock.json ./
RUN npm install --production

# Copy built output from builder
COPY --from=builder /app/.next      ./.next
COPY --from=builder /app/public     ./public
COPY --from=builder /app/dist       ./dist
COPY --from=builder /app/models     ./models
COPY --from=builder /app/schedule   ./schedule
COPY --from=builder /app/next.config.js ./

EXPOSE 3000

# Default to starting the UI.
# To send the newsletter, override with:
#   docker run <image> npm run newsletter
CMD ["npm", "run", "start"]
