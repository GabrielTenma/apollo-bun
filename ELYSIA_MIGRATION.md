# Apollo — NestJS → Elysia Migration Guide

> **Goal:** Replace every NestJS framework concern (modules, DI, guards, interceptors,
> decorators) with their Elysia equivalents so Apollo runs as a pure Elysia + Bun
> application with zero NestJS runtime overhead.

**Last updated:** 2026-05-18  
**Starting point:** `package.json` has `@nestjs/*` removed; `elysia` added.  
**Entry point after migration:** `src/server.ts` (replace `src/main.ts`)

---

## How to Use

```
- [ ]  Unticked  → not yet started
- [x]  Checked   → completed and verified
```

Complete checklist items in order. If you need to pause and resume later,
the checked rows serve as a resume point with no ambiguity.

---

## Pre-Migration Cleanup

### [ ] Backup existing project state

```sh
git add -A && git commit -m "pre-elysia-migration: clean NestJS state"
```

### [ ] Update `package.json` — remove NestJS deps

Remove these from `dependencies`:
```
@nestjs/common  @nestjs/config  @nestjs/core  @nestjs/jwt
@nestjs/passport  @nestjs/platform-express  @nestjs/serve-static
@nestjs/typeorm  reflect-metadata  rxjs  passport  passport-jwt
```

Add to `dependencies`:
```
elysia                     # latest
@elysiajs/jwt              # JWT plugin
@elysiajs/cors             # CORS plugin
@elysiajs/cookie           # cookie parsing (needed for refresh-token flow)
@elysiajs/body             # body parsing (belt-and-suspenders; Elysia includes this)
bcrypt                     # standalone — pinned same as before "^6.0.0"
```

Remove these from `devDependencies`:
```
@nestjs/cli  @nestjs/schematics  @nestjs/testing
@types/passport-jwt  ts-loader  source-map-support
```

Add to `devDependencies`:
```
@types/bcrypt    # keep if using TS types; omit if not needed
typescript       # keep (bun handles build via tsx)
```

Run `bun install` and confirm zero errors.

---

## Step 1 — Scaffold Elysia Server

### [ ] Create `src/server.ts` (replaces `src/main.ts`)

`src/server.ts` will own the Elysia `app` instance and all route handlers.
NestJS modules, `@Injectable()`, `@Module()`, `@Controller()` annotations,
and module bootstrapping are all removed in one place.

---

## Step 2 — Migrate Configuration

### [ ] Delete `src/common/config/config.module.ts`, `src/common/config/config.service.ts`

`CommonConfigService` was the NestJS-safe `process.env` reader. In Elysia,
read env vars directly via `Bun.env` or a small helper function. All three
`registerAs` config files (`openrouter.config.ts`, `telegram.config.ts`,
`supabase.config.ts`) are equally removable.

### [ ] Delete config wire-up files

```
src/common/config/
src/common/routines/config/routine.config.module.ts
```

### [ ] Create `src/config/env.ts` (single env helper)

```ts
export const env = {
  string: (k: string, d?: string) => (Bun.env[k] ?? d),
  number: (k: string, d?: number) => {
    const v = Bun.env[k];
    return v ? Number.parseInt(v, 10) || d : d;
  },
  bool: (k: string, d = false): boolean =>
    (Bun.env[k] ?? '').toLowerCase() === 'true' || d,
};
```

Replace every `import { env } from '../common/utils/environment.util'` with
`import { env } from '../config/env'` after this helper is created.

### [ ] Create `src/config/index.ts` barrel export

```ts
export * from './env';
```

### [ ] Update `bunfig.toml`

Remove the `preload = ["reflect-metadata"]` line — Elysia has no dependency
on `reflect-metadata`. When the line is removed, verify the app still starts
cleanly.

### [ ] Update `tsconfig.json`

Remove from `compilerOptions`:
```
"emitDecoratorMetadata": false,
"experimentalDecorators": true,
```
KEEP `"moduleResolution": "nodenext"` and `"esModuleInterop": true`.
Ensure `"resolveJsonModule": false` stays (pg is CJS — avoid auto `require`).

---

## Step 3 — Migrate Utilities (No framework dependency)

These files have zero NestJS dependency. Move them into `src/lib/` or keep
in `src/common/utils/` — either works, but re-organise away from the
`common/` prefix to signal utility-tier rather than NestJS-tier.

- [ ] `src/common/utils/memory-key-store.util.ts` → `src/lib/memory-key-store.ts`
- [ ] `src/common/utils/response.util.ts` → `src/lib/response.util.ts`
- [ ] `src/common/utils/pagination.util.ts` → `src/lib/pagination.util.ts`
- [ ] `src/common/utils/date.util.ts` → `src/lib/date.util.ts`
- [ ] `src/common/utils/string.util.ts` → `src/lib/string.util.ts`
- [ ] `src/common/utils/index.ts` → `src/lib/index.ts`

Update all import paths across the codebase (`grep -rl "from.*common/utils" src/`).

---

## Step 4 — Migrate Core Services to Plain Classes

Every `@Injectable()` class is replaced by a plain TypeScript class with
no decorator. Dependencies are resolved at construction time (manual DI) or
via Elysia's `derive`.

### 4.1 [ ] `src/lib/routine.service.ts` (replaces `src/common/routines/services/routine.service.ts`)

Drop the `@Injectable()` decorator. Drop `OnModuleDestroy` interface. Export a
plain class. Keep the same public API:

```ts
import { env } from '../config/env';

export interface RoutineConfig {
  enabled: boolean;
  executionMode?: 'wait' | 'skip' | 'overlap';
}

export class RoutineService {
  constructor(private config: RoutineConfig) {}

  /* keep every method as-is — only drop NestJS types */
  isEnabled(): boolean { return this.config.enabled; }
  /* ... */

  // Replace NodeJS.Timeout → number everywhere:
  readonly intervals = new Map<string, number>();
  startRoutine(/* ... */): number { /* ... */ }
  stopRoutine(routineName: string): void { /* ... */ }
  stopAllRoutines(): void { /* ... */ }
}
```

### 4.2 [ ] `src/lib/services/scraper.service.ts` (replaces `src/scraper/scraper.service.ts`)

Remove `@Injectable()`, the private constructor, and the `ScraperService.create()`
factory. Export a plain class. Keep the same public methods (`scrape`, `scrapeMultiple`,
`extractStructuredData`, `closeBrowser`). The `playwright` import stays
identical — it has no NestJS dependency.

### 4.3 [ ] `src/lib/services/openrouter.service.ts` (replaces `src/openrouter/openrouter.service.ts`)

Same treatment: plain class, no decorator, same public methods (`createChatCompletion`,
`listModels`, `chat`).

### 4.4 [ ] `src/lib/services/telegram.service.ts` (replaces `src/telegram/telegram.service.ts`)

Same: plain class, no NestJS types. Keep `env` import path updated.

### 4.5 [ ] `src/lib/services/auth.service.ts` (replaces `src/auth/auth.service.ts`)

Remove `@Injectable()`, `private constructor()`, `AuthService.create()`. Export
a plain class. All methods (`createUser`, `login`, `generateAccessToken`,
`generateRefreshToken`, `refreshTokens`) stay identical. Remove `bcrypt` import
to a local `node_modules` path (not via NestJS DI).

### 4.6 [ ] `src/lib/services/financial-agent.service.ts` (replaces `src/openrouter/agents/financial.agent.ts`)

Plain class, no decorator. `openRouterService` becomes a constructor param of
type `OpenRouterService`.

### 4.7 [ ] `src/lib/services/supabase-orm.service.ts` (replaces `src/common/typeorm/typeorm.service.ts`)

Plain class. Drop the `@Inject('DATA_SOURCE')` decorator — TypeORM DataSource
will be created and injected manually in `src/lib/db.ts` (see Step 5).

### 4.8 [ ] `src/lib/services/scraper-routine.service.ts` (replaces `src/scraper/routines/scraper-routine.service.ts`)

Plain class. Remove `@Injectable()`, `implements OnModuleInit`, and all NestJS
imports. Move the `onModuleInit()` body into a plain `start()` method. Accept
deps as plain constructor params:

```ts
export class ScraperRoutineService {
  constructor(
    public routineService: RoutineService,
    public coinMarketCapTarget: CoinmarketCapTarget,
    public yahooFinanceTarget: YahooFinanceTarget,
    public financialJuiceTarget: FinancialJuiceTarget,
    public scraperService: ScraperService,
    public scrapedDataRepository: any,   // type after Step 5
    public constants: AppConstants,
  ) {}

  start() {
    if (!this.routineService.isEnabled()) return;
    this.routineService.startRoutine('scraper-routine', async () => {
      /* ... exact same body as before ... */
    }, 20000);
  }

  async runManually(name: string) {
    await this.routineService.executeRoutine(name, async () => { /* ... */ });
  }
}
```

### 4.9 [ ] `src/lib/services/openrouter-routine.service.ts` (replaces `src/openrouter/routines/openrouter-routine.service.ts`)

Same as 4.8.

### 4.10 [ ] `src/lib/services/supabase-routine.service.ts` (replaces `src/supabase/routines/supabase-routine.service.ts`)

Same — plain class, `start()` method, no NestJS lifecycle.

---

## Step 5 — Database (TypeORM)

### 5.1 [ ] Create `src/lib/db.ts` — manual TypeORM DataSource

```ts
import 'reflect-metadata';   // keep for TypeORM only, not Elysia
import { DataSource } from 'typeorm';
import { env } from './config/env';
import { UserEntity } from '../supabase/entities/user.entity';
import { UserAuthProviderEntity } from '../supabase/entities/user-auth-provider.entity';
import { UserSessionEntity } from '../supabase/entities/user-session.entity';
import { TelegramBotEntity } from '../supabase/entities/telegram-bot.entity';
import { TelegramChatEntity } from '../supabase/entities/telegram-chat.entity';
import { TelegramUpdateEntity } from '../supabase/entities/telegram-update.entity';
import { ScrapingSourceEntity } from '../supabase/entities/scraping-source.entity';
import { ScrapedDataEntity } from '../supabase/entities/scraped-data.entity';
import { FeatureConfigEntity } from '../supabase/entities/feature-config.entity';

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: env.string('DATABASE_URL') ?? '',
  synchronize: false,
  autoLoadEntities: true,
  retryAttempts: 0,
  entities: [
    UserEntity, UserAuthProviderEntity, UserSessionEntity,
    TelegramBotEntity, TelegramChatEntity, TelegramUpdateEntity,
    ScrapingSourceEntity, ScrapedDataEntity, FeatureConfigEntity,
  ],
});
```

### 5.2 [ ] Delete NestJS TypeORM module files

```
src/common/typeorm/typeorm.module.ts
src/common/typeorm/typeorm.service.ts
```

### 5.3 [ ] Wire DataSource into services

In `src/server.ts` (or a small init block), await `AppDataSource.initialize()`
before starting the Elysia server. Wrap in `try/catch` and log the error.

---

## Step 6 — Migrate TypeScript Targets (Playwright scrape targets)

Each target file in `src/scraper/target/` currently uses `@Injectable()`. Remove
the decorator from each and export the class plain. No constructor-di changes
are needed — each target only holds a `ScraperService` reference assigned
manually (they already use the factory pattern).

- [ ] `src/scraper/target/financialjuice.target.ts` — remove `@Injectable()`, keep class
- [ ] `src/scraper/target/yahoofinance.target.ts` — same
- [ ] `src/scraper/target/coinmarketcap.target.ts` — same

---

## Step 7 — Define Elysia Routes (`src/server.ts`)

### 7.1 [ ] Minimal route skeleton

```ts
import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { jwt } from '@elysiajs/jwt';
import { body } from '@elysiajs/body';
import { cookie } from '@elysiajs/cookie';
import { Env } from './config/env';
// wire all service initialisation here
```

### 7.2 [ ] Auth routes (`/api/v1/auth`)

| NestJS route | Elysia equivalent |
|---|---|
| `POST /api/v1/auth/create-user` | `.post('/api/v1/auth/create-user', ({ body }) => authService.createUser(/* body */))` |
| `POST /api/v1/auth/login` | `.post('/api/v1/auth/login', ({ body, set }) => /* set cookie */)` |
| `POST /api/v1/auth/refresh` | `.post('/api/v1/auth/refresh', ({ body, cookie }) => /* verify & rotate */)` |
| `GET /api/v1/auth/profile` | `.get('/api/v1/auth/profile', ({ jwt, user }) => /* protected */)` |

NestJS `@Public()` → no JWT guard on the route  
NestJS `@Roles()` → Elysia `guard: (context) => { /* check roles */ }`

### 7.3 [ ] Scraper routes (`/api/v1/scraper`)

All routes from `ScraperController + FinancialJuiceTarget +
CoinmarketCapTarget + YahooFinanceTarget`. Attach instances to the Elysia
instance via `derive()` or capture them in the closure at route registration.

| NestJS route | handoff |
|---|---|
| `POST /api/v1/scraper/scrape` | inject `ScraperService` → `scraper.scrape(body)` |
| `POST /api/v1/scraper/scrape-multiple` | same → `scraper.scrapeMultiple(body.options)` |
| `POST /api/v1/scraper/extract` | same → `scraper.scrape(body)` + `scraper.extractStructuredData(…)` |
| `GET /api/v1/scraper/health` | plain return |
| `GET /api/v1/scraper/financialjuice` | `memoryKeyStore.get('financialjuice')` |
| `GET /api/v1/scraper/coinmarketcap` | same |
| `GET /api/v1/scraper/yahoofinance` | same |
| `GET/POST /api/v1/scraper/sources`… | `ScrapingSourceRepository` via `AppDataSource.getRepository(…)` |

### 7.4 [ ] OpenRouter routes (`/api/v1/openrouter`)

| NestJS route | handoff |
|---|---|
| `POST /api/v1/openrouter/chat` | `openRouterService.createChatCompletion(body)` |
| `GET /api/v1/openrouter/models` | `openRouterService.listModels()` |
| `POST /api/v1/openrouter/simple-chat` | `openRouterService.chat(prompt, model, systemPrompt)` |
| `GET /api/v1/openrouter/health` | plain return |
| `GET /api/v1/openrouter/completion` | `memoryKeyStore.get('completion')` + previous |

### 7.5 [ ] Telegram routes (`/api/v1/telegram`)

| NestJS route | handoff |
|---|---|
| `POST /api/v1/telegram/webhook` | `telegramService.makeRequest` / handleUpdate |
| `POST /api/v1/telegram/send-message` | `telegramService.sendMessage(body)` |
| `POST /api/v1/telegram/send-text` | `telegramService.sendText(chatId, text, parseMode)` |
| `POST /api/v1/telegram/set-webhook` | `telegramService.setWebhook(url, secret)` |
| `GET /api/v1/telegram/bot-info` | `telegramService.getMe()` |
| `GET /api/v1/telegram/webhook-info` | `telegramService.getWebhookInfo()` |
| `GET /api/v1/telegram/health` | plain return |

### 7.6 [ ] Supabase routes (`/api/v1/supabase`)

| NestJS route | handoff |
|---|---|
| `GET /api/v1/supabase/health` | plain return |
| `POST /api/v1/supabase/create` | `supabaseService.create(body.table, body.data)` |
| `GET /api/v1/supabase/read/:table` | `supabaseService.read(table, filter)` |
| `PUT /api/v1/supabase/update` | `supabaseService.update(body.table, body.id, body.data)` |
| `DELETE /api/v1/supabase/delete` | `supabaseService.delete(body.table, body.id)` |

### 7.7 [ ] Remove `src/main.ts`, update `package.json` scripts

```jsonc
// package.json scripts (replace all bunx refs)
{
  "start": "bun run src/server.ts",
  "dev":   "bun --watch run src/server.ts",
}
```

Remove `bunx` calls — `bun` can run `.ts` files natively. Remove the Vite build
from the `build` script until `package.json` ~bun run build` is reimplemented.

---

## Step 8 — Migrate Guards / Auth

### 8.1 [ ] Delete NestJS guard directory

```
src/common/guards/jwt-auth.guard.ts
src/common/guards/roles.guard.ts
```

### 8.2 [ ] Delete NestJS decorator directory

```
src/common/decorators/public.decorator.ts
src/common/decorators/roles.decorator.ts
src/common/decorators/current-user.decorator.ts
```

### 8.3 [ ] Create `src/lib/app.guards.ts`

```ts
import { Context } from 'elysia';
import { auth } from '@elysiajs/jwt';
import type { JwtPayload } from '../auth/auth.service';

/** Attach to Elysia guards config in server.ts */
export const requireJwt = () => ({
  beforeHandle({ jwt, set }: Context) {
    if (!jwt) {
      set.status = 401;
      return { success: false, message: 'No token provided' };
    }
    // jwt is already verified by plugin; `user` is the decoded payload
    return;
  },
});

export const requireRole = (...roles: string[]) => ({
  beforeHandle({ jwt, set }: any) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const user = jwt?.payload as JwtPayload | undefined;
    if (!user || !user.roles.some((r: string) => roles.includes(r))) {
      set.status = 403;
      return { success: false, message: 'Forbidden' };
    }
  },
});
```

### 8.4 [ ] Wire JWT plugin in `src/server.ts`

```ts
import { Elysia } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import { env } from './config/env';

const app = new Elysia()
  .use(jwt({
    name: 'jwt',
    secret: env.string('JWT_SECRET') ?? '',
  }))
  // ... mount modules
```

Token exchange: all JWT creation/verification goes through Elysia's `jwt` plugin
instead of NestJS `JwtModule`. Use its `sign` / `verify` methods in the auth
routes.

---

## Step 9 — Routines (Scheduler)

### 9.1 [ ] Keep `src/lib/routine.service.ts` (already migrated in Step 4.1)

Drop NestJS `OnModuleDestroy`. Use a plain `Module#dispose` / `cleanup()` hook
in `src/server.ts` to stop all intervals on `SIGINT`/`SIGTERM`.

### 9.2 [ ] Attach routines in `src/server.ts`

After all service instances are created and after `AppDataSource` is ready,
manually call:

```ts
new ScraperRoutineService(scraperService, targets, repos, constants).start();
new OpenrouterRoutineService(routineService, financialAgent, scrapedDataRepo, constants).start();
```

Replace `OnModuleInit` lifecycle hooks with explicit constructor-style wiring
or a `startRoutines()` function called once at boot.

---

## Step 10 — Migrate Frontend

### 10.1 [ ] Delete `src/web/src/App.tsx`

### 10.2 [ ] Strip Vite from `package.json` and `vite.config.ts`

The Vite build is unrelated to Elysia. Deleted or moved to a separate
`web/` workspace. The React frontend (if kept) should be built independently 
of the Elysia server.

### 10.3 [ ] Serve Elysia routes on `:3000` with CORS

In `src/server.ts`:

```ts
.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3001', 'http://localhost:3000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
}))
.listen(3000, () => console.log('Apollo on :3000'));
```

---

## Step 11 — Delete All NestJS Infrastructure

### [ ] Delete

```
src/app.module.ts
src/app.controller.ts
src/app.service.ts
src/app.controller.spec.ts
src/main.ts
src/module-root.ts  (if present)
src/common/common.module.ts
src/common/filters/http-exception.filter.ts
src/common/interceptors/transform.interceptor.ts
src/common/interceptors/logging.interceptor.ts
src/common/typeorm/
src/constants/app.module.ts
src/constants/app.constants.ts
nest-cli.json
nestconfig  (any nest config dirs)
```

### [ ] Update remaining `import`

Run:

```sh
grep -rl "@nestjs\|from 'express'" src/ | grep -v node_modules
```

Fix every remaining NestJS import path individually. Common patterns:

| Removed import | Replace with |
|---|---|
| `from '@nestjs/common'` | delete — use plain types |
| `from '../common/decorators/…'` | `from '../lib/auth.guards'` |
| `from '../common/utils/response.util'` | `from '../lib/response.util'` |
| `from '../supabase/entities/…'` | keep — TypeORM entities are plain classes |

---

## Step 12 — `AppDataSource` / DI clean-up

### [ ] Replace `scrapedDataRepository` types in factories

After removing NestJS `getRepositoryToken`, use `AppDataSource.getRepository()`
explicitly:

```ts
const scrapedDataRepository = AppDataSource.getRepository(ScrapedDataEntity);
```

### [ ] Assign all deps manually in `src/server.ts`

```ts
const config = { enabled: env.bool('ROUTINE_ENABLED'), executionMode: env.string('ROUTINE_EXECUTION_MODE', 'wait') as 'wait' | 'skip' | 'overlap' };
const routineService = new RoutineService(config);
const memoryKeyStore = new MemoryKeyStore();
const scraperService = new ScraperService();
const financialJuiceTarget = new FinancialJuiceTarget(scraperService);
const yahooFinanceTarget = new YahooFinanceTarget(scraperService);
const coinMarketCapTarget = new CoinmarketCapTarget(scraperService);
const openRouterService = new OpenRouterService();
const financialAgent = new FinancialAgentService(openRouterService);
const telegramService = new TelegramService();
const supabaseService = new SupabaseService();
const supabaseOrmService = new SupabaseOrmService(AppDataSource.getDataSource());

// TypeORM repos
const scrapedDataRepository    = AppDataSource.getRepository(ScrapedDataEntity);
const scrapingSourceRepository = AppDataSource.getRepository(ScrapingSourceEntity);
const userRepository           = AppDataSource.getRepository(UserEntity);
const sessionRepository        = AppDataSource.getRepository(UserSessionEntity);

// Routine dep chains
new ScraperRoutineService(routineService, coinMarketCapTarget, yahooFinanceTarget, financialJuiceTarget, scraperService, scrapedDataRepository, { appName: 'apollo', scrapedContentStore: memoryKeyStore }).start();
new OpenrouterRoutineService(routineService, financialAgent, scrapedDataRepository, { appName: 'apollo', scrapedContentStore: memoryKeyStore }).start();
new SupabaseRoutineService(routineService, supabaseService).start();
```

---

## Step 13 — Auth / JWT Replacements

### [ ] JwtService → `@elysiajs/jwt` sign/verify

NestJS `JwtModule` and `JwtService.sign()` / `.verify()`:

```ts
import { jwt } from '@elysiajs/jwt';

// sign
const accessToken = await app.jwt.sign({
  sub: userId,
  email,
  roles,
}, { exp: '1d' });  // or a number

// verify (Elysia verifies automatically on protected routes)
```

### [ ] `bcrypt` stays exactly as-is

`bcrypt.hash` / `bcrypt.compare` is a standalone lib — no change.

---

## Step 14 — OpenRouter Calls (fetch)

`OpenRouterService` and `TelegramService` already use `fetch` / `AbortSignal.timeout` —
both work identically under Elysia/Bun. No changes needed.

### [ ] Drop `@nestjs/common` Logger

Replace `new Logger(ClassName.name)` with `console.log` / `console.warn` / `console.error`
or a lightweight format function. Elysia has no equivalent of NestJS Logger;

---

## Step 15 — CORS

`src/server.ts`:

```ts
import { cors } from '@elysiajs/cors';

app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3001', 'http://localhost:3000'],
}));
```

Drop `src/common/interceptors/transform.interceptor.ts` (response envelope is now
handled in the Elysia hook — see below).

---

## Step 16 — Response Envelope

NestJS shipped every response through `TransformInterceptor`:
```json
{ "success": true, "data": ..., "correlation_id": "...", "timestamp": "..." }
```

Recreate this in Elysia using `derive()` — runs per-request before the handler:

```ts
import { Elysia } from 'elysia';
import { v4 as uuidv4 } from 'uuid';  // already in bun stdlib: Bun.randomUUIDv4()

app
  .derive(({ request }) => ({
    correlation_id: request.headers.get('x-correlation-id') ?? request.headers.get('x-request-id') ?? crypto.randomUUID(),
  }))
  .onBeforeHandle(({ correlation_id, set, status }) => ({
    correlation_id,
    timestamp: new Date().toISOString(),
  }))
```

For simplicity, do the envelope in every handler:

```ts
{ success: true, data: result, correlation_id: context.correlation_id, timestamp: new Date().toISOString() }
```

---

## Step 17 — `NodeJS.Timeout` Fix (carried over)

`setInterval` / `setTimeout` in Bun returns `number` (same as browser), not
`NodeJS.Timeout`. Every occurrence in the source must use `number`:

- [ ] `src/lib/routine.service.ts` — `intervals: Map<string, number>`
- [ ] All `wait`-mode wrappers — remove `as NodeJS.Timeout` cast

---

## Step 18 — TypeORM UUID default

The entity `ScrapingSourceEntity` uses DB defaults like `() => 'gen_random_uuid()'`
(Postgres `pgcrypto`). Verify these columns exist in your Dev DB:
```sql
SELECT gen_random_uuid();   -- should return a UUID
```

No code change required; confirm tables exist in the correct Schema.

---

## Step 19 — `src/server.ts` Final Shape

```ts
// src/server.ts  — single entry point replaces main.ts + all modules

import { Elysia } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import { cors } from '@elysiajs/cors';
import { body } from '@elysiajs/body';
import { cookie } from '@elysiajs/cookie';
import { env } from './config/env';

import { AppDataSource } from './lib/db';
import { MemoryKeyStore } from './lib/memory-key-store';
import { RoutineService } from './lib/routine.service';
import { ScraperService } from './lib/services/scraper.service';
import { OpenRouterService } from './lib/services/openrouter.service';
import { TelegramService } from './lib/services/telegram.service';
import { SupabaseService } from './lib/services/supabase.service';
import { SupabaseOrmService } from './lib/services/supabase-orm.service';
import { AuthService } from './lib/services/auth.service';
import { FinancialAgentService } from './lib/services/financial-agent.service';

import { UserEntity } from './supabase/entities/user.entity';
import { UserSessionEntity } from './supabase/entities/user-session.entity';
import { ScrapedDataEntity } from './supabase/entities/scraped-data.entity';
import { ScrapingSourceEntity } from './supabase/entities/scraping-source.entity';
/* ... other entity imports for repos ... */

// ─── service instances ────────────────────────────────────────────
const config = {
  enabled: env.bool('ROUTINE_ENABLED'),
  executionMode: env.string('ROUTINE_EXECUTION_MODE', 'wait') as 'wait' | 'skip' | 'overlap',
};
const routineService = new RoutineService(config);
const memoryKeyStore = new MemoryKeyStore();
const scraperService = new ScraperService();
const openRouterService = new OpenRouterService();
const financialAgent = new FinancialAgentService(openRouterService);
const telegramService = new TelegramService();
const supabaseService = new SupabaseService();
const supabaseOrmService = new SupabaseOrmService(AppDataSource);

// ─── TypeORM repos ─────────────────────────────────────────────────
const scrapedDataRepo = AppDataSource.getRepository(ScrapedDataEntity);
const scrapingSourceRepo = AppDataSource.getRepository(ScrapingSourceEntity);
const userRepo = AppDataSource.getRepository(UserEntity);
const sessionRepo = AppDataSource.getRepository(UserSessionEntity);
const authService = new AuthService(
  /* JwtService replaced by Elysia jwt plugin — see Step 13 */ null,
  userRepo,
  sessionRepo,
);

// ─── scrape targets ────────────────────────────────────────────────
const financialJuiceTarget = new FinancialJuiceTarget(scraperService);
const yahooFinanceTarget = new YahooFinanceTarget(scraperService);
const coinMarketCapTarget = new CoinmarketCapTarget(scraperService);

// ─── Elysia app ───────────────────────────────────────────────────
const app = new Elysia()
  .use(cors({ origin: ['http://localhost:5173', 'http://localhost:3001', 'http://localhost:3000'] }))
  .use(jwt({
    name: 'jwt',
    secret: env.string('JWT_SECRET') ?? '',
  }))
  .use(body())
  .use(cookie())

  // ─── health ─────────────────────────────────────────────────
  .get('/health', () => ({ status: 'ok', service: 'apollo' }))

  // ─── auth routes ────────────────────────────────────────────
  /* implement each route here — see Step 6 */

  // ─── scraper routes ──────────────────────────────────────────
  /* implement each route here — see Step 6 */

  // ─── openrouter routes ───────────────────────────────────────
  /* implement each route here — see Step 6 */

  // ─── telegram routes ─────────────────────────────────────────
  /* implement each route here — see Step 6 */

  // ─── supabase routes ─────────────────────────────────────────
  /* implement each route here — see Step 6 */

  .listen(3000, () => console.log('Apollo Elysia on :3000'));
```

---

## Step 20 — `compile`, `docgen`, `check` — Remove NestJS Build Tools

- [ ] `nest-cli.json` — delete
- [ ] `tsconfig.build.json` — delete
- [ ] `tsconfig.web.node.json` — delete
- [ ] `tsconfig.web.json` — delete (move to web/ workspace if keeping the frontend)
- [ ] Update scripts in `package.json`:

```jsonc
{
  "scripts": {
    "dev":          "bun --watch run src/server.ts",
    "start":        "bun run src/server.ts",
    "check":        "bunx tsc --noEmit",
    "lint":         "bunx eslint \"src/**/*.ts\" --fix",
    "test":         "bun test --timeout 12000 --pattern src/**/*.spec.ts",
    "build":        "",
    "web:dev":      "bunx vite --config vite.config.ts",     // if keeping frontend
    "web:build":    "bunx vite build --config vite.config.ts",// if keeping frontend
  }
}
```

---

## Step 21 — Environment Variables Sanity Check

Confirm all env vars still used by the migrated code match what is documented
in `AGENTS.md`:

| Env var | Used by | Already correct |
|---|---|---|
| `DATABASE_URL` | `src/lib/db.ts` | ✅ |
| `JWT_SECRET` | `src/server.ts` → JWT plugin | ✅ |
| `JWT_ACCESS_EXPIRATION` | auth route handlers | ✅ |
| `JWT_REFRESH_EXPIRATION` | auth route handlers | ✅ |
| `JWT_SECRET_CREATION` | auth route handlers | ✅ |
| `OPENROUTER_API_KEY` | `OpenRouterService` | ✅ |
| `OPENROUTER_BASE_URL` | `OpenRouterService` | ✅ |
| `OPENROUTER_TIMEOUT` | `OpenRouterService` | ✅ |
| `TELEGRAM_BOT_TOKEN` | `TelegramService` | ✅ |
| `TELEGRAM_TIMEOUT` | `TelegramService` | ✅ |
| `ROUTINE_ENABLED` | `RoutineService` | ✅ |
| `ROUTINE_EXECUTION_MODE` | `RoutineService` | ✅ |
| `SUPABASE_URL` | `SupabaseService` | ✅ |
| `SUPABASE_KEY` | `SupabaseService` | ✅ |
| `SUPABASE_PASSWORD` | unused — remove from `.env.example` / `AGENTS.md` | ⚠️ |
| `SUPABASE_USEDIRECT` | unused — remove from `.env.example` / `AGENTS.md` | ⚠️ |

- [ ] Run `bun run check` — zero TS errors
- [ ] `bun run dev` — server starts on `:3000` with no NestJS warnings
- [ ] `curl http://localhost:3000/health` returns `{ "status": "ok", "service": "apollo" }`

---

## Alternative: Keep NestJS Modules for a Phased Rollout

If a big-bang cutover is too risky, do this instead:

1. Keep existing NestJS DI and modules **untouched**.
2. Add a **thin Elysia bridge module** (`src/server.ts`) that imports one NestJS
   feature service at a time via `app.get(ServiceName)` and re-exposes it as an
   Elysia route.
3. This lets you route at `src/server.ts` while NestJS still owns DB entities,
   services, and DI — no business-logic rewrite needed.
4. Migrate services to plain classes one-by-one as Step 4 describes; each
   migrated service is simply no longer looked up `via NestFactory` but instead
   `new ServiceClass(…)` in `src/server.ts`.
