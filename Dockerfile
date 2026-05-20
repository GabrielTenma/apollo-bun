# Build stage — installs deps, downloads db_init.sql from GitHub (falls back to local), builds frontend
FROM oven/bun:1 AS builder

WORKDIR /app

# Install dependencies (lockfile ensures reproducible installs)
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Download db_init.sql from GitHub; if the repo is private/unreachable, fall back to local copy
RUN set -e; \
    curl -sL -o db_init.sql \
      "https://raw.githubusercontent.com/GabrielTenma/apollo-bun/development/.workspace/db-init.sql" \
      || echo 'GitHub fetch failed (repo may be private), using local fallback'; \
    if [ ! -s db_init.sql ] && [ -f ".workspace/db-init.sql" ]; then \
      cp .workspace/db-init.sql db_init.sql; \
    fi; \
    echo "--- db_init.sql (first 3 lines) ---"; \
    head -3 db_init.sql

# Build frontend → dist/web/
COPY dist/ ./dist/
RUN bunx vite build

# ─── Runtime stage — minimal, runs server
FROM oven/bun:1-distroless

WORKDIR /app

# Install only production deps (no devDeps) and PostgreSQL client for db_init
COPY package.json bun.lock ./
RUN ["bun", "install", "--only=production", "--frozen-lockfile"]

# Install PostgreSQL client needed for conditional db_init.sql execution
RUN ["sh", "-c", "apk add --no-cache postgresql-client"]

# Copy compiled frontend, server source, and db_init.sql from builder
COPY --from=builder /app/dist ./dist
COPY src ./src
COPY --from=builder /app/db_init.sql ./

ENV NODE_ENV=production

EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=5s --retries=3 --start-period=15s \
  CMD ["/usr/local/bin/curl", "-f", "http://localhost:3000/health", "--max-time", "5", "--retry", "3"] || exit 1

# Read DATABASE_URL from environment variables; if set, run db_init.sql, then start server
CMD ["sh", "-c", "\
  export DATABASE_URL=$(env | sed -n 's/^DATABASE_URL=//p'); \
  if [ -n \"$DATABASE_URL\" ] && [ -f db_init.sql ]; then \
    echo 'DATABASE_URL found — running db_init.sql'; \
    psql \"$DATABASE_URL\" -f db_init.sql; \
  else \
    if [ -z \"$DATABASE_URL\" ]; then \
      echo 'No DATABASE_URL set — skipping db_init.sql'; \
    else \
      echo 'db_init.sql not found — skipping'; \
    fi; \
  fi; \
  exec bun run src/server.ts;\
"]
