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
        uuid webhook_secret
        boolean is_active
        jsonb config
    }

    telegram_chats {
        uuid id PK
        uuid bot_id FK
        bigint telegram_chat_id
        varchar(20) chat_type
        varchar(255) title
        varchar(255) username
        varchar(100) first_name
        varchar(100) last_name
        uuid linked_user_id FK
        jsonb settings
    }

    telegram_updates {
        uuid id PK
        uuid bot_id FK
        bigint update_id
        bigint telegram_chat_id
        timestamptz message_date
        jsonb raw_update
        timestamptz processed_at
        varchar(100) processed_by
        text error
        timestamptz created_at
    }

    scraping_sources {
        uuid id PK
        varchar(255) name
        varchar(50) source_type
        jsonb connection_config
        varchar(100) schedule_cron
        boolean is_active
        timestamptz created_at
    }

    scraped_data {
        uuid id PK
        uuid source_id FK
        timestamptz captured_at
        text raw_content
        jsonb parsed_data
        varchar(64) data_hash "GENERATED ALWAYS AS"
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
        uuid scope_id
        int priority
        boolean is_enabled
        uuid updated_by FK
        timestamptz created_at
        timestamptz updated_at
    }
```

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
    participant Playwright as Playwright (Browser)
    participant Store as MemoryKeyStore
    participant Repo as ScrapedDataRepo (TypeORM)
    participant DB as PostgreSQL

    Note over RS,DB: "ROUTINE_ENABLED=true, every 20 s"

    RS->>ScraperSvc: timer fires (setTimeout — 'wait' mode)

    ScraperSvc->>Scraper: scrapeMultiple([CMC, YF, FJ], semaphore 1, retry=true)

    ScraperSvc->>CM: getOptions()
    ScraperSvc->>YF: getOptions()
    ScraperSvc->>FJ: getOptions()

    Scraper->>Scraper: sequential scrape (semaphore=1)

    Scraper->>Playwright: newPage + goto (CMC)
    Playwright-->>Scraper: HTML snapshot
    Scraper->>CM: parsePriceList(html)
    CM-->>Scraper: CoinData[]

    Scraper->>Playwright: newPage + goto (YF)
    Playwright-->>Scraper: HTML snapshot
    Scraper->>YF: parseNewsItems(html)
    YF-->>Scraper: YahooNewsItem[]

    Scraper->>Playwright: newPage + goto (FJ)
    Playwright-->>Scraper: HTML snapshot
    Scraper->>FJ: parseNewsItems(html)
    FJ-->>Scraper: NewsItem[]

    Scraper-->>ScraperSvc: ScrapeResult[] (3 results)

    alt at least 1 succeeded
        ScraperSvc->>Store: set('coinmarketcap', parsedCoinData)
        ScraperSvc->>Store: set('yahoofinance', parsedNews)
        ScraperSvc->>Store: set('financialjuice', parsedNews)
    else all failed
        ScraperSvc->>ScraperSvc: skip this run, log warning
    end
```

### 2. OpenRouter Routine — AI Synthesis & Persistence (Every 20–100 s)

```mermaid
sequenceDiagram
    participant RS as RoutineService
    participant ORS as OpenrouterRoutineService
    participant Store as MemoryKeyStore
    participant FAS as FinancialAgentService
    participant OS as OpenRouterService
    participant API as OpenRouter API
    participant Repo as ScrapedDataRepo
    participant DB as PostgreSQL

    RS->>ORS: timer fires

    ORS->>Store: get('financialjuice')
    ORS->>Store: get('yahoofinance')
    ORS->>Store: get('coinmarketcap')

    alt all 3 present in store
        ORS->>FAS: queryChat({ financialJuiceContent, yahooFinanceContent, coinmarketCapContent, ... })
        FAS->>FAS: buildPrompt() — hedge-fund markdown prompt
        FAS->>OS: chat(prompt, model)
        OS->>API: POST /chat/completions
        API-->>OS: { choices[0].message.content }
        OS-->>FAS: markdown string
        FAS-->>ORS: markdown string

        ORS->>Store: set('completion', markdown)
        ORS->>Store: set('completion-previous', markdown)

        ORS->>Repo: create({ source_id: uuid, parsed_data, raw_content, data_hash, status:'result' })
        Repo->>DB: INSERT INTO scraped_data
        DB-->>Repo: saved row
        Repo-->>ORS: ok

        Note over ORS: bump timer to 100 s (interval after success)
    else not ready yet
        ORS->>ORS: log "Not ready yet! skipped."
        Note over ORS: keep timer at 20 s
    end
```

### 3. Auth — Login Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant App as Elysia (server.ts)
    participant AS as AuthService
    participant Repo as UserRepo (TypeORM)
    participant DB as PostgreSQL
    participant JWT as Elysia jwt plugin

    C->>App: POST /api/v1/auth/login { email, password }
    App->>AS: login(email, password)
    AS->>Repo: findOne({ where: { email } })
    Repo->>DB: SELECT * FROM users WHERE email = ?
    DB-->>Repo: user row
    Repo-->>AS: UserEntity
    AS->>AS: compare password_hash with bcrypt
    AS->>AS: buildAccessTokenPayload / buildRefreshTokenPayload
    AS->>Repo: create(userSessionEntity)
    Repo->>DB: INSERT INTO user_sessions
    DB-->>Repo: session saved
    Repo-->>AS: { accessTokenPayload, refreshTokenPayload, rawRefreshToken }

    App->>App: sign access JWT (SignJWT, HS256, expires 1d)
    App->>App: sign refresh JWT (SignJWT, HS256, expires 7d)
    App->>C: Set-Cookie: refresh_token (HTTP-only, 7d maxAge)
    App->>C: { success, data: { accessToken, refreshToken } }
```

### 4. Auth — Refresh Token Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant App as Elysia (server.ts)
    participant AS as AuthService
    participant Repo as SessionRepo (TypeORM)
    participant DB as PostgreSQL
    participant JWT as Elysia jwt plugin

    C->>App: POST /api/v1/auth/refresh (Cookie: refresh_token)
    App->>AS: refreshTokens(refreshToken)
    AS->>Repo: findOneOrFail({ where: { refreshTokenHash: sha256(token) } })
    Repo->>DB: SELECT * FROM user_sessions WHERE refresh_token_hash = ?
    DB-->>Repo: session row
    Repo-->>AS: UserSessionEntity
    AS->>AS: verify not revoked, not expired
    AS->>AS: build new accessTokenPayload + new refreshTokenPayload
    AS->>Repo: update session (new refresh_token_hash, new expires_at)
    Repo->>DB: UPDATE user_sessions
    DB-->>Repo: updated
    Repo-->>AS: { accessTokenPayload, refreshTokenPayload, rawRefreshToken }

    App->>App: sign new JWT pairs
    App->>C: Set-Cookie: refresh_token (HTTP-only, rotated)
    App->>C: { success, data: { accessToken, refreshToken } }
```

### 5. Frontend — Fetching Completion

```mermaid
sequenceDiagram
    participant React as React SPA (PortfolioBlock)
    participant App as Elysia (port 3000)
    participant Store as MemoryKeyStore
    participant Repo as ScrapedDataRepo
    participant DB as PostgreSQL

    React->>App: GET /api/v1/openrouter/completion
    App->>Store: get('completion')
    Store-->>App: markdown string | undefined
    App->>Store: get('completion-previous')
    Store-->>App: markdown string | undefined

    alt stored completion exists
        App-->>React: { success: true, data: { latest, previous } }
        React->>React: render Markdown
    else no completion yet
        App-->>React: 404 { success: false, message: 'No completion available yet' }
    end
```

### 6. Telegram Webhook

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
    TS->>TS: makeRequest('sendMessage', { ... })
    TS->>TG: POST https://api.telegram.org/bot{token}/sendMessage
    TG-->>TS: TelegramMessage
    TS-->>App: TelegramMessage
    App-->>TG: { success: true }
```

---

## Key Notes

### Routines

Three background routines run after the server starts listening on port 3000. All are controlled by `ROUTINE_ENABLED` (default `false`) and use `ROUTINE_EXECUTION_MODE` (default `wait` — recursive `setTimeout`, next run only after current finishes).

| Routine | Interval | Purpose |
|---|---|---|
| `scraper-routine` | 20 s | Scrape CMC, YahooFinance, FinancialJuice → `MemoryKeyStore` |
| `openrouter-routine` | 20 s → 100 s after success | Read store → call OpenRouter → persist to `scraped_data` |
| `supabase-routine` | 300 s | Placeholder for periodic Supabase work |

### MemoryKeyStore as Pipeline State

`MemoryKeyStore` is the **only in-memory shared state** — it bridges the gap between the two independent routines without Redis. The scraper writes; the OpenRouter routine reads. No locking or concurrency control is needed because the `wait` execution mode serialises execution.

### CORS Origins

`http://localhost:5173`, `http://localhost:3001`, `http://localhost:3000` — aligns with Vite dev server (5173) and the Elysia server itself (3000).
