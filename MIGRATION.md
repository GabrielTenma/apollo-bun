# Migration Guide: From Monolithic to Plugin‑Based Elysia Architecture

> **Target project:** Apollo — Elysia 1.4 · Bun · TypeORM · Playwright · Supabase · OpenRouter
> **Source branch:** `migration/bun` (the post-NestJS, pre-plugin-refactor state)
> **Goal:** Split the single-file `src/server.ts` into a composable, testable, plugin-driven layout.

---

## Table of Contents

1. [Why restructure?](#1-why-restructure)
2. [Pre-Migration Checklist](#2-pre-migration-checklist)
3. [Step-by-step Migration](#3-step-by-step-migration)
   - [a. Confirm env config layer exists](#a-confirm-env-config-layer)
   - [b. Extract external services into plugins](#b-extract-external-services-into-plugins)
   - [c. Refactor middleware to use guards / `beforeHandle`](#c-refactor-middleware-to-use-guards--beforehandle)
   - [d. Split every route group into its own file](#d-split-every-route-group-into-its-own-file)
   - [e. Wire everything in `app.ts`](#e-wire-everything-in-appts)
   - [f. Replace `server.ts` with a thin entry point](#f-replace-serverts-with-a-thin-entry-point)
4. [Testing After Migration](#4-testing-after-migration)
5. [Common Pitfalls & Troubleshooting](#5-common-pitfalls--troubleshooting)
6. [Conclusion](#6-conclusion)

---

## 1. Why restructure?

`src/server.ts` in the Apollo project currently does all of the following in a single file:

- Instantiates eight+ service classes (Supabase, OpenRouter, Telegram, Auth, Scraper, …)
- Fetches repositories from TypeORM's `AppDataSource`
- Bootstraps evlog and starts every background routine
- Defines every HTTP route inline
- Reads environment variables directly at the top level

The consequences are:

| Problem | Impact |
|---|---|
| No test harness | Impossible to inject a mock Supabase/OpenRouter client |
| No plugin boundaries | Services are tightly coupled to `server.ts`'s import graph |
| Auth scattered | Only some routes extract a JWT; logic is duplicated rather than centralised |
| Routing conflated | Adding a new route group means editing 350+ lines of a single file |
| Env scattered | `Bun.env[...]` is read directly throughout services |

The target architecture separates concerns by **Elysia plugin**. Each plugin owns one external service and exposes it via `decorate()`. Route groups consume injected services from the `context` store — no direct imports. CI, local dev, and UI tests all gain a clean `createTestServer()` hook.

---

## 2. Pre-Migration Checklist

1. **Branch**: `git checkout -b refactor/plugin-architecture`
2. **Pin tests**: ensure `bun run test` passes so you have a clean baseline.
3. **Inventory every cross-file import**: grep the repo for `import { SupabaseService }`, `import { OpenRouterService }`, `from './services/` etc. — each needs a plugin path.
4. **List every env var used** in services: `OPENROUTER_API_KEY`, `TELEGRAM_BOT_TOKEN`, `JWT_SECRET`, `SUPABASE_URL`, `SUPABASE_KEY`, … confirm `src/config/env.ts` already exports helpers for them.
5. **Back up** `src/server.ts` and `src/config/env.ts` — these are the two files most likely to cause a regression.

Type-check baseline:

```bash
bun run check   # must be green before changing anything
```

---

## 3. Step-by-step Migration

The Apollo project already has most of the building blocks in place. The migration is therefore a **structural rewire** — no business logic is rewritten.

---

### a. Confirm env config layer

**Already done (Apollo 1.x).** `src/config/env.ts` wraps `Bun.env` in typed helpers so no service ever reads `Bun.env` directly.

```ts
// src/config/env.ts  ← already exists, ensure it covers every var you need
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

**Action:** confirm no service reaches directly for `Bun.env[...]`. If one does, replace it with `env.xxx(...)`.

---

### b. Extract external services into plugins

Each external client becomes its own Elysia plugin. The plugin creates the client instance once, then exposes it with `.decorate()`.

#### Before: Supabase service instantiated inline

```ts
// src/server.ts  (old, monolithic)
const supabaseService = new SupabaseService();   //  ← reads Bun.env directly

// every route handler calls supabaseService directly inside .post/.get callbacks
.post('/api/v1/supabase/create', async ({ body }) => {
  const result = await supabaseService.create((body as any).table, (body as any).data);
  return { success: true, data: result };
})
```

#### After: `supabasePlugin` exposes a factory via `decorate`

```ts
// src/plugins/supabase.ts  (new, self-contained)
import { Elysia } from 'elysia';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from '../config/env.ts';

export type SupabaseConnectionName = 'default' | string;

export interface SupabasePluginContext {
  getClient: (name?: SupabaseConnectionName) => SupabaseClient;
}

/** Shared bag so every plugin connection born during the vault wiring. */
let supabaseClients: Record<string, SupabaseClient> = {};

function buildSupabaseClients() {
  const url     = env.string('SUPABASE_URL', '');
  const key     = env.string('SUPABASE_KEY', '');
  if (url && key) {
    supabaseClients.default = createClient(url, key);
    console.warn('Found supabase connection default');
  }

  for (const [rawKey, rawVal] of Object.entries(Bun.env)) {
    if (!rawKey.startsWith('SUPABASE_')) continue;
    const prefix  = rawKey.replace(/_(?:URL|KEY)$/, '');
    const isUrl   = rawKey.endsWith('_URL');
    const isKey   = rawKey.endsWith('_KEY');
    const existing = supabaseClients[prefix] ?? {};
    supabaseClients[prefix] = {
      ...existing,
      ...(isUrl ? { url: rawVal } : {}),
      ...(isKey ? { key: rawVal } : {}),
    };
  }

  for (const [name, cfg] of Object.entries(supabaseClients)) {
    if ((cfg as any).url && (cfg as any).key) {
      supabaseClients[name] = createClient((cfg as any).url, (cfg as any).key);
    } else {
      console.warn(`Incomplete config for Supabase connection ${name}`);
    }
  }

  if (!supabaseClients.default)
    console.warn('No default Supabase connection configured');
}

buildSupabaseClients();

export const supabasePlugin = new Elysia({ name: 'Supabase' })
  .decorate('getClient', (name: SupabaseConnectionName = 'default') => {
    const client = supabaseClients[name];
    if (!client) throw new Error(`Supabase connection '${name}' not found`);
    return client;
  });

/** Export the raw clients map so e.g. SupabaseService and the plugin are in sync. */
export { supabaseClients };
```

> **Key pattern:** The plugin registers `getClient` — *not the individual client* — so downstream code can pick the right connection. The same `supabaseClients` record is shared with `SupabaseService` from `src/lib/services/` so the raw service and the Elysia plugin point at the identical objects.

---

#### Before: OpenRouter service declared and used inline

```ts
// src/server.ts  (old)
const openRouterService = new OpenRouterService();

.post('/api/v1/openrouter/chat', async ({ body }) => {
  const result = await openRouterService.createChatCompletion((body as any));
  return { success: true, data: result };
})
```

#### After: `openrouterPlugin` with `createChatCompletion` and `listModels` on the context

```ts
// src/plugins/openrouter.ts  (new)
import { Elysia } from 'elysia';
import type { ChatCompletionOptions, ChatCompletionResponse, OpenRouterModel } from '../types/openrouter.d.ts';

export interface OpenRouterPluginContext {
  createChatCompletion: (opts: ChatCompletionOptions) => Promise<ChatCompletionResponse>;
  listModels:            () => Promise<OpenRouterModel[]>;
}

/* ── thin facade ───────────────────────────────────────────────── */
class OpenRouterFacade {
  constructor(
    private apiKey:      string,
    private baseUrl:     string,
    private defaultModel: string,
    private timeout:      number,
  ) {}

  async createChatCompletion(opts: ChatCompletionOptions): Promise<ChatCompletionResponse> {
    /* existing OpenRouterService.createChatCompletion logic goes here —
       unchanged, just moved into this class so the plugin is the only Elysia-facing part */
    …
  }

  async listModels(): Promise<OpenRouterModel[]> { … }
}

/* ── env wiring ────────────────────────────────────────────────── */
const { OPENROUTER_API_KEY, NODE_ENV } = Bun.env;
const facade = new OpenRouterFacade(
  OPENROUTER_API_KEY ?? '',
  OPENROUTER_API_KEY
    ? (Bun.env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1')
    : 'https://openrouter.ai/api/v1',
  OPENROUTER_API_KEY
    ? (Bun.env.OPENROUTER_DEFAULT_MODEL ?? 'google/gemini-2.0-flash-exp:free')
    : 'google/gemini-2.0-flash-exp:free',
  Bun.env.OPENROUTER_TIMEOUT ? Number(Bun.env.OPENROUTER_TIMEOUT) : 30_000,
);

export const openrouterPlugin = new Elysia({ name: 'OpenRouter' })
  .decorate('createChatCompletion', facade.createChatCompletion.bind(facade))
  .decorate('listModels',            facade.listModels.bind(facade));
```

---

#### Plugin directory layout after extraction

```
src/plugins/
├── index.ts           ← re-exports all plugins
├── supabase.ts        ← supabasePlugin  (getClient factory)
├── openrouter.ts      ← openrouterPlugin (createChatCompletion / listModels)
├── telegram.ts        ← telegramPlugin  (sendMessage / sendText / setWebhook / getMe)
└── auth.ts            ← authPlugin (createUser / login / refreshTokens)
```

```ts
// src/plugins/index.ts  ← single import point for app.ts
export { supabasePlugin }     from './supabase.ts';
export { openrouterPlugin }   from './openrouter.ts';
export { telegramPlugin }     from './telegram.ts';
export { authPlugin }         from './auth.ts';
```

---

### c. Refactor middleware to use guards / `beforeHandle`

The old `src/server.ts` sprinkled `(jwt as any).payload` checks across protected route definitions. Pull that into a reusable guard.

#### Before: inline JWT check inside a route

```ts
// src/server.ts  (old)
.get('/api/v1/auth/profile', async ({ jwt }) => {
  const payload = (jwt as any).payload as { sub: string; email: string; roles: string[] } | undefined;
  if (!payload?.sub) {
    return { success: false, message: 'Unauthorized' };
  }
  return { success: true, data: payload };
})
```

#### After: `auth.guard.ts` applied to a route group

```ts
// src/middleware/auth.guard.ts  (new)
import { Elysia } from 'elysia';
import type { JwtPayload } from '../types/elysia.d.ts';

export interface AuthGuardContext {
  /** Extracted and typed payload from the Elysia JWT plugin; undefined if missing or invalid. */
  auth: JwtPayload & { sub: string; email: string; roles: string[] } | undefined;
}

export const authGuard = new Elysia({ name: 'authGuard' })
  .derive(({ jwt }) => ({
    /** Decode the access token placed on `Authorization: Bearer …`
     *  Returns `undefined` when no token is present — callers decide what to do with that. */
    auth: (jwt as any)?.payload as AuthGuardContext['auth'],
  }));
```

Declare the type once so it is not duplicated:

```ts
// src/types/elysia.d.ts
import type { Context } from 'elysia';

interface Unknown {
  UnreleasedExperimentalFeature?: unknown;
}

declare module 'elysia' {
  interface Context<UnreleasedExperimentalFeature = Unknown, HttpOnlyProperties = unknown> {
    /** Supabase client factory injected by `supabasePlugin` */
    getClient: (name?: string) => any;
    /** OpenRouter helpers injected by `openrouterPlugin` */
    createChatCompletion: (opts: any) => Promise<any>;
    listModels:            ()       => Promise<any[]>;
    /** Auth guard payload injected by `authGuard` */
    auth?: { sub: string; email: string; roles: string[] };
  }
}
```

Now every protected handler simply reads `context.auth`:

```ts
// src/routes/v1/auth.route.ts  (new)
import { Elysia } from 'elysia';

export const authRoutes = new Elysia({ prefix: '/auth', name: 'authRoutes' })
  .use(authGuard)                        // ← guard is active for every route in this group
  .get('/profile', async ({ auth }) => {
    if (!auth?.sub) return { success: false, message: 'Unauthorized' };
    return { success: true, data: auth };
  });
```

Routes that do **not** use `.use(authGuard)` are automatically accessible without a bearer token — the guard is opt-in per group.

---

### d. Split every route group into its own file

Move each route block from `server.ts` into its own file. The key change is replacing direct imports of service instances with context-injected values.

#### Example migration: Supabase CRUD routes

**Before** (`src/server.ts`, inline):

```ts
const supabaseService = new SupabaseService();
// ...
.post('/api/v1/supabase/create', async ({ body }) => {
  const result = await supabaseService.create((body as any).table, (body as any).data);
  return { success: true, data: result };
})
```

**After** (`src/routes/v1/supabase.route.ts`, standalone):

```ts
import { Elysia } from 'elysia';
import { supabasePlugin } from '../../plugins/';

export const supabaseRoutes = new Elysia({ prefix: '/supabase', name: 'supabaseRoutes' })
  .use(supabasePlugin)

  .get('/health', () => ({ status: 'ok', service: 'supabase' }))

  .post('/create', async ({ getClient, body }) => {
    const client  = getClient('default');
    const table   = (body as any).table;
    const payload = (body as any).data;
    const { data, error } = await client.from(table).insert(payload);
    if (error) return { success: false, message: error.message };
    return { success: true, data };
  })

  .get('/read/:table', async ({ getClient, params }) => {
    const client = getClient('default');
    const { data, error } = await client.from(params.table).select('*');
    if (error) return { success: false, message: error.message };
    return { success: true, data };
  })

  .put('/update', async ({ getClient, body }) => {
    const client = getClient('default');
    const { table, id, data: patch } = body as any;
    const { data, error } = await client.from(table).update(patch).eq('id', id);
    if (error) return { success: false, message: error.message };
    return { success: true, data };
  })

  .delete('/delete', async ({ getClient, body }) => {
    const client  = getClient('default');
    const table   = (body as any).table;
    const id      = (body as any).id;
    const { data, error } = await client.from(table).delete().eq('id', id);
    if (error) return { success: false, message: error.message };
    return { success: true, data };
  });
```

#### Full routes directory layout after migration

```
src/routes/
├── index.ts          ← re-exports all groups; adds /api/v1 prefix
└── v1/
    ├── auth.route.ts
    ├── supabase.route.ts
    ├── openrouter.route.ts
    ├── telegram.route.ts
    ├── scraper.route.ts
    └── health.router.ts   ← combined /health + /ready
```

```ts
// src/routes/index.ts  ← barrel export for v1 route groups
export { authRoutes }      from './v1/auth.route.ts';
export { supabaseRoutes }  from './v1/supabase.route.ts';
export { openrouterRoutes } from './v1/openrouter.route.ts';
export { telegramRoutes }  from './v1/telegram.route.ts';
export { scraperRoutes }   from './v1/scraper.route.ts';
export { healthRoutes }    from './v1/health.route.ts';
```

---

### e. Wire everything in `app.ts`

`app.ts` is the **only place** that knows every plugin and every route group. It does not contain business logic — only composition.

```ts
// src/app.ts  ← the new composition root
import { Elysia } from 'elysia';
import { cors }              from '@elysiajs/cors';
import { jwt }               from '@elysiajs/jwt';
import { createRequestLogger, initLogger, log } from 'evlog';

import { env }               from './config/env.ts';
import { AppDataSource }     from './lib/db.ts';
import { authRoutes }        from './routes/index.ts';  // all route groups
import { supabasePlugin }    from './plugins/supabase.ts';
import { openrouterPlugin }  from './plugins/openrouter.ts';
import { telegramPlugin }    from './plugins/telegram.ts';
import { authGuard }         from './middleware/auth.guard.ts';

// ─── log bootstrap ───────────────────────────────────────────────
initLogger({
  env: {
    service:    'apollo',
    environment: env.string('NODE_ENV', 'development'),
  },
});

// ─── production Elysia plugin ───────────────────────────────────
export const app = new Elysia()
  // global middleware
  .use(cors({
    origin: (env.string('CORS_ORIGIN', 'http://localhost:5173,http://localhost:3001,http://localhost:3000'))
      .split(',').map(s => s.trim()),
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  }))
  .use(jwt({ name: 'jwt', secret: env.string('JWT_SECRET') ?? '' }))

  // ─── plugins (order matters: decorate must precede routes that consume them)
  .use(supabasePlugin)
  .use(openrouterPlugin)
  .use(telegramPlugin)

  // ─── health endpoint (no plugin required)
  .get('/health', () => ({ status: 'ok', service: 'apollo-elysia' }))

  // ─── routes under /api using guard where needed ───────────────
  .group('/api', app =>
    app
      // auth routes get the guard
      .use(authGuard)
      .use(authRoutes)

      // openrouter + telegram keep their own internal guards (see step c)
      .use(openrouterPlugin)
      .use(telegramPlugin)
      .use(openrouterRoutes)

      // scraper routes are open
      .use(scraperRoutes)

      // supabase routes open on top-level, used for UI admin features
      .use(supabasePlugin)
      .use(supabaseRoutes)
  );

```

> **Rule of thumb:** `supabasePlugin` must appear before any route handler that calls `{ getClient }`.  The same is true for `openrouterPlugin` and `telegramPlugin`.  Route files never import service classes — they only access `getClient`, `createChatCompletion`, `sendMessage`, etc., from `context`.

### f. Replace `server.ts` with a thin entry point

```ts
// src/index.ts  ← process entry point (formerly src/server.ts)
import './app';               // boots app.ts (listen call lives in app.ts or here)
```

If you prefer to keep the listen call and DB bootstrap under `app.ts`, move it there; otherwise keep `index.ts` responsible for the lifecycle signals:

```ts
// src/index.ts  (alternative — explicit lifecycle in entry point)
import { AppDataSource } from './lib/db.ts';
import { app }           from './app.ts';

// Handle TypeORM connection
await AppDataSource.initialize().catch((err: any) =>
  log.error({ error: err.message, step: 'typeorm-init' }),
);

app.listen(3000, () => console.log('Apollo Elysia on :3000'));

const shutdown = async () => {
  console.log('Shutting down…');
  try {
    await Promise.race([
      app.stop(),
      new Promise<void>((r) => setTimeout(r, 5_000)),
    ]);
  } catch { /* ignore — may not have been started yet */ }
  await Bun.sleep(1_000);
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
```

The critical difference is that `src/server.ts` (now deleted) no longer does any of those things — only `index.ts` + `app.ts` own them.

---

## 4. Testing After Migration

### a. Create a test server factory

```ts
// tests/setup.ts  ← bun test setup
import { Elysia } from 'elysia';
import { supabasePlugin }     from '../src/plugins/supabase.ts';
import { openrouterPlugin }   from '../src/plugins/openrouter.ts';
import { authRoutes }         from '../src/routes/index.ts';
import { supabaseRoutes }     from '../src/routes/v1/supabase.route.ts';
import { createMockClient }   from './mocks/supabase.ts';

/** Build a minimal Elysia app with Supabase replaced by an in-memory stub.
 *  Every test file calls this — no real DB or API needed. */
export function createTestServer() {
  return new Elysia()
    .use(supabasePlugin)          // real plugin, but uses mock clients from src/plugins/supabase.ts
    .use(mockSupabasePlugin())    // overwrites getClient to return createMockClient()
    .use(authRoutes)
    .use(supabaseRoutes);
}
```

### b. Override a plugin with a mock for a single test

```ts
import { test, expect } from 'bun:test';
import { createTestServer } from './setup.ts';

test('POST /supabase/create uses supabase plugin', async () => {
  const app = createTestServer();
  app.use(async ({ getClient, set }) => {
    const mock = createMockClient();
    getClient = () => mock;          // ← replace getClient for this scope only
  });

  const res = await app.handle(new Request('http://localhost/api/supabase/create', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ table: 'users', data: { email: 'x@y.com' } }),
  }));

  expect(res.status).toBe(201);
  // the mock records the call so we can assert
});
```

### c. Quick smoke test with real dependencies

```bash
DATABASE_URL="" JWT_SECRET="test-secret" ROUTINE_ENABLED=false bun -e '
  import { app } from "./src/app.ts";
  app.listen(0, async () => {
    const res = await app.handle(new Request("http://localhost/health"));
    console.log(res.status, (await res.json()).status);
    await app.stop();
  });
'
```

Expected output: `200 ok`.

---

## 5. Common Pitfalls & Troubleshooting

### "Property `getClient` does not exist on context"

**Cause:** `supabasePlugin` was not `.use()`-ed before the route handler, or a new route file was added without importing the plugin.

**Fix:** ensure the route file itself does `.use(supabasePlugin)` at the top, or that the parent group that wraps it already has it installed. Plugin install order matters — `getClient` is not known until `.use(supabasePlugin)` runs.

### Environment variables return `undefined` at start

**Cause:** `env.ts` reads `Bun.env` at module scope. If a `.env` file is not loaded before `app.ts` is imported, all helpers return their default value instead of the real value.

**Fix:** add a one-time `.env` loader at the very top of `src/index.ts`:

```ts
// src/index.ts  — always the first line
import './config/env-loader.ts';   // ← Bun-specific: reads .env via bunfig or dotenv
```

Or use `bun --env-file=.env run src/index.ts` in every `dev` / `start` script entry.

### Supabase realtime subscriptions break

Elysia runs on Bun's native `FetchEvent` / `Request` / `Response` primitives, not on a Node.js HTTP server. Supabase's `createClient(...).channel(...).on(...).subscribe()` still works because it is a pure WebSocket client, but **you must not pass a Node.js `WebSocket` object into it**. Validate that the Supabase SDK version is ≥ 2.104.

### TypeScript cannot find `getClient` on `Context`

Run `tsc --noEmit`. If you see `Property 'getClient' does not exist ...`, the module augmentation in `src/types/elysia.d.ts` either has the wrong path or was not picked up by `tsconfig.json`. Verify that `"include": ["src/**/*.ts"]` covers the `types/` directory, or move the augmentation into the same file as the plugin itself.

---

## 6. Conclusion

| Before | After |
|---|---|
| one 350-line `server.ts` | 8 focused plugin / route files |
| `new SupabaseService()` at module scope | `supabasePlugin.decorate('getClient', …)` — injected per request |
| inline JWT checks | one `authGuard` module, opt-in per route group |
| services `import` each other freely | all cross-service communication goes through `context` |
| `bun test` needs a running server | `createTestServer()` returns an in-memory Elysia instance |

### Next steps

1. **Add remaining plugins** — Telegram, Scraper, FinancialAgent, MemoryKeyStore each get their own plugin file.
2. **Migrate background routines** — wrap each `RoutineService` in a plugin so tests can inject a fake clock.
3. **Add a `RequestLogger` plugin** — centralise `evlog` error capture via `beforeHandle` instead of ad-hoc `try/catch` in every handler.
4. **Add `@elysiajs/openapi`** — generate OpenAPI specs directly from the route files now that they are self-describing instances.

---

*Last updated: 2026-05-21 — Apollo `migration/bun` branch*
