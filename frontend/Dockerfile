# Stage 1: Build the application
FROM node:18-alpine AS builder
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the application code
COPY . .

# Build the Next.js application
RUN npm run build

# Stage 2: Production image
FROM node:18-alpine
WORKDIR /app

# Copy only production dependencies
COPY package*.json ./
RUN npm install --production

# Copy the built output from the builder stage
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json

# Expose the port that the app listens on
EXPOSE 3000

# Start the Next.js application in production mode
CMD ["npm", "start"]
