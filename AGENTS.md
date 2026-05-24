# AGENTS.md

## Project Overview

**Apollo** is an Elysia + Bun server that scrapes economics/financial news from multiple sources, synthesizes the data with OpenRouter AI, and delivers formatted market analysis via Telegram bot and a React frontend.

- **Author:** GabrielTenma
- **License:** Apache-2.0
- **Stack:** Elysia 1.4 · Bun · TypeORM · Playwright · React 19 · Vite · TailwindCSS v4 · DaisyUI · Supabase (PostgreSQL) · OpenRouter AI · Telegram Bot API · bcrypt JWT · evlog
- **Branch:** `main` — `migration/bun` branch merged

---

## Architecture

### Directory Layout (plugin-based architecture — post-migration)

```
src/
├── index.ts                       # Entry point — thin wrapper, imports ./app
├── app.ts                         # Composition root; wires plugins + routes + middleware
│
├── config/
│   ├── env.ts                       # Bun.env helper (env.string / env.number / env.bool)
│   └── index.ts                     # barrel export
│
├── types/                           # Module augmentation + shared interfaces
│   └── apollo.d.ts                  # Extends Elysia Context with context auth/getClient/… types
│
├── plugins/                         # Elysia plugins — one per external service
│   ├── index.ts                     # barrel export
│   ├── supabasePlugin.ts            # discover + create Supabase clients; decorate 'getClient' / 'supabaseService'
│   ├── openrouterPlugin.ts          # OpenRouterFacade; decorate 'createChatCompletion' 'listModels' 'chat'
│   └── telegramPlugin.ts            # TelegramService wrapper; decorate 'sendMessage' 'sendText' / 'setWebhook' / 'getMe'
│
├── middleware/                       # Reusable route guards
│   └── auth.guard.ts               # derive-based JWT guard (jose/jwtVerify) → context.authPayload
│
├── routes/                           # Grouped route definitions
│   ├── index.ts                     # re-exports all versioned groups
│   └── v1/
│       ├── auth.route.ts            # /auth/*  (create-user, login, refresh, profile)
│       ├── supabase.route.ts        # /supabase/*  (CRUD passthrough + health)
│       ├── openrouter.route.ts      # /openrouter/*  (chat, models, simple-chat, completion, health)
│       ├── telegram.route.ts        # /telegram/*  (webhook, send-message, send-text, set-webhook, bot-info)
│       └── scraper.route.ts         # /scraper/*  (scrape, scrape-multiple, sources CRUD, MemoryKeyStore reads)
│
├── lib/                             # Core library — plain classes, no framework
│   ├── db.ts                         # Manual TypeORM DataSource (AppDataSource); SQLite fallback
│   ├── routine.service.ts            # startRoutine / stopRoutine / executeRoutine; 'wait' mode = recursive setTimeout
│   ├── memory-key-store.ts           # In-memory store; TTL, getOrSet with async factory, maxEntries LRU eviction
│   ├── response.util.ts              # ApiResponse<T>, buildResponse, isApiResponse, paginatedResponse
│   ├── string.util.ts                # capitalize, toCamelCase, slugify, truncate, …
│   ├── date.util.ts                  # toISOString, formatDate, addTime, isExpired, dateDiff
│   ├── pagination.util.ts            # normalizePagination, getPaginationMeta, getPagination
│   ├── index.ts                      # barrel export
│   └── services/
│       ├── auth.service.ts           # createUser / login / buildAccessTokenPayload / buildRefreshTokenPayload / refreshTokens
│       ├── scraper.service.ts        # scrape / extractStructuredData / scrapeMultiple (semaphore + retry + backoff)
│       ├── openrouter.service.ts     # createChatCompletion / listModels / chat (fetch, AbortSignal.timeout, in-memory cache)
│       ├── telegram.service.ts       # sendMessage / sendText / getMe / setWebhook / makeRequest (fetch)
│       ├── supabase.service.ts       # Supabase CRUD via @supabase/supabase-js (multi-connection)
│       ├── supabase-orm.service.ts   # Generic TypeORM CRUD wrapper (currently unused)
│       ├── financial-agent.service.ts # FinancialAgentService: hedge-fund style prompt → OpenRouter .chat()
│       ├── scraper-routine.service.ts  # 3-target scrapeMultiple at 20 s → MemoryKeyStore + ScrapedDataEntity
│       ├── openrouter-routine.service.ts # Reads scraped store → FinancialAgentService → stores completion
│       └── supabase-routine.service.ts  # Placeholder: periodic Supabase work
│
├── scraper/                         # Playwright scrape targets (plain classes)
│   ├── interfaces/
│   │   └── scraper.interface.ts      # ScrapeOptions, ScrapeResult, ExtractConfig, ElementSelector
│   ├── target/
│   │   ├── financialjuice.target.ts  # FinancialJuiceTarget: live.financialjuice.com/news → NewsItem[]
│   │   ├── yahoofinance.target.ts    # YahooFinanceTarget: finance.yahoo.com/news/stream → YahooNewsItem[]
│   │   └── coinmarketcap.target.ts   # CoinmarkkapTarget: coinmarketcap.com → CoinData[]
│
├── openrouter/                      # OpenRouter config & types
│   ├── interfaces/
│   │   ├── openrouter.interface.ts   # ChatMessage, ChatCompletionOptions, ChatCompletionResponse, OpenRouterModel
│   │   └── financialagent.interface.ts # PromptConfig { financialJuiceContent, yahooFinanceContent, … }
│
├── telegram/                        # Telegram config & types
│   ├── interfaces/
│   │   └── telegram.interface.ts     # TelegramMessage, TelegramUpdate, SendMessageOptions, TelegramResponse, …
│   └── config/
│       └── telegram.config.ts        # load: botToken / webhookUrl / webhookSecret / timeout
│
├── supabase/                        # TypeORM entities
│   └── entities/
│       ├── scraped-data.entity.ts      # scraped_data
│       ├── scraping-source.entity.ts   # scraping_sources
│       ├── user.entity.ts              # users
│       ├── user-session.entity.ts      # user_sessions
│       ├── user-auth-provider.entity.ts
│       ├── telegram-bot.entity.ts
│       ├── telegram-chat.entity.ts
│       ├── telegram-update.entity.ts
│       └── feature-config.entity.ts
│
├── auth/
│   ├── auth.service.ts               # AuthService (plain class; ref: JwtPayload)
│   └── strategies/
│       └── jwt.strategy.ts           # JwtPayload interface
│
└── web/                              # React + Vite frontend (unaffected)
    ├── src/                          # Frontend source
    │   ├── App.tsx
    │   ├── main.tsx
    │   ├── index.css
    │   ├── pages/
    │   └── components/
    │       └── PortfolioBlock/PortfolioBlock.tsx   # Fetches /api/v1/openrouter/completion
    ├── index.html                    # Vite entry HTML
    └── vite.config.ts                # Vite config: root = src/web, outDir = dist/web
```

---

## Data Flow

```
Scraping Targets (Playwright)
  FinancialJuice, YahooFinance, CoinmarketCap
        ↓ [ScraperRoutineService ~ every 20 s] (started in app.ts)
MemoryKeyStore (in-process, Elysia store via .decorate)  ← TTL: 120 s per key
  financialjuice / yahoofinance / coinmarketcap
        ↓ [OpenrouterRoutineService ~ every 20 s — runs only when all 3 present] (started in app.ts)
OpenRouter AI (FinancialAgentService)  →  Markdown analysis
        ↓
MemoryKeyStore  completion / completion-previous
        ↓
ScrapedDataEntity { source_id, parsed_data, raw_content, data_hash, status:'result' }
  saved to PostgreSQL/SQLite via TypeORM (AppDataSource)
        ↓
GET /api/v1/openrouter/completion  →  latest + previous completions (MemoryKeyStore)
  ↓  consumed by React frontend (PortfolioBlock)
GET /api/v1/scraper/financialjuice | yahoofinance | coinmarketcap  → live MemoryKeyStore reads
GET /*  →  React SPA index.html (spa fallback route)
```

---

## Key Conventions

### Configuration
- All env vars are read via `Bun.env` through `src/config/env.ts` helpers (`env.string`, `env.number`, `env.bool`).
- No `CommonConfigService` — thread-safety achieved by eager `Bun.env` reads at module scope.
- Routine global switch: `ROUTINE_ENABLED=true|false` (default `false`).
  Execution mode: `ROUTINE_EXECUTION_MODE=wait|skip|overlap` (default `wait`).

### Routing
- Route groups live in `src/routes/v1/*.route.ts` and are assembled in `src/app.ts`. No controllers or NestJS-style modules.
- All routes live under `/api/v1/{module}` (or `/health` at root).
- JWT enforcement is opt-in: route groups apply `authGuard` via `.use(authGuard)`, others are open.
- Service dependencies are injected via `.decorate()` at the app level and consumed from context; route handlers never import service classes directly.

### Routine System
- `RoutineService.startRoutine(name, fn, intervalMs)` registers a timer. Returns `0` for 'wait' mode (recursive `setTimeout`).
- `start()` method on each routine service checks `isEnabled()` before registering.
- `'wait'` mode (default) uses recursive `setTimeout` — next run scheduled only after current finishes.
- `'skip'` and `'overlap'` modes use `setInterval`.

### WebSocket / Streaming
- Not implemented. All AI calls are batched poll/request/response via HTTP fetch.

### State
- `MemoryKeyStore` is the only in-memory store for scraped content — no Redis.
- Scraper keys (`financialjuice`, `yahoofinance`, `coinmarketcap`) have a 120 s TTL; `completion` / `completion-previous` are written without TTL.
- All /api/v1/* responses are wrapped by a single `onAfterHandle` hook in `app.ts` into `{ success, data, correlation_id, timestamp }` via `buildResponse`. Health checks and SPA static files are exempt.

### Logging
- Structured logging via [evlog](https://evlog.dev) v2 — one wide event per error, zero scattered lines.
- `initLogger()` is called once at server start (line ~77 of `src/app.ts`). No `console.error` / `console.warn` / `console.log` anywhere in production code.
- `log.error({ error: e.message, route: '/api/v1/…' })` — single-arg `Record<string, unknown>` form used in every catch block. Passes TS type-check without `as any`.
- Routes that log errors: all auth (`create-user`, `login`, `refresh`) and all telegram (`webhook`, `send-message`, `send-text`, `set-webhook`, `bot-info`).
- Startup / shutdown `console.log` messages are intentionally raw — those are process-lifecycle signals, not structured events.
- evlog config is driven from `NODE_ENV` env var; no extra env vars needed. `pretty` mode is auto-detected (dev = on, production = off).

### JWT Auth
- JWT sign/verify is performed via `jose` in auth routes (`SignJWT` + `jwtVerify` from `jose`). `@elysiajs/jwt` plugin is registered but auth routes sign tokens directly.
- Refresh tokens are stored in HTTP-only cookies via Elysia 1.x native cookie API (`cookie.<name>.value`, `.httpOnly`, `.maxAge`, `.path`). No `@elysiajs/cookie` plugin is used.
- Sessions track `user_agent`, `ip_address`, `expires_at`, and `revoked_at`.
- Refresh token reading: `cookie.refresh_token.value` (returns `Cookie<unknown>`, cast to `string`).
- Auth guard (`authGuard`) derives `authPayload` from the `Authorization: Bearer` header via `jose/jwtVerify`.

### Naming
- snake_case DB columns → camelCase entity properties.
- Services: `{Domain}Service`, Routines: `{domain}-routine.service.ts`.
- TypeORM entities under `src/supabase/entities/`; table names configured explicitly.

### Database auto-detection
- `src/lib/db-init.ts` runs eagerly at module scope, before `AppDataSource` is built.
- **Detection**: if `DATABASE_URL` or `SUPABASE_URL` is present in `Bun.env` → Postgres. Otherwise → force SQLite.
- **SQLite force-init**:
  1. `DATABASE_URL=sqlite` is upserted into `.env` + `Bun.env`.
  2. `data/` directory is purged, then recreated.
  3. A throwaway DataSource with `synchronize: true` auto-creates all tables from entity classes.
  4. `.workspace/db_init.sqllite.sql` is replayed (indexes, UNIQUE, defaults).
  5. Bootstrap DataSource is torn down; `db.ts` then builds the real `AppDataSource`.
- No conditional imports or feature flags — `app.ts` and repositories are unaware of the database flavour.

---

## Environment Variables (.env)

```env
# OpenRouter
OPENROUTER_API_KEY=
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_DEFAULT_MODEL=google/gemini-2.0-flash-exp:free
OPENROUTER_TIMEOUT=30000

# Telegram Bot
TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_URL=https://your-domain.com/telegram/webhook
TELEGRAM_WEBHOOK_SECRET=
TELEGRAM_TIMEOUT=30000

# Routines
ROUTINE_ENABLED=true
ROUTINE_EXECUTION_MODE=wait

# JWT
JWT_SECRET=
JWT_ACCESS_EXPIRATION=1d
JWT_REFRESH_EXPIRATION=7d
JWT_SECRET_CREATION=

# Supabase / PostgreSQL
SUPABASE_URL=
SUPABASE_KEY=
SUPABASE_PASSWORD=
SUPABASE_USEDIRECT=true
DATABASE_URL=postgresql://postgres:yourpassword@yourdomain.com:5432/postgres

# SQLite (fallback when DATABASE_URL is absent)
SQLITE_DATABASE=data/apollo.sqlite

# CORS (comma-separated, overrides default)
CORS_ORIGIN=http://localhost:5173,http://localhost:3001,http://localhost:3000
```

---

## Commands

> All commands are run with **bun**. `npm` has been removed. Server entry point is `src/index.ts`.

| Task | Command |
|---|---|
| Dev (server) | `bun run dev` |
| Dev (Vite frontend) | `bun run web:dev` |
| Type-check | `bun run check` |
| Lint | `bun run lint` |
| Format | `bun run format` |
| Unit / Integration tests | `bun run test` |
| Unit tests (watch) | `bun run test:watch` |
| Coverage | `bun run test:cov` |
| Frontend build | `bun run web:build` |
| Frontend preview | `bun run web:preview` |
| Install deps | `bun install` |

> Elysia server listens on **http://localhost:3000**.
> CORS origin allows `localhost:5173`, `localhost:3001`, `localhost:3000`.

## Docker

Build and run with Docker. The image is based on `oven/bun:1-distroless`

**Build:**
```bash
docker build -t apollo .
```

**Run:**
```bash
docker run -p 3000:3000 --env-file .env apollo
```

Environment variables (`OPENROUTER_API_KEY`, `TELEGRAM_BOT_TOKEN`, `JWT_SECRET`, `DATABASE_URL`, etc.) are passed via `--env-file` or `-e`. The frontend is baked into the image at build time and served from `/` by Elysia's `file()` helper.

Exposed port: **3000**. Health check `/health` returns `{"status":"ok"}`.

---

## Testing

- **Unit / Integration:** bun test (Bun-native test runner). Test files: `**/*.spec.ts` under `src/`.
- **E2E:** Playwright (configured in `playwright.config.ts`). CI runs on Ubuntu via `.github/workflows/playwright.yml`.
- Manual cache control (Bun install cache + Playwright browsers): use "Cache Management" workflow_dispatch in `.github/workflows/cache-management.yml` (supports warm / force-refresh / local-clear modes; always sets `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24`).
- Run all tests: `bun run test`. Coverage: `bun run test:cov`.
- Format: `bun run format`.

---

## Design Patterns & Notable Decisions

1. **No DI Container** — Elysia does not provide dependency injection. All services are plain TypeScript classes instantiated once at the top of `src/app.ts`. Dependencies flowing into route handlers come from Elysia's `.decorate()` and closure capture.
2. **Elysia decorate store** — Shared service instances (`authService`, `supabaseService`, etc.) are injected into every route handler's context via `.decorate()` so they are accessible as `store.authService`, `store.scraperService`, etc.
3. **Config via Bun.env** — `src/config/env.ts` is the single env-var reader. No NestJS `ConfigModule` or eager-snapshot cache.
4. **Manual TypeORM bootstrap** — `AppDataSource` is a plain `new DataSource({...})` in `src/lib/db.ts`, initialized explicitly at server start with `.initialize()`. No NestJS `TypeOrmModule`.
5. **Routine Service** — `RoutineService` is a plain class with `startRoutine(name, fn, ms)` returning `0` (Bun timer ID is tracked internally; 'wait' mode uses recursive `setTimeout` calling `executeRoutine`).
6. **JWT via jose** — Auth routes sign tokens with `SignJWT` from `jose` and verify with `jwtVerify` from `jose`. `@elysiajs/jwt` plugin is registered for completeness; `authGuard` (derive-based) reads tokens from the `Authorization: Bearer` header. No NestJS `JwtModule`.
7. **TypeORM entities** — Entities under `src/supabase/entities/` use `@Column({ type: '...' })` with explicit column types to satisfy `tsc` without `emitDecoratorMetadata`. `experimentalDecorators: true` is set for TypeORM decorator support; `reflect-metadata` is required only by TypeORM.
8. **Bun module convention** — `tsconfig.json` uses `"module": "esnext"` + `"moduleResolution": "Bundler"` + `"allowImportingTsExtensions": true`. Internal imports use explicit `.ts` file extensions (required by Bundler resolution).
9. **SQLite fallback** — When `DATABASE_URL` is not set, `src/lib/db.ts` automatically creates a local SQLite datasource at `data/apollo.sqlite` with `synchronize: true` (auto-creates tables). All entity column types are SQLite-compatible (varchar for uuid/timestamptz, json for jsonb) so a single codebase powers both local dev (SQLite) and production (PostgreSQL/Supabase). Set `SQLITE_DATABASE` to override the SQLite file path.
10. **Response envelope** — Every `/api/v1/*` handler value is wrapped by an app-level `onAfterHandle` hook into `{ success, data, correlation_id, timestamp }`. Health checks and SPA static file responses are exempt. See `src/lib/response.util.ts`.
11. **Scraper parallelism** — `scraper-routine.service.ts` uses `Math.max(1, Math.floor(os.cpus().length / 2))` as the concurrent scrape semaphore rather than a fixed-1 sequential limit.
12. **Routine intervals** — `scraper-routine` and `openrouter-routine` both run on a fixed 20 s interval. The openrouter routine only performs work when all three scraped keys are present in the `MemoryKeyStore`; it does not dynamically change its interval after a successful run.
13. **OpenRouter dual-layer** — `OpenRouterService` (plain class) handles `createChatCompletion` / `listModels` / `chat` with in-memory caching (60 s TTL). `OpenRouterFacade` inside `openrouterPlugin.ts` wraps the same endpoints for Elysia context decoration. `FinancialAgentService` calls `openRouterService.chat()` (not the facade).
