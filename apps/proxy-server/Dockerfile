FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /app
RUN pnpm add -g turbo
COPY . .
# Prune the workspace for the proxy-server
RUN turbo prune --scope=@voiceinvoice/proxy-server --docker

FROM base AS installer
RUN apk add --no-cache libc6-compat
WORKDIR /app

# First install dependencies
COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install

# Build the project
COPY --from=builder /app/out/full/ .

# Generate Prisma Client (if needed by build, though seemingly unused yet)
RUN pnpm turbo run db:generate --filter=@voiceinvoice/proxy-server

# Build the project
RUN pnpm turbo run build --filter=@voiceinvoice/proxy-server

FROM base AS runner
WORKDIR /app

# Don't run production as root
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 fastify
USER fastify

COPY --from=installer /app .

EXPOSE 3001

CMD ["node", "apps/proxy-server/dist/index.js"]
