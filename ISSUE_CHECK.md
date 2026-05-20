# ISSUE CHECK — Apollo (Elysia + Bun)

Performance and infrastructure issues found during full-project audit.  
Assessment date: 2026-05-20 | Branch: `development`

---

## DB_CACHE

- [ ] **[DB_CACHE] [HIGH]** No TypeORM connection pool configured (`max`, `connectionTimeoutMillis`, `idleTimeoutMillis`, `keepAlive`) — `src/lib/db.ts:15` — Postgres opens a fresh TCP connection for every query under load. Add `extra: { max: 20, min: 5, connectionTimeoutMillis: 10000, idleTimeoutMillis: 30000, keepAlive: true }` to the DataSource.
- [ ] **[DB_CACHE] [MEDIUM]** `DATABASE_URL` empty-string fallback with no connectivity validation — `src/lib/db.ts:17` — If `DATABASE_URL` is missing at runtime, `AppDataSource.initialize()` fails silently with no retry or backoff. Fail fast with a clear error message.
- [ ] **[DB_CACHE] [MEDIUM]** No `logging: false` on DataSource — `src/lib/db.ts:15` — Every SQL query is emitted as console output in development; if this leaks to production it adds massive I/O overhead. Set `logging: env.bool('NODE_ENV') ? ['query'] : false` (or `false` outright).
- [ ] **[DB_CACHE] [MEDIUM]** No index on `scraped_data.captured_at` — `src/supabase/entities/scraped-data.entity.ts:20` — The completion route orders/range-filters on `captured_at`; every query forces a sequential scan. Add `@Index('idx_scraped_captured', ['captured_at'])`.
- [ ] **[DB_CACHE] [MEDIUM]** No index on `scraped_data.status` — `src/supabase/entities/scraped-data.entity.ts:33` — Filtering by `status` (e.g. `WHERE status = 'result'`) has no b-tree support. Add `@Index('idx_scraped_status', ['status'])`.
- [ ] **[DB_CACHE] [HIGH]** No index on `user_sessions.refresh_token_hash` — `src/supabase/entities/user-session.entity.ts:18` — `refreshTokens()` does `findOne({ where: { refresh_token_hash: bcryptHash }, revoked_at: null })` — this requires a full table scan every time. Add `@Index('idx_session_token_hash', ['refresh_token_hash'])`.
- [ ] **[DB_CACHE] [HIGH]** `user_id` FK in `user_sessions` has no single-column index — `src/supabase/entities/user-session.entity.ts:15-16` — The `findOne(... { relations: ['user'] })` triggers a JOIN on `user_id` with no supporting index, compounding the scan on every refresh call. Add `@Index('idx_session_user', ['user_id'])`.
- [ ] **[DB_CACHE] [MEDIUM]** No index on `scraping_sources.source_type` or `is_active` — `src/supabase/entities/scraping-source.entity.ts:12,22` — Both columns are used as filter predicates by the scraper routine; without indexes, listing/querying active sources falls back to sequential scan.
- [ ] **[DB_CACHE] [LOW]** No composite index on `(email, is_active)` in `users` — `src/supabase/entities/user.entity.ts:12-13` — Login always filters on both; the existing unique index on `email` alone forces a second lookup for `is_active`. A `@Index('idx_users_email_active', ['email', 'is_active'])` covers the login query fully.

---

## SCRAPER

- [ ] **[SCRAPER] [HIGH]** New `BrowserContext` created and destroyed on every `scrape()` call — `src/lib/services/scraper.service.ts:54,154` — Browser context creation costs 200–500ms and significant heap; doing it 3× in every routine iteration is the dominant source of routine latency. Pool or reuse contexts.
- [ ] **[SCRAPER] [HIGH]** ScraperRoutineService hardcodes `concurrency = 1` — `src/lib/services/scraper-routine.service.ts:41` — All 3 sources are scraped sequentially even though `scrapeMultiple()` supports workers. With three 15-30s pages, total routine latency is 45-90s. Pass `concurrency = Math.max(1, os.cpus().length / 2)`.
- [ ] **[SCRAPER] [MEDIUM]** `addPageEvaluateLazyScroll` has no hard upper-bound scroll attempt limit — `src/lib/services/scraper.service.ts:122-128` — `while (true)` with `waitForTimeout(2000)` will hang indefinitely if the page height never stabilises (e.g. JS error). Add a `maxScrollAttempts` counter (e.g. 50 attempts).
- [ ] **[SCRAPER] [LOW]** `pageLocatorPerformClickCoordinate` loop has a hardcoded `3000ms` `waitForTimeout` before each mouse click — `src/lib/services/scraper.service.ts:87` — Make this value configurable via `ScrapeOptions`.
- [ ] **[SCRAPER] [LOW]** Exponential retry backoff in `scrapeMultiple` has no upper cap — `src/lib/services/scraper.service.ts:240-242` — Delays grow as `1000 × 2^attempt` with no ceiling (1s, 2s, 4, 8, 16, 32, 64, 128…). Cap with `Math.min(delay, 30000)`.

---

## MEMORY

- [ ] **[MEMORY] [HIGH]** `MemoryKeyStore` has no global entry cap — `src/lib/memory-key-store.ts:24,32` — The internal `Map` grows without bound. The `completion` key stores full LLM markdown; overwrites only happen when new data arrives, never when the store is full. Add a `maxEntries` option with LRU eviction.
- [ ] **[MEMORY] [HIGH]** `pendingPromises` map leaks on synchronous factory throw — `src/lib/memory-key-store.ts:114-123` — If `factory()` throws synchronously before the promise settles, the `try…finally` does not execute yet, so the key stays in `pendingPromises` permanently, blocking all future `getOrSet` calls for that key. Wrap `factory()` call in its own `try…catch` that cleans up the map on throw.
- [ ] **[MEMORY] [MEDIUM]** Scraped data written to `MemoryKeyStore` has no TTL — `src/lib/services/scraper-routine.service.ts:52-69` — `set('coinmarketcap', …)` is called without a TTL; stale data lives until overwritten by the next routine run. Pass a TTL (e.g. 120000ms for 2 minutes).
- [ ] **[MEMORY] [LOW]** `completion-previous` key is overwritten with the same value as `completion` — `src/lib/services/openrouter-routine.service.ts:51` — Both lines write the identical `chatCompletion` object. To act as a true "previous" snapshot, capture the value before line 50 and write that to `completion-previous`.

---

## API_NETWORK

- [ ] **[API_NETWORK] [HIGH]** OpenRouter `chat()` call has no hard timeout HARD-stop — `src/lib/services/financial-agent.service.ts:11-18` — Delegates to `createChatCompletion` which uses `AbortSignal.timeout`, but `AbortSignal.timeout` originated from Node 18+ — confirm `ENOMEM` safety. As an extra safeguard, wrap the call in `Promise.race` with a 300s hard ceiling.
- [ ] **[API_NETWORK] [MEDIUM]** No response caching for `createChatCompletion` — `src/lib/services/openrouter.service.ts:31-76` — Identical prompts (same model + messages) always hit OpenRouter again. Cache responses by `hash(model + messages)` in `MemoryKeyStore` with a short TTL (e.g. 60s) to deduplicate routine cycles.
- [ ] **[API_NETWORK] [LOW]** `stream` option present but never enabled — `src/lib/services/openrouter.service.ts:53` — The parameter is serialized but always `false`; callers (including `financial-agent.service.ts:14`) never pass `stream: true`. Enable streaming for long LLM responses to reduce time-to-first-byte.

---

## ROUTINE

- [ ] **[ROUTINE] [HIGH]** `routineTime` is mutated inside the async callback — `src/lib/services/openrouter-routine.service.ts:9,69,72,75` — On the first successful completion, `this.routineTime` is set to `100000` and passed as the *initial* interval to `startRoutine`. On subsequent calls the capture is `this.routineTime` at registration time (100000) — so it looks correct here. However, the routine never resets back to `20000` when `isStoreHasContents` becomes `false` again after a scrape failure; `routineTime` stays inflated permanently. Make the interval dynamic or use `skip` mode instead.
- [ ] **[ROUTINE] [MEDIUM]** `'skip'` mode behaves identically to `'overlap'` — `src/lib/routine.service.ts:53-58` — Skipped and overlapping modes both use `setInterval()` with no in-flight guard. `skip` is supposed to fire on the next tick after completion, just like `wait`, but uses `setInterval` so concurrent executions do pile up. Either implement `skip` with the same recursive `setTimeout` pattern as `wait`, or set executionMode to `'wait'` and document the difference clearly.

---

## SERVER_CONFIG

- [ ] **[SERVER_CONFIG] [HIGH]** No global rate limiting middleware — `src/server.ts:71` — Public routes (`/api/v1/auth/login`, `/api/v1/auth/create-user`, `/api/v1/openrouter/simple-chat`) are callable arbitrarily fast. Add an Elysia rate-limit plugin (e.g. `@elysiajs/ratelimit`).
- [ ] **[SERVER_CONFIG] [MEDIUM]** No request body size limit — `src/server.ts:71` — Elysia accepts unbounded POST bodies; a large JSON payload (e.g. a malicious `scrape` body) allocates on the event loop before the route handler can reject it. Add `bodyLimit: '10mb'` (or an appropriate value) at the app level.
- [ ] **[SERVER_CONFIG] [MEDIUM]** No gzip/brotli compression middleware — `src/server.ts:71` — The API completion endpoint (`/api/v1/openrouter/completion`) returns large markdown payloads uncompressed to all clients. Add `app.use(compress())` from `elysia-compress`.
- [ ] **[SERVER_CONFIG] [HIGH]** No graceful HTTP connection draining on SIGINT/SIGTERM — `src/server.ts:335-343` — `process.exit(0)` is called immediately after `routineService.stopAllRoutines()` without draining in-flight requests or closing the HTTP server's acceptor. Active requests are dropped silently. Replace with `app.stop()` (Elysia's built-in graceful shutdown), then `await Bun.sleep(2000)`, then `process.exit`.
- [ ] **[SERVER_CONFIG] [HIGH]** Single-thread event loop; CPU-bound work (cheerio/cheerio parsers in scraper targets, bcrypt hashing in `AuthService`) competes with HTTP request handling — `src/server.ts:312` — Move the scraper service and all playwright browser work into a `Worker` via `Bun.worker()` or `Worker()` to isolate it from the hot path.
- [ ] **[SERVER_CONFIG] [MEDIUM]** CORS origin list contains only localhost addresses — `src/server.ts:73` — In production, this array needs to be populated with real origins; an empty array silently drops all cross-origin requests, a wrong-origin array erroneously responds with a CORS error rather than indicating misconfiguration. Read from `env.string('CORS_ORIGIN')`.

---

## LOGGING

- [ ] **[LOGGING] [LOW]** `executeRoutine` catches errors but re-throws them to the caller `startRoutine()` — `src/lib/routine.service.ts:28-33` — With `'wait'` mode the re-thrown error is already caught at line 68, but in `'overlap'`/`'skip'` mode the re-throw propagates to the `setInterval` timer which logs to the console uncaught. Catch inside the handler and log with `evlog` per project convention.

---

## TYPESCRIPT_CONFIG

- [ ] **[TS_CONFIG] [HIGH]** `strictNullChecks: false` — `tsconfig.json:12` — Null-pointer bugs slip through type-checking to runtime. Set to `true`.
- [ ] **[TS_CONFIG] [HIGH]** `noImplicitAny: false` — `tsconfig.json:13` — All implicit `any` types are silently accepted. Set to `true` and fix resulting errors.
- [ ] **[TS_CONFIG] [MEDIUM]** `forceConsistentCasingInFileNames: false` — `tsconfig.json:15` — Mixed-case import paths (e.g. `import foo from './Foo'` vs `import foo from './foo'`) work locally on macOS (case-insensitive) but break on Linux CI runners. Set to `true`.
- [ ] **[TS_CONFIG] [MEDIUM]** `skipLibCheck: true` — `tsconfig.json:11` — Silences all type mismatches in `typeorm`, `@elysiajs/jwt`, and `react-markdown` declarations. Errors in these libraries go undetected locally. Consider `false` for CI-only builds or `--noEmit` type-check.
- [ ] **[TS_CONFIG] [MEDIUM]** Frontend excluded from type-check scope — `tsconfig.json:28` — `"exclude": ["src/web", "vite.config.ts"]` means `bun run check` never touches the frontend. Frontend type errors only surface at Vite build time. Remove `src/web` from `exclude` or add a separate `tsconfig.web.json`.

---

## FRONTEND

- [ ] **[FRONTEND] [HIGH]** Hardcoded `http://localhost:3000` in fetch — `src/web/src/components/PortfolioBlock/PortfolioBlock.tsx:82` — Breaks on every non-localhost deployment (returns CORS error or 200 with wrong server). Read the base URL from `import.meta.env.VITE_API_URL` or use a relative path `/api/v1/...`.
- [ ] **[FRONTEND] [HIGH]** `React.StrictMode` fires `useEffect` twice in development — `src/web/src/components/PortfolioBlock/PortfolioBlock.tsx:78,100` — No `AbortController` on the fetch; the second call is un-cancelled, causing a duplicate network request on every mount. Add `AbortController` and call `signal` in `fetch()`.
- [ ] **[FRONTEND] [HIGH]** Loading state logic is dead code — `src/web/src/components/PortfolioBlock/PortfolioBlock.tsx:76,96,122-124` — `setLoading(false)` runs in `finally`, but the JSX that showed `"Loading..."` is commented out. A second StrictMode-triggered fetch race leaves `loading` stuck `false` and the UI in an indeterminate state. Either remove the loading state entirely or re-enable the JSX guard.
- [ ] **[FRONTEND] [MEDIUM]** No retry/backoff on fetch — `src/web/src/components/PortfolioBlock/PortfolioBlock.tsx:81-86` — One transient network failure drops the markdown UI to `"No latest completion available"` permanently. Add `fetch` retry with exponential backoff (2 retries).
- [ ] **[FRONTEND] [MEDIUM]** `react-markdown` re-parses the full LLM markdown on every render — `src/web/src/components/PortfolioBlock/PortfolioBlock.tsx:118` — Any state change in the component (navigation bar, unrelated state) rebuilds the entire markdown AST. Wrap the `<Markdown>` subtree in `React.memo` or memoise the parsed output.
- [ ] **[FRONTEND] [LOW]** `PortfolioBlock` is an un-memoised component — `src/web/src/components/PortfolioBlock/PortfolioBlock.tsx:73` — Re-renders on every parent state change. Wrap `export default React.memo(PortfolioBlock)`.
- [ ] **[FRONTEND] [LOW]** No `manualChunks` in Vite build config — `vite.config.ts:13-16` — `react`, `react-dom`, `react-markdown`, `remark-gfm`, and `daisyui` are all bundled into a single chunk. Add `build.rollupOptions.output.manualChunks` to split vendor from app code.
- [ ] **[FRONTEND] [LOW]** No `Cache-Control` / `immutable` headers on static asset serving — `src/server.ts:306-308` — Elysia `file()` helper defaults to no cache headers; the browser re-downloads `index.html` on every navigation causing a full SPA reload cycle. Add `Cache-Control: public, max-age=31536000, immutable` for hashed assets and a short max-age for `index.html`.

---

## DOCKER

- [ ] **[DOCKER] [MEDIUM]** `db_init.sql` executed via `psql` via the CMD shell entrypoint with no retry on transient DB unavailability — `Dockerfile:51` — If Supabase is temporarily unreachable at startup the container exits 1 and Kubernetes restarts it in a crash-loop. Add a retry loop: `for i in 1 2 3 4 5; do psql … && break; sleep 5; done`.
- [ ] **[DOCKER] [LOW]** Healthcheck `curl` binary presence in `oven/bun:1-distroless` — `Dockerfile:40-42` — `postgresql-client` is installed via `apk add`, but `curl` currently serves only the healthcheck. Verify `curl` is present in the final image or install it explicitly.

---

_Format: `[x]` = resolved, `[ ]` = open. Priority order per section is highest risk → lowest._
