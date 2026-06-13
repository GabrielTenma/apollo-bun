---
name: apollo-dev
description: >-
  Development skill for the Apollo project — an Elysia + Bun server that scrapes financial news, synthesizes with OpenRouter AI, and delivers analysis via Telegram Bot + React frontend. Use this skill whenever working on this codebase: scaffolding new scrapers, routes, entities, services, routines, or plugins; debugging or editing existing components; or adding full-stack features end-to-end. The skill knows the project's architecture, conventions, and all the repetitive wiring patterns so you don't have to look them up every time. You should ALWAYS activate this skill when the user mentions files in src/, talks about adding/modifying scrapers/routes/entities/services/routines/plugins, or asks about the project structure.
---

# Apollo Development Skill

This skill is for working with the Apollo project at `/Users/tzadkiel/Documents/Development/Git/Own-Repos/apollo-bun`. It knows the architecture, conventions, and scaffolding patterns.

## Architecture Overview

```
src/
├── index.ts                       # Entry point — imports ./app
├── app.ts                         # Composition root — wires plugins, routes, middleware, services, routines
├── config/env.ts                  # Bun.env helper (env.string / env.number / env.bool)
├── types/apollo.d.ts              # Module augmentation — extends Elysia Context with decorated services
├── plugins/                       # Elysia plugins — one per external service (supabase, openrouter, telegram)
├── middleware/auth.guard.ts        # JWT guard — derive-based auth
├── routes/v1/                     # Route groups (auth, supabase, openrouter, telegram, scraper)
├── lib/                           # Core utilities + business logic
│   ├── db.ts                      # Manual TypeORM DataSource (AppDataSource)
│   ├── db-init.ts                 # Database auto-detection + SQLite bootstrap
│   ├── memory-key-store.ts        # In-memory store with TTL and LRU eviction
│   ├── response.util.ts           # ApiResponse<T> envelope wrappers
│   ├── services/                  # Business logic classes
│   │   ├── *.service.ts           # Plain classes (no DI)
│   │   └── *-routine.service.ts   # Background routine classes
├── scraper/target/                # Playwright scrape targets
├── supabase/entities/             # TypeORM entity classes
├── auth/strategies/               # JWT payload types
└── web/                           # React 19 + Vite + TailwindCSS v4 + DaisyUI frontend
```

### Data Flow

```
Scraping Targets (Playwright, every 20s)
  → MemoryKeyStore (financialjuice, yahoofinance, coinmarketcap, TTL: 120s)
  → OpenRouter AI (FinancialAgentService → Markdown analysis)
  → MemoryKeyStore (completion, completion-previous)
  → TypeORM (ScrapedDataEntity persistence)
  → GET /api/v1/openrouter/completion  →  React frontend
```

### Key Conventions

- **All routes under `/api/v1/{module}`**. Response envelope is auto-wrapped by `onAfterHandle` into `{ success, data, correlation_id, timestamp }`. Route handlers return `{ success: true, data: ... }` or `{ success: false, message: ... }`.
- **Services are plain classes** with constructor injection. Instantiated once at module scope in `app.ts`. Exposed to route handlers via `.decorate()` on the Elysia app instance.
- **TypeORM entities** use explicit column types (`@Column({ type: 'varchar' })`) — no `emitDecoratorMetadata` needed. snake_case DB columns → camelCase TS properties.
- **All internal imports use explicit `.ts` extensions** (Bundler module resolution).
- **Scraper targets** are classes with a `getOptions(): ScrapeOptions` method and a `parse*(html)` method using cheerio.
- **Routines** are separate `*-routine.service.ts` classes with a `start()` method.
- **MemoryKeyStore** is the shared in-memory state between scraper routines and openrouter routines. Keys have TTL (120s for scraped data).
- **evlog** for structured logging: `log.error({ error: e.message, route })`.
- **`console.log`** only for startup/shutdown lifecycle, routine debug, and missing-config warnings.

---

## Scaffolding: Adding New Components

### 1. Add a New Scraper Target

Create `src/scraper/target/{name}.target.ts`:

```typescript
import * as cheerio from "cheerio";
import type { ScraperService } from "../../lib/services/scraper.service.ts";
import type { ScrapeOptions } from "../interfaces/scraper.interface.ts";

// Interface for the parsed data shape
export interface MyItem {
  // fields...
}

export class MyTarget {
  constructor(public scraperService: ScraperService) {}

  getOptions(): ScrapeOptions {
    return {
      url: "https://example.com",
      waitForSelector: "#selector",
      timeout: 35000,
      addStyleHidePopup: true,
    };
  }

  async scrapeLatest(): Promise<MyItem[]> {
    const result = await this.scraperService.scrape(this.getOptions());
    if (!result.content)
      throw new Error("Scraping failed: HTML content unavailable");
    return this.parseItems(result.content);
  }

  parseItems(html: string): MyItem[] {
    const $ = cheerio.load(html);
    // Parse using cheerio selectors
    return [];
  }
}
```

Then update these files:

| File | Change |
|---|---|
| `src/app.ts` | Import `MyTarget`, instantiate after existing targets, pass to `ScraperRoutineService` constructor at line ~223 |
| `src/lib/services/scraper-routine.service.ts` | Add `MyTarget` to constructor params, add `getOptions()` to `scrapeOptions` array, store parsed result with `scrapedContentStore.set('mykey', parsed, 120_000)` |
| `src/routes/v1/scraper.route.ts` | Add `GET /mykey` route reading from `scrapedContentStore.get('mykey')` |

### 2. Add a New Route Group

Create `src/routes/v1/{name}.route.ts`:

```typescript
import { Elysia } from "elysia";
import { log } from "evlog";

const nameRoutes = new Elysia({
  prefix: "/{name}",
  name: "{name}Routes",
})
  // OPTIONAL: .use(somePlugin)  -- if you need plugin decorations
  // OPTIONAL: .use(authGuard)   -- if routes need JWT auth

  // GET /api/v1/{name}/example
  .get("/example", async ({ storeService, set }) => {
    try {
      // Service methods come from context de-structuring
      const result = await storeService.someMethod();
      return { success: true, data: result };
    } catch (e: any) {
      log.error({ error: e.message, route: "/api/v1/{name}/example" });
      set.status = 400;
      return { success: false, message: e.message };
    }
  });

export { nameRoutes };
```

Then update these files:

| File | Change |
|---|---|
| `src/routes/index.ts` | Add `export { nameRoutes } from "./v1/{name}.route.ts"` |
| `src/app.ts` | Import `nameRoutes` and add `.use(nameRoutes)` inside the `/api/v1` group |

### 3. Add a New Entity

Create `src/supabase/entities/{name}.entity.ts`:

```typescript
import {
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";

@Entity({ name: "table_name" })
@Index("idx_{name}_field", ["field"])
export class NameEntity {
  @PrimaryGeneratedColumn("uuid")
  id?: string;

  @Column({ type: "varchar", length: 255 })
  some_field: string;

  @Column({ type: "json", nullable: true })
  data?: object;

  @Column({ type: "varchar", nullable: true })
  created_at?: string;
}
```

Then update these files:

| File | Change |
|---|---|
| `src/supabase/entities/index.ts` | Add `export { NameEntity } from "./{name}.entity.ts"` |
| `src/lib/db.ts` | Add `NameEntity` to the entities array in both `createDataSource` branches (SQLite ~line 65, Postgres ~line 91) |
| `src/lib/db-init.ts` | Add dynamic import + push to entities array in `createBootstrapDataSource` function (around line 143) |

### 4. Add a New Service

Create `src/lib/services/{name}.service.ts`:

```typescript
// Import env helpers if needed
// import { env } from "../../config/env.ts";

export class NameService {
  constructor(/* deps */) {
    // Read env vars eagerly at ctor time
  }

  async someMethod(): Promise<ReturnType> {
    // Business logic
    return result;
  }
}
```

Then update these files:

| File | Change |
|---|---|
| `src/app.ts` | Import `NameService`, instantiate at module scope (before `new Elysia()`), `.decorate("nameService", nameServiceInstance)` (before route groups are registered) |
| `src/types/apollo.d.ts` | Add type declaration in the `Context` interface for the decorated service |

### 5. Add a New Routine

Create `src/lib/services/{name}-routine.service.ts`:

```typescript
import type { RoutineService } from "../routine.service.ts";

export class NameRoutineService {
  constructor(
    public routineService: RoutineService,
    // other deps
  ) {}

  start() {
    if (!this.routineService.isEnabled()) {
      console.log("Routines are disabled globally, skipping {name} setup");
      return;
    }

    this.routineService.startRoutine(
      "{name}-routine",
      async () => {
        console.log("{Name} routine executed");
        // Do work here
      },
      20000, // interval in ms
    );
  }

  async runManually(name: string): Promise<void> {
    await this.routineService.executeRoutine(name, async () => {
      console.log("Manual {name} routine executed");
    });
  }
}
```

Then update this file:

| File | Change |
|---|---|
| `src/app.ts` | Import `NameRoutineService`, instantiate near the bottom (after `app.listen`), call `.start()` |

### 6. Add a New Plugin

Create `src/plugins/{name}Plugin.ts`:

```typescript
import { Elysia } from "elysia";

class NameFacade {
  // Implementation
}

export interface NamePluginContext {
  someMethod: (arg: string) => Promise<unknown>;
}

const nameFacade = new NameFacade();

export const namePlugin = new Elysia<NamePluginContext>({
  name: "Name",
})
  .decorate("someMethod", nameFacade.someMethod.bind(nameFacade));
```

Then update these files:

| File | Change |
|---|---|
| `src/plugins/index.ts` | Add `export { namePlugin } from "./{name}Plugin.ts"` |
| `src/app.ts` | `.use(namePlugin)` before route groups that consume its decorations |
| `src/types/apollo.d.ts` | Add type declarations for any new decorated context properties |
| Route file | `.use(namePlugin)` in the route group constructor if needed |

---

## Full-Stack Feature Flow

When adding a feature end-to-end (scraper → store → AI → route → frontend):

1. **Entity** — Define the data shape in `src/supabase/entities/`
2. **Scraper target** — Scrape the data source in `src/scraper/target/`
3. **Service** — Business logic in `src/lib/services/`
4. **Routine** — Background processing in `src/lib/services/*-routine.service.ts`
5. **Route** — API endpoint in `src/routes/v1/`
6. **Frontend** — React component in `src/web/src/` (or components/)

## Error Handling Patterns

### Route handler (with evlog):
```typescript
try {
  const result = await someMethod();
  return { success: true, data: result };
} catch (e: any) {
  log.error({ error: e.message, route: "/api/v1/{module}/{endpoint}" });
  set.status = 400;
  return { success: false, message: e.message };
}
```

### Service (plain throw):
```typescript
async someMethod(): Promise<Result> {
  // Validate
  if (!condition) throw new Error("Descriptive error message");
  // Business logic
  return result;
}
```

## MemoryKeyStore Usage

```typescript
// Read
const data = scrapedContentStore.get("mykey");
// Write with TTL
scrapedContentStore.set("mykey", value, 120_000); // 2 min TTL
// Write without TTL (never expires)
scrapedContentStore.set("mykey", value);
```

## Key File Locations

| Item | Path |
|---|---|
| Entry point | `src/index.ts` |
| Composition root | `src/app.ts` |
| Routes barrel | `src/routes/index.ts` |
| Entities barrel | `src/supabase/entities/index.ts` |
| Plugins barrel | `src/plugins/index.ts` |
| Services dir | `src/lib/services/` |
| Scraper targets | `src/scraper/target/` |
| Type augmentation | `src/types/apollo.d.ts` |
| Env helpers | `src/config/env.ts` |
| MemoryKeyStore | `src/lib/memory-key-store.ts` |
| Response util | `src/lib/response.util.ts` |
| Routine service | `src/lib/routine.service.ts` |
| AGENTS.md | `AGENTS.md` |

## Configuration

- All env vars read via `Bun.env` through `src/config/env.ts`: `env.string("KEY", "default")`, `env.number("KEY", 42)`, `env.bool("KEY")`.
- Routine global switch: `ROUTINE_ENABLED=true|false` (default `false`).
- Execution mode: `ROUTINE_EXECUTION_MODE=wait|skip|overlap` (default `wait`).

## Frontend

The React frontend lives in `src/web/`:
- `src/web/src/App.tsx` — Main app component
- `src/web/src/main.tsx` — Entry point
- `src/web/src/index.css` — TailwindCSS v4 styles
- `src/web/src/components/` — React components
- `src/web/src/pages/` — Page components
- `vite.config.ts` — Root-level, configured to `root = "src/web"`, `outDir = "dist/web"`
