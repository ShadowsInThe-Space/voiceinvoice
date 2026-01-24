# VoiceInvoice Proxy Server
# Multi-stage build for optimized production image

# ===== Build Stage =====
FROM node:20-alpine AS builder

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy root workspace files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY turbo.json tsconfig.json ./

# Copy package manifests for dependency resolution
COPY packages/shared-types/package.json ./packages/shared-types/
COPY apps/proxy-server/package.json ./apps/proxy-server/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source files
COPY packages/shared-types/ ./packages/shared-types/
COPY apps/proxy-server/ ./apps/proxy-server/

# Build shared-types first, then proxy-server
WORKDIR /app/packages/shared-types
RUN pnpm run build 2>/dev/null || true

WORKDIR /app/apps/proxy-server
RUN pnpm run build

# ===== Production Stage =====
FROM node:20-alpine AS production

WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S voiceinvoice -u 1001

# Install pnpm for production
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy package files
COPY --from=builder /app/package.json /app/pnpm-workspace.yaml /app/pnpm-lock.yaml ./
COPY --from=builder /app/packages/shared-types/package.json ./packages/shared-types/
COPY --from=builder /app/apps/proxy-server/package.json ./apps/proxy-server/

# Install production dependencies only (skip prepare scripts for husky)
RUN pnpm install --frozen-lockfile --prod --ignore-scripts

# Copy built files
COPY --from=builder /app/packages/shared-types/dist ./packages/shared-types/dist
COPY --from=builder /app/apps/proxy-server/dist ./apps/proxy-server/dist

# Set ownership
RUN chown -R voiceinvoice:nodejs /app

USER voiceinvoice

# Environment
ENV NODE_ENV=production
ENV PORT=3001
ENV HOST=0.0.0.0

EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget -qO- http://localhost:3001/health || exit 1

# Start server
WORKDIR /app/apps/proxy-server
CMD ["node", "dist/index.js"]
