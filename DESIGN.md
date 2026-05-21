# Apollo — System Design

## Table of Contents

1. [Database Schema](#database-schema)
2. [Sequence Diagrams](#sequence-diagrams)

---

## Database Schema

```mermaid
erDiagram
    users ||--o{ user_auth_providers : "has many"
    users ||--o{ user_sessions : "has many"
    users ||--o{ feature_configs : "updated_by"
    users ||--o{ telegram_chats : "linked to"

    telegram_bots ||--o{ telegram_chats : "has many"
    telegram_bots ||--o{ telegram_updates : "has many"

    telegram_chats ||--o{ telegram_updates : "has many"
    telegram_chats }o--|| users : "linked_user_id"

    scraping_sources ||--o{ scraped_data : "produces many"

    users {
        uuid id PK
        varchar(255) email UK
        varchar(255) password_hash
        varchar(255) full_name
        boolean is_active
        jsonb roles
        timestamptz created_at
        timestamptz updated_at
    }

    user_auth_providers {
        uuid id PK
        uuid user_id FK
        varchar(50) provider
        varchar(255) provider_user_id
        jsonb provider_data
        timestamptz created_at
    }

    user_sessions {
        uuid id PK
        uuid user_id FK
        varchar(255) refresh_token_hash
        text user_agent
        inet ip_address
        timestamptz expires_at
        timestamptz revoked_at
        timestamptz created_at
    }

    telegram_bots {
        uuid id PK
        varchar(255) bot_token_hash
        varchar(100) bot_username UK
        varchar webhook_secret
        boolean is_active
        jsonb config
    }

    telegram_chats {
        uuid id PK
        varchar(36) bot_id FK
        bigint telegram_chat_id
        varchar(20) chat_type
        varchar(255) title
        varchar(255) username
        varchar(100) first_name
        varchar(100) last_name
        varchar linked_user_id FK
        jsonb settings
    }

    telegram_updates {
        uuid id PK
        varchar(36) bot_id FK
        bigint update_id
        bigint telegram_chat_id
        varchar message_date
        jsonb raw_update
        varchar processed_at
        varchar(100) processed_by
        text error
        varchar created_at
    }

    scraping_sources {
        uuid id PK
        varchar(255) name
        varchar(50) source_type
        jsonb connection_config
        varchar(100) schedule_cron
        boolean is_active
        varchar created_at
    }

    scraped_data {
        uuid id PK
        varchar(36) source_id FK
        varchar captured_at
        text raw_content
        jsonb parsed_data
        varchar(64) data_hash
        varchar(20) status
        text processing_log
    }

    feature_configs {
        uuid id PK
        varchar(255) feature_key
        varchar(20) value_type
        text value_string
        bigint value_integer
        boolean value_boolean
        jsonb value_json
        text description
        varchar(50) scope_type
        varchar(36) scope_id
        int priority
        boolean is_enabled
        varchar(36) updated_by FK
        varchar created_at
        varchar updated_at
    }
```

**Column name conventions above are PostgreSQL-native** (`timestamptz`, `inet`, `jsonb`, `uuid`). SQLite entities map these to compatible types (`varchar` for all UUID/timestamp/inet columns; `json` for jsonb; `text` for large strings).

Unique / composite constraints carried by entities but not visible in the ERD field list:
- `user_auth_providers(provider, provider_user_id)` — `/  UNIQUE`
- `telegram_chats(bot_id, telegram_chat_id)` — `/  UNIQUE`
- `telegram_updates(bot_id, update_id)` — `/  UNIQUE`
- `scraped_data(source_id, data_hash)` — `` @Unique`` — avoids perfect duplicates
- `feature_configs(feature_key, scope_type, scope_id)` — `/  UNIQUE`

Indexes registered via `@Index` decorators in entities (forward-engineering already present in `db_init.sqllite.sql`):
- `idx_users_email_active(users:email, is_active)` · `idx_scraped_captured(scraped_data:captured_at)` · `idx_scraped_status(scraped_data:status)` · `idx_scraping_source_type(scraping_sources:source_type)` · `idx_scraping_source_active(scraping_sources:is_active)` · `idx_session_token_hash(user_sessions:refresh_token_hash)` · `idx_session_user(user_sessions:user_id)`

Additional indexes in SQLite bootstrap file (not yet in entity decorators): `idx_users_email`, `idx_users_created_at`, `idx_users_active`, `idx_user_auth_user`, `idx_user_auth_provider`, `idx_user_sessions_user`, `idx_user_sessions_expires`, `idx_telegram_bots_username`, `idx_telegram_chats_bot`, `idx_telegram_chats_linked_user`, `idx_telegram_updates_bot`, `idx_telegram_updates_chat`, `idx_telegram_updates_date`, `idx_scraping_sources_created`.

---

## Sequence Diagrams

### 1. Scraper Routine — Full Pipeline (Every 20 s)

```mermaid
sequenceDiagram
    participant RS as RoutineService
    participant ScraperSvc as ScraperRoutineService
    participant Scraper as ScraperService
    participant CM as CoinmarketCapTarget
    participant YF as YahooFinanceTarget
    participant FJ as FinancialJuiceTarget
    participant PW as Playwright (Browser)
    participant Store as MemoryKeyStore
    participant Repo as ScrapedDataRepo (TypeORM)
    participant DB as PostgreSQL/SQLite

    Note over RS,DB: "ROUTINE_ENABLED=true, every 20 s (wait mode)"

    RS->>ScraperSvc: timer fires (recursive setTimeout after fn returns)
    ScraperSvc->>ScraperSvc: console.log('Scraper collector routine executed')
    ScraperSvc->>Scraper: scrapeMultiple([CMC, YF, FJ], N=cpu/2, retry=true)

    ScraperSvc->>CM: getOptions()
    ScraperSvc->>YF: getOptions()
    ScraperSvc->>FJ: getOptions()
    Scraper->>Scraper: parallel scrape (up to N concurrent)

    Scraper->>PW: newPage + goto (CMC)
    PW-->>Scraper: HTML snapshot
    Scraper->>CM: parsePriceList(html)
    CM-->>Scraper: CoinData[]

    Scraper->>PW: newPage + goto (YF)
    PW-->>Scraper: HTML snapshot
    Scraper->>YF: parseNewsItems(html)
    YF-->>Scraper: YahooNewsItem[]

    Scraper->>PW: newPage + goto (FJ)
    PW-->>Scraper: HTML snapshot
    Scraper->>FJ: parseNewsItems(html)
    FJ-->>Scraper: NewsItem[]

    Scraper-->>ScraperSvc: ScrapeResult[] (up to 3 results)

    alt at least 1 succeeded
        loop for each successful result
            ScraperSvc->>Store: .set(key, parsed, TTL=120_000 ms)
        end
        %% keys: coinmarketcap, yahoofinance, financialjuice
    else all failed
        ScraperSvc->>ScraperSvc: console.warn('all scrape attempts failed')
        ScraperSvc-->>RS: skip this run
    end
```

### 2. OpenRouter Routine — AI Synthesis (Every 20 s)

```mermaid
sequenceDiagram
    participant RS as RoutineService
    participant ORS as OpenrouterRoutineService
    participant Store as MemoryKeyStore
    participant FAS as FinancialAgentService
    participant OS as OpenRouterService
    participant API as OpenRouter API
    participant Repo as ScrapedDataRepo
    participant DB as PostgreSQL/SQLite

    RS->>ORS: timer fires (fixed 20 s interval)
    ORS->>Store: get('financialjuice')
    ORS->>Store: get('yahoofinance')
    ORS->>Store: get('coinmarketcap')

    alt all 3 present in store
        ORS->>FAS: queryChat({ financialJuiceContent, yahooFinanceContent, coinmarketCapContent })
        FAS->>FAS: buildPrompt() — hedge-fund markdown prompt (model: openrouter/free)
        FAS->>OS: chat(prompt, model='openrouter/free')
        OS->>API: POST /chat/completions (AbortSignal.timeout(30_000 ms))
        API-->>OS: { choices[0].message.content }
        OS-->>FAS: markdown string
        FAS-->>ORS: markdown string

        %% Persist to in-memory store (no TTL)
        ORS->>Store: .set('completion', markdown)
        ORS->>Store: .set('completion-previous', markdown)

        %% Persist to DB (hardcoded openrouter UUID, status='result')
        ORS->>ORS: sha256(markdown) → data_hash
        ORS->>Repo: .create({ source_id: 'ac851202-…', parsed_data:{chatCompletion}, raw_content, data_hash, status:'result' })
        Repo->>DB: INSERT INTO scraped_data
        DB-->>Repo: saved row
        Repo-->>ORS: ok
    else not ready yet
        ORS->>ORS: console.log('Not ready yet! skipped.')
        Note over ORS: keep timer at 20 s
    end
```

### 3. Auth — Login Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant App as Elysia (app.ts)
    participant AR as auth.route.ts
    participant AS as AuthService
    participant Repo as TypeORM Repos
    participant DB as PostgreSQL/SQLite
    participant JWT as jose (SignJWT)

    C->>App: POST /api/v1/auth/login { email, password }
    App->>AR: route handler
    AR->>AS: login(email, password)
    AS->>Repo: userRepo.findOne({ where: { email, is_active: true } })
    Repo->>DB: SELECT FROM users
    DB-->>Repo: UserEntity
    Repo-->>AS: UserEntity
    AS->>AS: bcrypt.compare(password, user.password_hash)
    AS->>AS: buildAccessTokenPayload / buildRefreshTokenPayload
    AS->>Repo: sessionRepo.create(userSessionEntity) → .save()
    Repo->>DB: INSERT INTO user_sessions
    DB-->>Repo: session row
    Repo-->>AS: { accessTokenPayload, refreshTokenPayload, rawRefreshToken }

    AR->>JWT: SignJWT(accessTokenPayload) — HS256, exp 1d
    AR->>JWT: SignJWT(refreshTokenPayload) — HS256, exp 7d
    AR->>C: Set-Cookie: refresh_token (HTTP-only, maxAge 7d)
    AR->>C: { success: true, data: { accessToken, refreshToken } }
```

### 4. Auth — Refresh Token Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant App as Elysia (app.ts)
    participant AR as auth.route.ts
    participant AS as AuthService
    participant Repo as TypeORM Repos
    participant DB as PostgreSQL/SQLite
    participant JWT as jose (SignJWT)

    C->>App: POST /api/v1/auth/refresh (Cookie: refresh_token)
    App->>AR: route handler
    AR->>AS: refreshTokens(refreshToken)
    AS->>Repo: sessionRepo.findOne({ where: { refresh_token_hash, revoked_at: null } }, relations: ['user'])
    Repo->>DB: SELECT FROM user_sessions (with user JOIN)
    DB-->>Repo: UserSessionEntity + UserEntity
    Repo-->>AS: session
    AS->>AS: verify not revoked, not expired, user.is_active
    AS->>AS: session.revoked_at = now → .save() (rotates refresh token)
    AS->>AS: build new accessTokenPayload + new refreshTokenPayload
    AS->>Repo: new session .create().save()
    Repo->>DB: INSERT INTO user_sessions (new rotated session)
    DB-->>Repo: new session row
    Repo-->>AS: { accessTokenPayload, refreshTokenPayload, rawRefreshToken }

    AR->>JWT: SignJWT(new accessTokenPayload) — HS256, exp 1d
    AR->>JWT: SignJWT(new refreshTokenPayload) — HS256, exp 7d
    AR->>C: Set-Cookie: refresh_token (HTTP-only, rotated)
    AR->>C: { success: true, data: { accessToken, refreshToken } }
```

### 5. Response Envelope — Universal /api/v1/* Wrapping

```mermaid
sequenceDiagram
    participant C as Client
    participant App as Elysia (app.ts onAfterHandle hook)
    participant Handler as Route handler
    participant Resp as buildResponse (response.util)

    C->>App: GET /api/v1/openrouter/completion
    App->>Handler: invoke handler
    Note over Handler: returns plain value or { success, data } or ApiResponse
    Handler-->>App: result (any shape)

    App->>App: check path starts with /api/v1/?
    alt No — passes through (static file, /health, etc.)
        App-->>C: result verbatim
    else Yes — wrap
        App->>App: add x-correlation-id response header
        alt already ApiResponse envelope
            App-->>C: { success, data, correlation_id, timestamp }
        else { success, data } pre-wrapped
            App->>Resp: buildResponse(existing.data, existing.success)
            Resp-->>App: ApiResponse
            App-->>C: { success, data, correlation_id, timestamp }
        else plain value
            App->>Resp: buildResponse(result)
            Resp-->>App: ApiResponse
            App-->>C: { success: true, data: result, correlation_id, timestamp }
        end
    end
```

### 6. Frontend — Fetching Completion

```mermaid
sequenceDiagram
    participant React as React SPA (PortfolioBlock)
    participant App as Elysia (port 3000, onAfterHandle)
    participant Store as MemoryKeyStore
    participant Repo as ScrapedDataRepo

    React->>App: GET /api/v1/openrouter/completion
    App->>Store: get('completion')
    Store-->>App: markdown string | undefined
    App->>Store: get('completion-previous')
    Store-->>App: markdown string | undefined

    alt stored completion exists
        App->>App: buildResponse({ latest, previous })
        App-->>React: { success: true, data: { latest, previous }, correlation_id, timestamp }
        React->>React: render Markdown
    else no completion yet
        App->>App: buildResponse({ message: 'No completion available yet' }, false)
        App-->>React: { success: false, data: { message }, correlation_id, timestamp }
    end
```

### 7. Telegram Webhook

```mermaid
sequenceDiagram
    participant TG as Telegram Bot API
    participant App as Elysia
    participant TS as TelegramService
    participant TGBot as telegram_bots (DB table reference)
    participant TGChat as telegram_chats
    participant Repo as TypeORM (memory / supabase)

    TG->>App: POST /api/v1/telegram/webhook { chatId, text }
    App->>TS: sendMessage({ chat_id, text })
    TS->>TS: makeRequest('sendMessage', { … })
    TS->>TG: POST https://api.telegram.org/bot{token}/sendMessage
    TG-->>TS: TelegramMessage
    TS-->>App: TelegramMessage
    App-->>TG: { success: true }
```

---

## Key Notes

### Routines

Three background routines run after the server starts listening on port 3000. All are controlled by `ROUTINE_ENABLED` (default `false`) and use `ROUTINE_EXECUTION_MODE` (default `wait` — recursive `setTimeout`, next run only after current finishes completes).

| Routine | Interval | Purpose |
|---|---|---|
| `scraper-routine` | 20 s | Scrape CMC, YahooFinance, FinancialJuice → `MemoryKeyStore` |
| `openrouter-routine` | 20 s (fixed) | Read store → call OpenRouter → persist to `scraped_data` |
| `supabase-routine` | 300 s | Placeholder for periodic Supabase work |

`RoutineService.startRoutine()` returns `0` in `'wait'` mode; real Bun timer handles are stored internally.

### MemoryKeyStore as Pipeline State

`MemoryKeyStore` (from `src/lib/memory-key-store.ts`) is the **only in-memory shared state** — it bridges the gap between the two independent routines without Redis. The scraper writes; the OpenRouter routine reads. No locking or concurrency control is needed because the `wait` execution mode serialises execution. Supports TTL, LRU eviction, and `getOrSet` with async factory and pending-promise deduplication.

### Scraper concurrency

`scraper-routine.service.ts` uses `Math.max(1, Math.floor(os.cpus().length / 2))` as the concurrent scrape semaphore — parallel across available CPU cores rather than a fixed-1 sequential limit.

### OpenRouter dual-layer

- `OpenRouterService` (`src/lib/services/openrouter.service.ts`) — plain class; `createChatCompletion` / `listModels` / `chat` with in-memory 60 s TTL cache; default model `google/gemini-2.0-flash-exp:free`, default timeout `30_000 ms`.
- `OpenRouterFacade` (`src/plugins/openrouterPlugin.ts`) — Elysia plugin; same endpoints, same default model, different timeout default (`30_000 ms`). Decorated into context as `{ createChatCompletion, listModels, chat }`.
- `FinancialAgentService` calls `openRouterService.chat()` directly (not the facade), using model `openrouter/free` and its own `Promise.race` with a `300_000 ms` deadline.

### Auth guard

`authGuard` (`src/middleware/auth.guard.ts`) is a derive-based middleware that reads the `Authorization: Bearer <token>` header, verifies it with `jose/jwtVerify`, and attaches the decoded payload to `context.authPayload`. Protected routes check `authPayload?.sub` and return 401 when missing.

### CORS Origins

`http://localhost:5173`, `http://localhost:3001`, `http://localhost:3000` — aligns with Vite dev server (5173) and the Elysia server itself (3000).

### Response Envelope

A single `onAfterHandle` hook in `src/app.ts` enforces the universal envelope `{ success: boolean, data: T, correlation_id: string, timestamp: string }` on all `/api/v1/*` routes. Health checks (`/health`) and SPA static file responses (`file()` responses) are exempt. Handlers return plain values — the hook handles wrapping. See `src/lib/response.util.ts`.

### Type augmentation

`src/types/apollo.d.ts` augments `elysia.Context` to reflect every key injected by `.decorate()` in `src/app.ts` and every key declared in plugin context interfaces, eliminating `any` casts in route handlers.

### Database auto-initialisation

`src/lib/db-init.ts` runs eagerly at module scope before `AppDataSource` is constructed.

**Detection logic**

| Condition | Database used |
|---|---|
| `DATABASE_URL` env var present and non-empty | **PostgreSQL** (whatever the DSN points to) |
| `SUPABASE_URL` env var present (DATABASE_URL absent) | **PostgreSQL** — Supabase-managed |
| Neither set | **SQLite** — forced automatically |

**SQLite force-init steps** (runs when no Postgres config is detected)

1. `.env` is created/updated: `DATABASE_URL=sqlite` — picked up immediately by `Bun.env`.
2. `JWT_SECRET` is auto-generated (`crypto.randomUUID()`) and written to `.env` + `Bun.env` only when absent, preventing `app.ts`'s `@elysiajs/jwt` plugin from crashing with "Secret can't be empty".
3. `data/` directory is purged (no stale WAL/shm files or schema mismatches).
4. `data/` directory is recreated.
5. A throwaway TypeORM DataSource with `synchronize: true` is opened against `data/apollo.sqlite` — auto-creates every table declared by the entity classes.
6. `.workspace/db_init.sqllite.sql` is replayed using the native `sqlite3` driver — adds indexes, `UNIQUE` constraints, `DEFAULT` expressions, and handles raw PRAGMA / DEFAULT clauses that TypeORM's query builder cannot parse.
7. The bootstrap DataSource is destroyed. `src/lib/db.ts` then builds the `AppDataSource` that the rest of the codebase uses — for SQLite it also sets `synchronize: true` (safe because the schema was seeded cleanly first).

The whole decision is transparent to `src/app.ts` and every repository — no conditional imports, no feature flags.
