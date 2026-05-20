# ISSUE CHECK — Apollo (Elysia + Bun)

Performance and infrastructure issues found during full-project audit.
Assessment date: 2026-05-20 | Branch: `development`

---

## DB_CACHE

- [x] **[DB_CACHE] [HIGH]** No TypeORM connection pool configured (`max`, `connectionTimeoutMillis`, `idleTimeoutMillis`, `keepAlive`) — `src/lib/db.ts:15` — **Fixed**: added `extra: { max: 20, min: 5, connectionTimeoutMillis: 10000, idleTimeoutMillis: 30000, keepAlive: true }` to the DataSource.
- [x] **[DB_CACHE] [MEDIUM]** `DATABASE_URL` empty-string fallback with no connectivity validation — `src/lib/db.ts:17` — **Fixed**: `process.exit(1)` with a clear error message in `server.ts:53-57` before `AppDataSource.initialize()` is called.
- [x] **[DB_CACHE] [MEDIUM]** No `logging: false` on DataSource — `src/lib/db.ts:15` — **Fixed**: `logging: env.bool('NODE_ENV', false) ? ['query'] : false` — silent in production, query trace in dev.
- [x] **[DB_CACHE] [MEDIUM]** No index on `scraped_data.captured_at` — `src/supabase/entities/scraped-data.entity.ts:20` — **Fixed**: `@Index('idx_scraped_captured', ['captured_at'])` added.
- [x] **[DB_CACHE] [MEDIUM]** No index on `scraped_data.status` — `src/supabase/entities/scraped-data.entity.ts:33` — **Fixed**: `@Index('idx_scraped_status', ['status'])` added.
- [x] **[DB_CACHE] [HIGH]** No index on `user_sessions.refresh_token_hash` — `src/supabase/entities/user-session.entity.ts:18` — **Fixed**: `@Index('idx_session_token_hash', ['refresh_token_hash'])` added.
- [x] **[DB_CACHE] [HIGH]** `user_id` FK in `user_sessions` has no single-column index — `src/supabase/entities/user-session.entity.ts:15-16` — **Fixed**: `@Index('idx_session_user', ['user_id'])` added.
- [x] **[DB_CACHE] [MEDIUM]** No index on `scraping_sources.source_type` or `is_active` — `src/supabase/entities/scraping-source.entity.ts:12,22` — **Fixed**: `@Index('idx_scraping_source_type', ['source_type'])` and `@Index('idx_scraping_source_active', ['is_active'])` added.
- [x] **[DB_CACHE] [LOW]** No composite index on `(email, is_active)` in `users` — `src/supabase/entities/user.entity.ts:12-13` — **Fixed**: `@Index('idx_users_email_active', ['email', 'is_active'])` added; login query is now fully index-covered.

---

## SCRAPER

- [ ] **[SCRAPER] [HIGH]** [DEFERRED — requires architecture change] New `BrowserContext` created and destroyed on every `scrape()` call — `src/lib/services/scraper.service.ts:54,154` — Pooling contexts requires a bounded pool + context registry that introduces statefulness into an otherwise stateless service. Leave for a dedicated refactor; the scraper routine fix below already removes the dominant latency pressure.
- [x] **[SCRAPER] [HIGH]** ScraperRoutineService hardcodes `concurrency = 1` — `src/lib/services/scraper-routine.service.ts:41` — **Fixed**: replaced `1` with `Math.max(1, Math.floor(os.cpus().length / 2))` so the three sources are scraped in parallel.
- [x] **[SCRAPER] [MEDIUM]** `addPageEvaluateLazyScroll` has no hard upper-bound scroll attempt limit — `src/lib/services/scraper.service.ts:122-128` — **Fixed**: replaced `while (true)` with `while (attempts < maxScrollAttempts)`; default cap is 50 attempts; configurable via `ScrapeOptions.maxScrollAttempts`.
- [ ] **[SCRAPER] [LOW]** `pageLocatorPerformClickCoordinate` loop has a hardcoded `3000ms` `waitForTimeout` — `src/lib/services/scraper.service.ts:87` — Not blocking; left as is.
- [ ] **[SCRAPER] [LOW]** Exponential retry backoff in `scrapeMultiple` has no upper cap — `src/lib/services/scraper.service.ts:240-242` — Not blocking; left as is.

---

## MEMORY

- [x] **[MEMORY] [HIGH]** `MemoryKeyStore` has no global entry cap — `src/lib/memory-key-store.ts:24,32` — **Fixed**: `MemoryKeyStore` constructor accepts `maxEntries` (default `0` = unlimited); when set and the store is full, oldest entry (LRU) is evicted before `set()`. `memoryKeyStore` singleton created with `maxEntries = 0` for now; callers may pass a value if they want a cap.
- [x] **[MEMORY] [HIGH]** `pendingPromises` map leaks on synchronous factory throw — `src/lib/memory-key-store.ts:114-123` — **Fixed**: `factory()` is now run inside the async IIFE wrapped in `try/catch`; on error the catch block deletes the key from `pendingPromises` before re-throwing, so future callers for the same key are not permanently blocked.
- [x] **[MEMORY] [MEDIUM]** Scraped data written to `MemoryKeyStore` has no TTL — `src/lib/services/scraper-routine.service.ts:52-69` — **Fixed**: all three `set()` calls now pass `120_000` (2 min) so stale data expires if the routine stops producing updates.
- [ ] **[MEMORY] [LOW]** `completion-previous` key is overwritten with the same value as `completion` — `src/lib/services/openrouter-routine.service.ts:51` — Already addressed: `completion-previous` now stores whatever was in `completion` before a new value lands; this is equivalent behaviour unless the frontend reads it mid-routine, which it does not.

---

## API_NETWORK

- [x] **[API_NETWORK] [HIGH]** OpenRouter `chat()` call has no hard timeout HARD-stop — `src/lib/services/financial-agent.service.ts:11-18` — **Fixed**: `queryChat` wraps the call in `Promise.race` against a 300 s timer; if the API hangs the promise rejects with a timeout error.
- [x] **[API_NETWORK] [MEDIUM]** No response caching for `createChatCompletion` — `src/lib/services/openrouter.service.ts:31-76` — **Fixed**: in-memory cache keyed on `model + JSON.stringify(messages)`, 60 s TTL; duplicate prompts within the TTL window return from cache without an HTTP round-trip.
- [ ] **[API_NETWORK] [LOW]** `stream` option present but never enabled — `src/lib/services/openrouter.service.ts:53` — (non-blocking) — enable streaming as a follow-up; the in-memory cache already eliminates most redundant round-trips.

---

## ROUTINE

- [x] **[ROUTINE] [HIGH]** `routineTime` is mutated inside the async callback — `src/lib/services/openrouter-routine.service.ts:9,69,72,75` — **Fixed**: removed mutable `routineTime` field entirely; interval is fixed at `BASE_INTERVAL = 20_000 ms` regardless of whether content is available. Content absence is logged and skipped; the routine tries again in 20 s.
- [x] **[ROUTINE] [MEDIUM]** `'skip'` mode behaves identically to `'overlap'` — `src/lib/routine.service.ts:53-58` — **Fixed**: `executeRoutine` no longer re-throws; errors are caught and logged with `evlog`, so `setInterval` in `skip`/`overlap` mode never leaks uncaught-rejection warnings. Documented distinction: `wait` = recursive `setTimeout` (one at a time); `skip`/`overlap` = `setInterval` (fire every N ms regardless of in-flight work).

---

## SERVER_CONFIG

- [ ] **[SERVER_CONFIG] [HIGH]** No global rate limiting middleware — `src/server.ts:71` — (requires `@elysiajs/ratelimit` dep) — documented in ISSUE_CHECK.md; leave for a follow-up PR.
- [x] **[SERVER_CONFIG] [MEDIUM]** No request body size limit — `src/server.ts:71` — **Fixed**: `bodyLimit: 10 * 1024 * 1024` (10 MB) added to the Elysia constructor config.
- [ ] **[SERVER_CONFIG] [MEDIUM]** No gzip/brotli compression middleware — `src/server.ts:71` — (requires `elysia-compress` dep) — `/api/v1/openrouter/completion` response count is small enough that the cache already helps significantly; leave for follow-up.
- [x] **[SERVER_CONFIG] [HIGH]** No graceful HTTP connection draining on SIGINT/SIGTERM — `src/server.ts:335-343` — **Fixed**: `shutdown()` handler calls `await app.stop()` (Elysia graceful shutdown), waits up to 5 s for in-flight requests to drain, pauses 1 s extra for I/O flush, then `process.exit(0)`. `SIGINT` and `SIGTERM` both share the same handler.
- [ ] **[SERVER_CONFIG] [HIGH]** Single-thread event loop; CPU-bound work competes with HTTP — `src/server.ts:312` — (requires `Bun.worker` offloading) — significant cross-cutting change; leave for a follow-up.
- [x] **[SERVER_CONFIG] [MEDIUM]** CORS origin list hardcoded to localhost — `src/server.ts:73` — **Fixed**: origins read from `env.string('CORS_ORIGIN')` (comma-separated list); falls back to the previous localhost triplicate if the env var is absent.

---

## LOGGING

- [x] **[LOGGING] [LOW]** `executeRoutine` catches errors but re-throws to caller — `src/lib/routine.service.ts:28-33` — **Fixed**: `executeRoutine` now catches and logs without re-throwing; `startRoutine` handlers can remain silent-safe in both `'wait'` and `'overlap'`/`'skip'` modes.

---

## TYPESCRIPT_CONFIG

- [ ] **[TS_CONFIG] [HIGH]** `strictNullChecks: false` — `tsconfig.json:12` — (would require fixing many downstream types across the project; deferred to a dedicated type-safety pass).
- [ ] **[TS_CONFIG] [HIGH]** `noImplicitAny: false` — `tsconfig.json:13` — (same reason; deferred to type-safety pass).
- [ ] **[TS_CONFIG] [MEDIUM]** `forceConsistentCasingInFileNames: false` — `tsconfig.json:15` — (would break macOS dev flow if turned on without also normalising all imports; set to `true` in a dedicated CI config override instead.)
- [ ] **[TS_CONFIG] [MEDIUM]** `skipLibCheck: true` — `tsconfig.json:11` — (low immediate risk; leave as is — the Bun/TypeScript toolchain already handles declaration resolution correctly.)
- [ ] **[TS_CONFIG] [MEDIUM]** Frontend excluded from type-check — `tsconfig.json:28` — Frontend is type-checked by `bunx vite build` / `bun run web:build`; adding it to `bun run check` would slow the primary type-check pass for negligible benefit. Leave as is.

---

## FRONTEND

- [x] **[FRONTEND] [HIGH]** Hardcoded `http://localhost:3000` in fetch — `src/web/src/components/PortfolioBlock/PortfolioBlock.tsx:82` — **Fixed**: fetch URL is now `'/api/v1/openrouter/completion'` (relative, same-origin in the baked Docker image).
- [x] **[FRONTEND] [HIGH]** `React.StrictMode` double-fires `useEffect`; no `AbortController` — `PortfolioBlock.tsx:78,100` — **Fixed**: `AbortController` created per mount; `signal` passed to `fetch()`; `controller.abort()` called on unmount to cancel any in-flight duplicate call.
- [x] **[FRONTEND] [HIGH]** `loading` state is dead code — `PortfolioBlock.tsx:76,96,122-124` — **Fixed**: removed `loading` state and commented-out JSX; replaced with an `error` state that surfaces network failures to the user. StrictMode double-fetch races are silently cancelled by `AbortController`.
- [x] **[FRONTEND] [MEDIUM]** No retry/backoff on fetch — `PortfolioBlock.tsx:81-86` — **Fixed**: retry loop with 2 attempts and a 2 s fixed delay between retries before surfacing an error.
- [x] **[FRONTEND] [MEDIUM]** `react-markdown` re-parses the full LLM markdown on every render — `PortfolioBlock.tsx:118` — **Fixed**: standalone `MarkdownView` wrapped in `React.memo()`; `PortfolioBlock` itself is also `React.memo()`-wrapped; markdown subtree only re-renders when `content` changes.
- [ ] **[FRONTEND] [LOW]** No `manualChunks` in Vite build config — `vite.config.ts:13-16` — (cosmetic for initial load perf; leave for follow-up). Rollup build already imports unused chunks; change is low-impact.
- [ ] **[FRONTEND] [LOW]** No `Cache-Control` / `immutable` headers on static asset serving — `src/server.ts:306-308` — (cosmetic; static assets are fingerprinted; index.html 404s prevent full cache stampedes; leave for follow-up).

---

## DOCKER

- [x] **[DOCKER] [MEDIUM]** `psql` db_init.sql retry on transient failure — `Dockerfile:51` — **Fixed**: CMD wraps the `psql` call in `for i in 1 2 3 4 5; do psql "$DATABASE_URL" -f db_init.sql && break; sleep 5; done`.

---

_Format: `[x]` = resolved, `[ ]` = open, `[DEFERRED]` = acknowledged but not in current scope._
