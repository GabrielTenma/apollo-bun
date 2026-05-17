# AGENTS.md

## Project Overview

**Apollo** is a NestJS + React monolith that scrapes economics/financial news from multiple sources, synthesizes the data with OpenRouter AI, and delivers formatted market analysis via Telegram bot and a React frontend.

- **Author:** GabrielTenma
- **License:** Apache-2.0
- **Stack:** NestJS 9 · TypeORM · Playwright · React 19 · Vite · TailwindCSS v4 · DaisyUI · Supabase (PostgreSQL) · OpenRouter AI · Telegram Bot API · Passport JWT

---

## Architecture

### Directory Layout

```
src/
├── main.ts                         # NestJS bootstrap; serves Vite-built frontend with SPA fallback
├── app.module.ts                   # Root module; wires all feature modules, interceptors, filters
├── app.controller.ts               # Health / root GET -> "Hello World!"
├── app.service.ts                  # (empty placeholder)
│
├── constants/
│   ├── app.constants.ts            # APP_CONSTANTS token; app name + in-memory scrapedContentStore (MemoryKeyStore)
│   └── app.module.ts               # Global module providing APP_CONSTANTS
│
├── common/                         # Shared cross-cutting concerns (global)
│   ├── common.module.ts            # Registers global guards, interceptors, filters, routine services, ConfigService
│   ├── config/
│   │   ├── config.module.ts        # Global CommonConfigService provider
│   │   ├── config.service.ts       # Thread-safe env-var cache (reads process.env eagerly)
│   │   └── index.ts
│   ├── decorators/
│   │   ├── current-user.decorator.ts   # @CurrentUser() extracts JWT payload
│   │   ├── public.decorator.ts         # @Public() sets skip-auth metadata
│   │   └── roles.decorator.ts          # @Roles('admin') sets required-role metadata
│   ├── filters/
│   │   └── http-exception.filter.ts    # Global HttpException filter (standard wrapper)
│   ├── guards/
│   │   ├── jwt-auth.guard.ts     # Extends Passport AuthGuard('jwt'); bypasses on @Public()
│   │   └── roles.guard.ts        # RBAC: checks @Roles() against req.user.roles; short-circuits if none
│   ├── interceptors/
│   │   ├── logging.interceptor.ts   # Logs request/response
│   │   └── transform.interceptor.ts # Wraps responses in success/error envelope
│   ├── routines/
│   │   ├── config/
│   │   │   ├── routine.config.module.ts  # ROUTINE_CONFIG token; RoutineConfigService
│   │   │   └── routine.config.ts         # enabled + executionMode('wait'|'skip'|'overlap')
│   │   └── services/
│   │       ├── routine.service.ts        # startRoutine / stopRoutine / executeRoutine; 'wait' mode = recursive setTimeout
│   │       └── example-routine.service.ts
│   ├── typeorm/
│   │   ├── typeorm.module.ts         # TypeORM forRootAsync(DATABASE_URL); autoLoadEntities
│   │   └── typeorm.service.ts        # Generic CRUD via DataSource (SupabaseOrmService)
│   └── utils/
│       ├── index.ts
│       ├── date.util.ts
│       ├── memory-key-store.util.ts   # In-memory store; TTL, getOrSet with async factory, dedup key
│       ├── pagination.util.ts
│       ├── response.util.ts           # successResponse / errorResponse / paginatedResponse
│       └── string.util.ts
│
├── auth/
│   ├── auth.module.ts              # JwtModule + PassportModule + TypeOrm(UserEntity, UserSessionEntity)
│   ├── auth.service.ts             # createUser / login / generateAccessToken / generateRefreshToken / refreshTokens
│   ├── auth.controller.ts          # POST /api/v1/auth/create-user, login, refresh; GET admin-only, profile
│   └── strategies/jwt.strategy.ts  # Passport Strategy('jwt'); ExtractJwt from Bearer header
│
├── openrouter/                     # OpenRouter AI module (global)
│   ├── openrouter.module.ts        # Global; registers TypeOrm(ScrapedDataEntity) for AI result persistence
│   ├── openrouter.service.ts       # createChatCompletion / listModels / chat (RN fetch, AbortSignal.timeout)
│   ├── openrouter.controller.ts    # POST /openrouter/chat, simple-chat; GET /openrouter/models, health, completion
│   ├── config/
│   │   └── openrouter.config.ts    # load: openrouter apiKey / baseUrl / defaultModel / timeout
│   ├── agents/
│   │   └── financial.agent.ts      # FinancialAgentService: assembles hedge-fund style prompt; calls chat('openrouter/free', …)
│   ├── interfaces/
│   │   ├── openrouter.interface.ts # ChatMessage, ChatCompletionOptions, ChatCompletionResponse, OpenRouterModel
│   │   └── financialagent.interface.ts # PromptConfig { financialJuiceContent, yahooFinanceContent, coinmarketCapContent, … }
│   ├── routines/
│   │   └── openrouter-routine.service.ts  # Reads scraped store → FinancialAgentService → stores completion + saves ScrapedDataEntity
│   └── examples/
│       └── basic-usage.example.ts
│
├── scraper/                        # Web scraping module (global)
│   ├── scraper.module.ts           # Global; Playwright chromium; FinancialJuice / YahooFinance / CoinmarketCap targets
│   ├── scraper.service.ts          # scrape / extractStructuredData / scrapeMultiple (semaphore + retry + backoff)
│   ├── scraper.controller.ts       # unified API: scrape, scrape-multiple, extract, sources CRUD, scraped-data CRUD
│   ├── interfaces/
│   │   └── scraper.interface.ts    # ScrapeOptions, ScrapeResult, ExtractConfig, ElementSelector
│   ├── routines/
│   │   └── scraper-routine.service.ts  # 3-target scrapeMultiple every 20s → memory store + ScrapedDataEntity
│   ├── target/
│   │   ├── financialjuice.target.ts  # FinancialJuiceTarget: live.financialjuice.com/news → NewsItem[]
│   │   ├── yahoofinance.target.ts    # YahooFinanceTarget: finance.yahoo.com/news/stream → YahooNewsItem[]
│   │   └── coinmarketcap.target.ts   # CoinmarketCapTarget: coinmarketcap.com → CoinData[]
│   └── examples/
│       └── advanced-usage.example.ts
│
├── telegram/                       # Telegram Bot module (global)
│   ├── telegram.module.ts
│   ├── telegram.service.ts         # sendMessage / sendText / getMe / setWebhook / makeRequest (fetch)
│   ├── telegram.controller.ts      # webhook / send-message / send-text / bot-info / set-webhook
│   ├── config/
│   │   └── telegram.config.ts      # load: botToken / webhookUrl / webhookSecret / timeout
│   ├── interfaces/
│   │   └── telegram.interface.ts   # TelegramMessage, TelegramUpdate, SendMessageOptions, TelegramResponse, …
│   └── examples/
│       └── basic-usage.example.ts
│
├── supabase/                       # Supabase + TypeORM + generic CRUD (global)
│   ├── supabase.module.ts          # Global; imports SupabaseTypeOrmModule; re-exports SupabaseOrmService
│   ├── supabase.service.ts         # Supabase CRUD (create / read / update / delete); multi-connection via env prefix SUPABASE_*
│   ├── supabase.controller.ts      # REST CRUD / read / update / delete
│   ├── config/
│   │   └── supabase.config.ts      # registerAs: SUPABASE_URL / SUPABASE_KEY
│   ├── interfaces/
│   │   └── supabase.interface.ts   # CreateRecordDto / UpdateRecordDto
│   ├── routines/
│   │   └── supabase-routine.service.ts  # Stub: placeholder for periodic Supabase work
│   └── entities/
│       ├── scraped-data.entity.ts      # scraped_data (unique: source_id + data_hash)
│       ├── scraping-source.entity.ts   # scraping_sources
│       ├── user.entity.ts              # users
│       ├── user-session.entity.ts      # user_sessions (revocable refresh-token sessions)
│       ├── user-auth-provider.entity.ts
│       ├── telegram-bot.entity.ts
│       ├── telegram-chat.entity.ts
│       ├── telegram-update.entity.ts
│       └── feature-config.entity.ts
│
└── web/                            # React frontend (Vite)
    └── src/
        └── App.tsx                 # Loads PortfolioBlock component
        └── components/
            └── PortfolioBlock/PortfolioBlock.tsx  # Fetches /api/v1/openrouter/completion; renders Markdown
```

---

## Data Flow

```
Scraping Targets (Playwright)
  FinancialJuice, YahooFinance, CoinmarketCap
        ↓ [ScraperRoutineService ~ every 20 s]
MemoryKeyStore (in-process)
  financialjuice / yahoofinance / coinmarketcap
        ↓ [OpenrouterRoutineService ~ when all 3 present]
OpenRouter AI (FinancialAgentService)  →  Markdown analysis
        ↓
ScrapedDataEntity { source_id: openrouter UUID, status: 'result' }
  saved to PostgreSQL via TypeORM
        ↓
GET /api/v1/openrouter/completion  →  latest + previous completions
  ↓  consumed by React frontend (PortfolioBlock)
GET /api/v1/scraper/financialjuice | yahoofinance | coinmarketcap
```

---

## Key Conventions

### Configuration
- All env vars are read eagerly into `process.env` by `CommonConfigService` at construction time — thread-safe (immutable map).
- Feature modules load their own sub-tree via `@nestjs/config` `registerAs` / factory calls (`openRouterConfig`, `telegramConfig`, etc.).
- Routine global switch: `ROUTINE_ENABLED=true|false` (default `false`).  
  Execution mode: `ROUTINE_EXECUTION_MODE=wait|skip|overlap` (default `wait`).

### Routing
- Routes live under `/api/v1/{module}`.
- OpenAuth is enforced globally via `JwtAuthGuard` + `RolesGuard` registered as `APP_GUARD`.
- Bypass auth with `@Public()`; require roles with `@Roles('admin', 'moderator')`.
- Inject app-wide constants via `@Inject(APP_CONSTANTS)`.

### Routine System
- `RoutineService.startRoutine(name, fn, intervalMs)` sets up per-routine interval timers.
- `OnModuleInit` implementations decide whether to register (checks `isEnabled()`).
- `'wait'` mode (default) uses recursive `setTimeout` — next run scheduled only after current finishes.

### WebSocket / Streaming
- Not implemented. All AI calls are batched poll/request/response via HTTP fetch.

### State
- `MemoryKeyStore` is the only in-memory store for scraped content — no Redis.
- `scrapedContentStore.set(key, value)` called at end of each scraper/LLM routine; read by controllers.

### Naming
- Sequelise: `snake_case` DB columns → `camelCase` entity properties.
- Services: `{Domain}Service`, Routines: `{domain}-routine.service.ts`.
- TypeORM entities under `src/supabase/entities/`; table names configured explicitly.

---

## Environment Variables (.env)

```env
# OpenRouter
OPENROUTER_API_KEY=
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_DEFAULT_MODEL=openai/gpt-oss-120b:free
OPENROUTER_TIMEOUT=300000

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
```

---

## Commands

> All commands are run with **bun** (npm has been removed).

| Task | Command |
|---|---|
| Dev (NestJS + Vite) | `bun run dev` |
| Dev (NestJS only) | `bun run dev` |
| Build all | `bun run build` |
| Type-check | `bun run check` |
| Lint | `bun run lint` |
| Format | `bun run format` |
| Unit / Integration tests | `bun run test` |
| Unit tests (watch) | `bun run test:watch` |
| Coverage | `bun run test:cov` |
| Frontend dev | `bun run web:dev` |
| Frontend build | `bun run web:build` |
| Frontend preview | `bun run web:preview` |
| Install deps | `bun install` |

> NestJS serves on **http://localhost:3000** (via `bunx tsx src/main.ts`).  
> Vite dev server runs on **http://localhost:3001**.  
> CORS origin allows `localhost:5173`, `localhost:3001`, `localhost:3000`.

---

## Testing

- **Unit / Integration:** bun test (Bun-native test runner).  
  Test files: `**/*.spec.ts` under `src/`.
- **E2E:** Playwright (configured in `playwright.config.ts`). CI runs on Ubuntu via `.github/workflows/playwright.yml`.
- Run all tests: `bun run test`. Coverage: `bun run test:cov`.
- Format: `bun run format`.

---

## Design Patterns & Notable Decisions

1. **Global Modules** — All feature modules (`ScraperModule`, `OpenRouterModule`, `TelegramModule`, `SupabaseModule`) and `CommonModule` are `@Global()`; root `AppModule` imports each once.
2. **Thread-Safe Config** — `CommonConfigService` snapshots `process.env` at construction; all async config reads go through it.
3. **Memory-Store Dedup** — `MemoryKeyStore.getOrSet` deduplicates async factory calls using a `pendingPromises` map.
4. **Scraper Concurrency** — `scrapeMultiple` implements a lightweight semaphore (worker pool, default = CPU cores / 2) with exponential backoff retry.
5. **TypeORM + Supabase Client** — Two independent data paths coexist: generic CRUD via the Supabase JS client for Supabase-specific tables, and TypeORM for PostgreSQL entities (users, sessions, scraped data…).
6. **Routine Execution Modes** — `wait` (recursive setTimeout, default), `skip` (drop execution if still running), `overlap` (fire and forget).
7. **JWT Refresh Tokens** — Refresh tokens are hashed with bcrypt before storage; auto-rotation on use; sessions track `user_agent`, `ip_address`, `expires_at`, and `revoked_at`.
