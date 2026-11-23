# Production Dockerfile for LUKI MANAGEMENT
FROM node:22-alpine AS base

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy application sources
COPY . .

# Create data directory with proper ownership
RUN mkdir -p /app/data && chown -R node:node /app

USER node

EXPOSE 7860

ENV NODE_ENV=production \
    PORT=7860 \
    HOST=0.0.0.0 \
    TRUST_PROXY=1

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:7860/api/health || exit 1

CMD ["node", "--disable-warning=ExperimentalWarning", "server/index.js"]
