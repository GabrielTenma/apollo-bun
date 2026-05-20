# Build stage — installs deps and builds frontend
FROM oven/bun:1 AS builder

WORKDIR /app

# Install dependencies (lockfile ensures reproducible installs)
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Build frontend → dist/web/
COPY dist/ ./dist/
RUN bunx vite build

# ─── Runtime stage — minimal, runs server
FROM oven/bun:1-distroless

WORKDIR /app

# Install only production deps (no devDeps)
COPY package.json bun.lock ./
RUN ["bun", "install", "--only=production", "--frozen-lockfile"]

# Copy compiled frontend + server source from builder
COPY --from=builder /app/dist ./dist
COPY src ./src

ENV NODE_ENV=production

EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=5s --retries=3 --start-period=15s \
  CMD ["/usr/local/bin/curl", "-f", "http://localhost:3000/health", "--max-time", "5", "--retry", "3"] || exit 1

CMD ["bun", "run", "src/server.ts"]
