# =============================================================================
# IMPORTANT: Frontend pre-build required
#
# You MUST run this on the host BEFORE `docker build`:
#
#     bun run web:build
#
# This Dockerfile does NOT build the React frontend.
# It only copies the pre-built output from dist/web/.
#
# =============================================================================

# Build stage — installs deps, downloads db_init.sql, copies pre-built frontend
FROM oven/bun:1 AS builder

WORKDIR /app

# Install build dependencies required by native modules
# better-sqlite3 + bcrypt use node-gyp, which needs Python + C++ compiler.
# Bun currently lacks mature prebuilds for better-sqlite3 (see oven-sh/bun#4290).
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    make \
    g++ \
    curl \
    wget \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install dependencies (lockfile ensures reproducible installs)
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Download db_init.sql from GitHub.
# Primary: curl → Secondary: wget.
# If both remote fetches fail, fall back to local .workspace/db-init.sql (if present in build context).
RUN set -e; \
    echo "=== Downloading db_init.sql from GitHub (curl → wget fallback) ==="; \
    curl -fsSL -o db_init.sql \
      "https://raw.githubusercontent.com/GabrielTenma/apollo-bun/development/.workspace/db-init.sql" \
    || wget -qO db_init.sql \
      "https://raw.githubusercontent.com/GabrielTenma/apollo-bun/development/.workspace/db-init.sql" \
    || echo "Remote fetch failed (repo may be private / no network / rate limit)"; \
    \
    if [ ! -s db_init.sql ] && [ -f ".workspace/db-init.sql" ]; then \
      echo "Using local fallback: .workspace/db-init.sql"; \
      cp .workspace/db-init.sql db_init.sql; \
    fi; \
    \
    echo "--- db_init.sql (first 3 lines) ---"; \
    if [ -s db_init.sql ]; then \
      head -3 db_init.sql; \
    else \
      echo "ERROR: db_init.sql is empty or missing after all attempts!"; \
      exit 1; \
    fi

# Copy pre-built frontend artifacts (from host `bun run web:build`)
COPY dist/web ./dist/web

# ─── Runtime stage
FROM oven/bun:1

WORKDIR /app

# Install runtime tools (psql for optional db_init, curl for healthcheck)
# Note: oven/bun:1 is Debian-based, so we use apt-get (not apk)
RUN apt-get update && apt-get install -y --no-install-recommends \
    postgresql-client \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy package manifests + pre-built node_modules (native modules already compiled in builder)
COPY package.json bun.lock ./
COPY --from=builder /app/node_modules ./node_modules

# Copy compiled frontend, server source, and db_init.sql from builder
COPY --from=builder /app/dist ./dist
COPY src ./src
COPY --from=builder /app/db_init.sql ./

ENV NODE_ENV=production
# Signal to the app that we are in a container.
# This tells db-init.ts to never write a .env file (all config must come from
# Docker --env-file or -e at `docker run` time).
ENV DOCKERIZED=true

EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=5s --retries=3 --start-period=15s \
  CMD curl -f http://localhost:3000/health --max-time 5 --retry 3 || exit 1

# All configuration (OPENROUTER_API_KEY, TELEGRAM_BOT_TOKEN, JWT_SECRET,
# DATABASE_URL, etc.) must be supplied at `docker run` time via --env-file or -e.
# No .env file is present or written inside the image.
CMD ["sh", "-c", "\
  if [ -n \"$DATABASE_URL\" ] && [ -f db_init.sql ]; then \
    echo 'DATABASE_URL found — running db_init.sql'; \
    psql \"$DATABASE_URL\" -f db_init.sql || true; \
  else \
    echo 'Skipping db_init.sql'; \
  fi; \
  exec bun run src/index.ts \
"]
