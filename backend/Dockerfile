# Stage 1: Build the application
FROM node:18-alpine AS builder
WORKDIR /app

# Copy package files and install all dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the application code and build the Next.js app
COPY . .
RUN npm run build

# Stage 2: Create the production image
FROM node:18-alpine
WORKDIR /app

# Copy production dependencies only
COPY package*.json ./
RUN npm install --production

# Copy the built Next.js output and public assets from the builder stage
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json

# Expose the port on which the app runs
EXPOSE 3000

# Start the Next.js application (which includes Express API routes)
CMD ["npm", "start"]
