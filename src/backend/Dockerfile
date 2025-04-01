# ---- Builder Stage ----
# Use a specific Node.js version suitable for the project (e.g., LTS)
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install all dependencies (including devDependencies if needed for any build step)
# Using npm ci is generally recommended for reproducible builds
RUN npm ci

# Copy the rest of the application source code
COPY . .

# Optional: Add any build steps here if needed (e.g., TypeScript compilation)
# RUN npm run build

# ---- Production Stage ----
# Use a slim Node.js image for the final stage
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Create a non-root user and group
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
# Ensure /app directory exists and is owned by the non-root user
RUN mkdir -p /app && chown -R appuser:appgroup /app

# Copy package files again for installing only production dependencies
COPY package.json package-lock.json* ./

# Install only production dependencies using npm ci
RUN npm ci --only=production

# Copy application code from the builder stage
# Ensure ownership is set correctly
COPY --from=builder --chown=appuser:appgroup /app .

# Copy the logs directory structure (if needed, though logs are often volume-mounted)
# RUN mkdir -p logs && chown -R appuser:appgroup logs

# Switch to the non-root user
USER appuser

# Expose the application port
EXPOSE 3001

# Define the command to run the application
# Using the start script defined in package.json
# Consider using pm2-runtime for better process management in containers:
# CMD ["npm", "run", "start:prod"] or CMD ["pm2-runtime", "index.js"]
# For now, using the basic node command:
CMD ["node", "index.js"]
