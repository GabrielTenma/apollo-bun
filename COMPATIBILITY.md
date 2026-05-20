# Bun Compatibility Guide for Apollo

> This file documents compatibility tensions encountered while running the
> Apollo backend on Bun — and is now a **legacy reference** since the project
> is migrating from NestJS to **Elysia** (a Bun-native framework that
> eliminates every `design:paramtypes` / `emitDecoratorMetadata` issue
> automatically). See **ELYSIA_MIGRATION.md** for the phased migration
> checklist.
>
> The remaining issues listed here are specific to **NestJS-on-Bun** (the
> current codebase). Once the migration is complete, the entire file can be
> deleted.

**Last updated:** 2026-05-18  
**Runtime (current):** Bun 1.x · NestJS 9 · TypeScript  
**Target runtime:** Bun 1.x · Elysia · TypeScript (no NestJS)  
**Bun preload (current):** `bunfig.toml` already preloads `reflect-metadata`

---

## How to Use This File

```
- [ ]  Unticked  → not yet started
- [x]  Checked   → completed and verified
```

Mark a task complete only after the code change compiles and `bun run check`
(type-check) passes for the affected file(s).

---

## Category 1 — Core `design:paramtypes` / `emitDecoratorMetadata` Issue

**Root cause:** tsx / esbuild strips NestJS's `Reflect.metadata("design:paramtypes", …)`
calls from pre-compiled CJS bundles in `node_modules`. NestJS 9 ClassProvider
resolution silently resolves those params as `undefined`, causing silent runtime
failures (DI injection returns `undefined` instead of the expected dependency).

**Current status:** The codebase already applies the static-factory + public-field
workaround throughout. All explicitly identified broken paths are patched.
The open items in this section are leftover `any`-typed deps (safe but
incomplete) and audit-style confirmations.

### 1.1  Factory pattern applied — AuthService

- **File:** `src/auth/auth.service.ts`
- **Fix:** Private constructor + `AuthService.create(jwtService, userRepository, sessionRepository)` static factory. All deps assigned to public fields.
- **Status:** ✅ Already applied by author
- **Verify:** `grep -n "constructor() {}" src/auth/auth.service.ts` → line 32 shows private constructor called nowhere directly by NestJS.

### 1.2  Factory pattern applied — ScraperService

- **File:** `src/scraper/scraper.service.ts`
- **Fix:** Private constructor + `ScraperService.create()` static factory.
- **Status:** ✅ Already applied

### 1.3  Factory pattern applied — FinancialAgentService

- **File:** `src/openrouter/agents/financial.agent.ts`
- **Fix:** Private constructor + `FinancialAgentService.create(openRouterService)` static factory.
- **Status:** ✅ Already applied

### 1.4  Factory pattern applied — OpenRouterService

- **File:** `src/openrouter/openrouter.service.ts`
- **Fix:** Private constructor + `OpenRouterService.create()` static factory.
- **Status:** ✅ Already applied

### 1.5  Factory pattern applied — TelegramService

- **File:** `src/telegram/telegram.service.ts`
- **Fix:** Private constructor + `TelegramService.create()` static factory.
- **Status:** ✅ Already applied

### 1.6  Factory pattern applied — JwtAuthGuard (extends PassportStrategy whose constructor reads metadata)

- **File:** `src/common/guards/jwt-auth.guard.ts`
- **Fix:** Private constructor + `JwtAuthGuard.create(reflector)` static factory; registered as `APP_GUARD` via `useFactory` in `CommonModule`.
- **Status:** ✅ Already applied

### 1.7  Factory pattern applied — Routine services

- **Files:** `src/scraper/routines/scraper-routine.service.ts`, `src/openrouter/routines/openrouter-routine.service.ts`
- **Fix:** Private constructors + `.create(…)` static factories; injected via `useFactory` in their respective modules.
- **Status:** ✅ Already applied

### 1.8  Module-level factories for controllers and all providers

- **Files:** `src/scraper/scraper.module.ts`, `src/auth/auth.module.ts`, `src/openrouter/openrouter.module.ts`, `src/telegram/telegram.module.ts`, `src/common/common.module.ts`, `src/supabase/supabase.module.ts`
- **Fix:** `useFactory` + `inject: []` (or explicit token list) for every class-based provider.
- **Status:** ✅ Already applied — no `useClass` with a non-factory class that has constructor params remains in any of the six `providers` arrays.

---

### 1.9  **[ACTION REQUIRED]** Replace remaining `any`-typed DI tokens with precise provider tokens

`any` is currently used as the type annotation for several injected factory
arguments to silence TypeScript (not `tsx`-runtime issues). These `any`s are
safe at runtime but reduce maintainability. Replace them with the correct
provider tokens so that `bun run check` (type-check) can validate the full
signature graph.

| Location | Current `any` annotation | Correct type |
|---|---|---|
| `src/scraper/scraper.module.ts` `buildScraperRoutineService` args — `scrapedDataRepository: any` | `Respository<ScrapedDataEntity>` (via the `getRepositoryToken` token) |
| `src/scraper/scraper.module.ts` `buildScraperRoutineService` args — `constants: any` | `AppConstants` |
| `src/scraper/scraper.module.ts` `buildScraperController` args — `scrapingSourceRepository: any` | `Repository<ScrapingSourceEntity>` |
| `src/scraper/scraper.module.ts` `buildScraperController` args — `scrapedDataRepository: any` | `Repository<ScrapedDataEntity>` |
| `src/openrouter/openrouter.module.ts` `buildOpenrouterRoutineService` args — `routineService: any`, `scrapedDataRepository: any`, `constants: any` | `RoutineService`, `Repository<ScrapedDataEntity>`, `AppConstants` |

- **Steps:**
  - [ ] `src/scraper/scraper.module.ts`: Replace all `any` in factory function signatures with concrete types; add any missing `import` statements.
  - [ ] `src/openrouter/openrouter.module.ts`: Same for `buildOpenrouterRoutineService`.
  - [ ] Run `bun run check` and fix all remaining type errors.

---

## Category 2 — NodeJS.Timeout Type (ExactOptionalPropertyTypes Issue)

**Root cause:** Bun implements `setTimeout` return type as `number` (like browsers),
not `NodeJS.Timeout`. TypeScript's `--exactOptionalPropertyTypes` and strict
mapping treat `ReturnType<typeof setTimeout>` as `number` under Bun's
type definitions, causing an assignment mismatch when a variable is typed as
`NodeJS.Timeout`.

**Current status:** Partially worked around via `as NodeJS.Timeout` casts.
These casts silence the compiler but the stored values may actually be `number`
at runtime if Bun's type definitions are active.

### 2.1  Fix — `RoutineService.intervals` map

- **File:** `src/common/routines/services/routine.service.ts`
- **Lines:** 20, 104, 161–166, 174–179
- **Current workaround:** `as NodeJS.Timeout` cast on the returned wrapper object; `NodeJS.Timeout` type declared at the top.
- **Fix:** Use `ReturnType<typeof setTimeout>` everywhere `NodeJS.Timeout` appears.
- **Steps:**
  - [ ] Replace `private readonly intervals = new Map<string, NodeJS.Timeout>()` → `new Map<string, ReturnType<typeof setTimeout> | undefined>()`.
  - [ ] Replace `startRoutine()` return type `: NodeJS.Timeout` → `: ReturnType<typeof setTimeout>`.
  - [ ] Replace the cast `as NodeJS.Timeout` in the `wait`-mode wrapper (line 165) — remove the cast entirely.
  - [ ] In `stopRoutine()`/`stopAllRoutines()`: `clearInterval` + `clearTimeout` accept both `NodeJS.Timeout` and `number`, so no change needed there.
  - [ ] Run `bun run check` and confirm zero type errors.

### 2.2  Check — `OBSERVABLE` / `rxjs` piping under Bun

- No known incompatibility — verify at runtime:
  - [ ] Call `GET /api/v1/openrouter/completion` after server starts and confirm the response body serialises correctly (rxjs `map` + `tap` pipes inside `TransformInterceptor` and `LoggingInterceptor`).

---

## Category 3 — Database Connection (TypeORM + PostgreSQL via Supabase)

### 3.1  Verify TypeORM can still connect under Bun

- TypeORM runs against raw TCP/sockets — this is fully compatible with Bun.
- `retryAttempts: 0` in `SupabaseTypeOrmModule` prevents hanging on missing DB.
- **Steps:**
  - [ ] Confirm `DATABASE_URL` is set in `.env` and points to a reachable PostgreSQL (Supabase).
  - [ ] Start server with `bun run dev`; observe TypeORM connection log line.
  - [ ] If connection fails silently: check Supabase user/password is correct in the Postgres connection string (not the Supabase anon key).
  - [ ] If `synchronize: false` blocks migrations: confirm the DB schema already matches all entity definitions, or set `synchronize: true` temporarily for development.

### 3.2  TypeORM enum / `data-type` lookup under Bun

- Known issue in some `typeorm` versions: internal `Reflect` calls for column-types
  can break under ESM/tsx similarly to `design:paramtypes`. v0.3.29 should be fine,
  but confirm at startup.
- **Steps:**
  - [ ] Start the server; check for TypeORM errors about `Cannot read property 'length' of undefined` or similar entity/column-type resolution warnings.
  - [ ] If found: pin to a `typeorm` patch version known to work with ESM, or add `"emitDecoratorMetadata": false` guard around Entity metadata. See [typeorm-v0.3.29 ESM guide](https://github.com/typeorm/typeorm/issues/9816).

---

## Category 4 — `@nestjs/config` / `ConfigService` DI under tsx

**Root cause:** `ConfigModule.forRootAsync` injects `ConfigService` from
`@nestjs/config` (pre-compiled CJS in `node_modules`). Under tsx,
`ConfigService` may be instantiated with `undefined` for internal config
maps because tsx loses the NestJS `emitDecoratorMetadata` helpers in those
CJS bundles.

**Current status:** Mitigated by fallbacks to `process.env` in every
`registerAsync` `useFactory`. `CommonConfigService` (custom, ESM-native)
is the primary config reader.

### 4.1  Verify `auth.module.ts` has full `process.env` fallbacks

- **File:** `src/auth/auth.module.ts`
- The `JwtModule.registerAsync` factory currently uses `configService?.get(…) ?? process.env.KEY` pattern on all three required keys.
- **Steps:**
  - [ ] Run server with `JWT_SECRET` unset. Confirm startup fails with a clear error (not a silent `undefined` crash).
  - [ ] Set `JWT_SECRET` in `.env`; confirm server starts.
  - [ ] Confirm `JWT_ACCESS_EXPIRATION` and `JWT_REFRESH_EXPIRATION` both have `?? process.env.KEY` fallbacks (they currently do via `configService?.get<string>(…) ?? process.env.KEY`).

### 4.2  `CommonConfigService` is the single source of truth for env reads

- **Files:** `src/common/config/config.service.ts`, `src/common/config/config.module.ts`
- **Fix:** All feature-module config files (`openrouter.config.ts`, `telegram.config.ts`,
  `supabase.config.ts`) instantiate `CommonConfigService` directly, bypassing
  NestJS DI entirely.
- **Status:** ✅ Already applied
- **Steps:** No action needed. Confirm `grep -r "CommonConfigService" src/*/config/` shows all three config files using this pattern.

---

## Category 5 — Native Addon: `bcrypt` Under Bun

**Known issue:** `bcrypt` v6.x is a pure TypeScript re-export and is fully
Bun-compatible. `bcrypt` v5.x requires a native binary (`bcrypt_lib.node`) which
Bun may fail to load in ESM mode.

- **package.json** specifies `"bcrypt": "^6.0.0"` ✅
- Used in `src/auth/auth.service.ts` (password hashing, refresh-token hashing).
- **Steps:**
  - [ ] Confirm `bun install` produces no `bcrypt_lib.node` binary or compilation warning.
  - [ ] Call `POST /api/v1/auth/login` with a valid user; confirm `bcrypt.compare` returns `true`.

---

## Category 6 — Playwright Browser Under Bun

**Known issue:** The `playwright` npm package downloads its own Chromium and
spawns it as a child-process. Bun generally allows `child_process.spawn`, but
Chromium binary path resolution and sandbox flags may differ from Node.js.

- **Files:** `src/scraper/scraper.service.ts`
- The `--no-sandbox`, `--disable-setuid-sandbox` flags already mitigate the
  most common sandbox problem (line 56–57 of `scraper.service.ts`).
- **Steps:**
  - [ ] `bunx playwright install chromium` — install Chromium for playwright explicitly on first run.
  - [ ] `bun run dev` → trigger `ScraperRoutineService` (set `ROUTINE_ENABLED=true` in `.env`).
  - [ ] Watch for `Error: failed to launch chromium` in the log. If seen, check that `playwright install chromium` succeeded and the binary path is accessible.
  - [ ] If chromium fails to launch under Bun's sandbox, replace the `headless: true` option with `headless: 'new'` (Playwright's headed/headless modes changed in v1.35+).

---

## Category 7 — CJS Interop in Vite / React Frontend

- `package.json` has `"type": "module"` — bundles are treated as ESM.
- Vite handles CJS interop for the frontend build via its own plugin pipeline.
- Vite config, React build, and TailwindCSS v4 all use ESM `import` syntax.
- **Steps:**
  - [ ] `bun run web:build` — confirm no CJS resolution error.
  - [ ] `bun run check` — confirm TypeScript compiles without CJS-interop errors.

---

## Category 8 — Vite Config `path` (Node.js builtin in an ESM context)

- **File:** `vite.config.ts`
- `import path from 'path'` — In Bun's ESM environment, Node.js built-in module
  specifiers require either `"moduleResolution": "nodenext"` (already set, see
  tsconfig.json) or a shim.
- **tsconfig.json** already sets `"moduleResolution": "nodenext"` → this fixes
  `node:*` imports but NOT bare `"path"` in a Vite config file, which is not
  governed by `tsconfig.json`.
- **Status:** Likely works because Vite handles `path` internally; confirm.
- **Steps:**
  - [ ] Run `bun run build` — if Vite errors on `path` import, create a `vite.config.ts` shim: `import { dirname, join } from 'path'; import { fileURLToPath } from 'url'; const __dirname = dirname(fileURLToPath(import.meta.url))` and replace `path.resolve` calls with `join(__dirname, ...)`.
  - [ ] Note: This is a **dev/build-time** issue only; the frontend TS is not bundled by `tsx`.

---

## Category 9 — `Reflector` Injection in `APP_GUARD` Factories

- **File:** `src/common/common.module.ts`
- `Reflector` from `@nestjs/core` is injected into `JwtAuthGuard` and `RolesGuard` factory functions.
- Risk: Under tsx, `Reflector` from the pre-compiled CJS `@nestjs/core` bundle
  may return `undefined` from the DI container (the token is a class, not a
  string literal).
- **Current workaround:** It is a class token; tsx strips design:paramtypes, which
  Nest uses to resolve tokens. If this path breaks, both `JwtAuthGuard` and
  `RolesGuard` will receive `undefined` and crash on the first annotated route.
- **Steps:**
  - [ ] Start server; verify `app.listen(3000)` output does not show `Reflector is not defined`.
  - [ ] Call a `@Roles()`-protected endpoint (e.g., `GET /api/v1/openrouter/completion` without JWT). Confirm a 401/403 is returned, not a TypeError.
  - [ ] If `Reflector` is `undefined`, register it via a custom provider:
    ```ts
    { provide: Reflector, useValue: new Reflector() }
    ```
    in `CommonModule.providers`, and inject that provider into both guard factories.

---

## Category 10 — Response Util: `crypto.randomUUID()` Under Bun

- **Files:** `src/common/interceptors/transform.interceptor.ts`, `src/common/filters/http-exception.filter.ts`
- `crypto.randomUUID()` is used to generate `correlation_id` when no request header is present.
- `import * as crypto from 'crypto'` relies on Node.js `crypto` shim. Bun exposes
  `crypto.randomUUID()` natively at `globalThis.crypto`. In CJS `require('crypto')`
  shim, Bun redirects to its own implementation — this is expected to work.
- **Steps:**
  - [ ] Call any endpoint; confirm the JSON response body includes `"correlation_id"` as a UUID string (pattern `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`).
  - [ ] If `crypto.randomUUID is not a function` error occurs, replace with `globalThis.crypto.randomUUID()`.

---

## Category 11 — Supabase JS Client in ESM Under Bun

- **File:** `src/supabase/supabase.service.ts`
- `@supabase/supabase-js@^2.x` is pure-ESM and should work natively with Bun.
- `src/web/src/components/PortfolioBlock/PortfolioBlock.tsx` calls the backend
  at `http://localhost:3000` — the frontend fetch does not touch Supabase
  directly; this is not a client-side issue.
- **Steps:**
  - [ ] Set valid `SUPABASE_URL` and `SUPABASE_KEY` in `.env`.
  - [ ] `bun run dev` → call `GET /api/v1/supabase/health`.
  - [ ] If `createClient` throws, confirm you are using `@supabase/supabase-js@^2.38.0`
    (bundled: `^2.105.4` ✅) or later which supports Node.js ESM cleanly.

---

## Category 12 — NestJS `express` Adapter Under Bun

- NestJS 9 default adapter is `@nestjs/platform-express` which wraps `express`.
- Bun works well with Express: it uses `http.createServer` under the hood
  (already in Bun's standard library).
- `import { Request, Response } from 'express'` in interceptors/filters is fine.
- **Steps:**
  - [ ] No action required unless startup silently fails with `net` module errors.

---

## Category 13 — `ref-metadata` Preload is Correct — Verify

- **File:** `bunfig.toml` (project root)
- Already set to `preload = ["reflect-metadata"]`.
- Under Bun ESM, module scopes don't share `global.Reflect`, so without this
  preload, `Reflect.defineMetadata` / `Reflect.getMetadata` calls in NestJS
  core may operate on an empty `Reflect` object, causing DI resolution failures
  even with the factory pattern if any metadata-reliant path is accidentally hit.
- **Steps:**
  - [ ] Delete `node_modules/reflect-metadata`, then `bun install` and run `bun run dev` to confirm the preload resolves `reflect-metadata` before any NestJS code.
  - [ ] Confirm the startup log does not show `Reflect is not defined`.

---

## Category 14 — Scripts Use `bunx` — Ensure Bun Registry Access

- The `package.json` scripts call `bunx tsx`, `bunx vite`, `bunx playwright`.
- Bun's package manager uses its own registry mirror. If `bunx` cannot resolve
  local binaries (workspace packages), tsx/vite/playwright may not be found.
- **Steps:**
  - [ ] `bun run dev` — confirm both `tsx` and `vite` resolve from `node_modules/.bin`.
  - [ ] If `bunx tsx` fails with `command not found`, replace `bunx` with `bun` in the script
    (`"dev": "bun tsx src/main.ts"`, `"build": "bun tsx src/main.ts & bun vite build --config vite.config.ts & wait"`).

---

## Category 15 — Environment Variable Renaming Consistency

The `.env.example` and `AGENTS.md` list these variables, but the runtime code
reads them via `CommonConfigService`:

| Expected by docs | Actual read key | File |
|---|---|---|
| `OPENROUTER_API_KEY` | `OPENROUTER_API_KEY` | `openrouter.config.ts` ✅ |
| `OPENROUTER_BASE_URL` | `OPENROUTER_BASE_URL` | `openrouter.config.ts` ✅ |
| `OPENROUTER_DEFAULT_MODEL` | `OPENROUTER_DEFAULT_MODEL` | `openrouter.config.ts` ✅ |
| `OPENROUTER_TIMEOUT` | `OPENROUTER_TIMEOUT` | `openrouter.config.ts` ✅ |
| `TELEGRAM_BOT_TOKEN` | `TELEGRAM_BOT_TOKEN` | `telegram.config.ts` ✅ |
| `TELEGRAM_WEBHOOK_URL` | `TELEGRAM_WEBHOOK_URL` | `telegram.config.ts` ✅ |
| `TELEGRAM_WEBHOOK_SECRET` | `TELEGRAM_WEBHOOK_SECRET` | `telegram.config.ts` ✅ |
| `TELEGRAM_TIMEOUT` | `TELEGRAM_TIMEOUT` | `telegram.config.ts` ✅ |
| `ROUTINE_ENABLED` | `ROUTINE_ENABLED` | `routine.config.ts`, `common.module.ts` ✅ |
| `ROUTINE_EXECUTION_MODE` | `ROUTINE_EXECUTION_MODE` | same ✅ |
| `JWT_SECRET` | `JWT_SECRET` | `environment.util.ts` ✅ |
| `JWT_ACCESS_EXPIRATION` | `JWT_ACCESS_EXPIRATION` | `auth.service.ts` ✅ |
| `JWT_REFRESH_EXPIRATION` | `JWT_REFRESH_EXPIRATION` | `auth.service.ts` ✅ |
| `JWT_SECRET_CREATION` | `JWT_SECRET_CREATION` | `auth.service.ts` ✅ |
| `SUPABASE_URL` | `SUPABASE_URL` | `supabase.config.ts` ✅ |
| `SUPABASE_KEY` | `SUPABASE_KEY` | `supabase.config.ts` ✅ |
| `SUPABASE_PASSWORD` | _(not read by code)_ | ⚠️ see below |
| `SUPABASE_USEDIRECT` | _(not read by code)_ | ⚠️ see below |
| `DATABASE_URL` | `DATABASE_URL` | `typeorm.module.ts` ✅ |

- **Steps:**
  - [ ] Confirm `SUPABASE_PASSWORD` and `SUPABASE_USEDIRECT` are either removed from `.env.example` / `AGENTS.md` or used by `supabase.service.ts`. Currently they are silently ignored — they should be documented unused or the code updated.

---

## Quick-Start: Running the NestJS App (Pre-Migration State)

If you have **not** started the NestJS → Elysia migration yet, use this to
verify the app is healthy before beginning:

```sh
# 1. Clean install
bun install

# 2. Type-check
bun run check

# 3. Start server (tail -f the output for errors)
bun run dev
```

Expected clean output:
- No `TypeError: Cannot read properties of undefined` referencing `design:paramtypes`
- No `Reflector is not defined`
- No `Cannot find module 'path'` / `crypto` errors
- No `AbortSignal.timeout is not a function`
- No `bcrypt` native binary error (verify bcrypt v6: `bun pm ls bcrypt`)

---

## If You Encounter Errors Here

> The checklist below documents NestJS-on-Bun workarounds that are applied in
> the **current** codebase. Every workaround listed below is eliminated
> automatically by migrating to Elysia — NestJS's DI system, its `@Module()`
> / `@Injectable()` decorators, and the `design:paramtypes` metadata path are
> gone. **You do not need to apply the remaining workarounds in this file**
> if you are proceeding with `ELYSIA_MIGRATION.md`.

---

## Index of Known Issues (Resolved in Elysia Migration)

| Issue | NestJS workaround applied (current codebase) | Elysia path |
|---|---|---|
| `design:paramtypes` silently returns `undefined` | Factory + public-field pattern in every service/module | Elysia has no DI — providers resolved by `new` directly |
| `NodeJS.Timeout` type mismatch | `as NodeJS.Timeout` casts | Bun `setTimeout` returns `number`; fix `Map<string, number>` |
| `Reflector` DI in guards | `APP_GUARD` `useFactory` | No guards — Elysia uses `beforeHandle` hooks / `derive()` |
| `bcrypt` native binary | Pinned v6 (pure TS) | Same — no change needed |
| TypeORM ESM metadata | `@Entity` works under Bun | Same — confirm TypeORM v0.3.29 works under Bun runtime |
| `AbortSignal.timeout` | Used directly — native in Bun | Same — no change needed |
| `crypto.randomUUID()` | Used in interceptors/filters | Same — `globalThis.crypto.randomUUID()` always available in Bun |
