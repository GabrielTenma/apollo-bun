# Contributing to Apollo

Thank you for considering a contribution. All contributions — bug reports, feature requests, documentation improvements, and code — are welcome.

> Maintained by [GabrielTenma](https://github.com/GabrielTenma). Licensed under Apache 2.0.

---

## Table of Contents

1. [Code of Conduct](#code-of-conduct)
2. [Getting Started](#getting-started)
3. [Architecture Overview](#architecture-overview)
4. [Development Workflow](#development-workflow)
5. [Coding Conventions](#coding-conventions)
6. [Testing](#testing)
7. [Submitting Changes](#submitting-changes)

---

## Code of Conduct

- Be respectful and constructive in discussions.
- Keep issues and pull requests focused and actionable.

---

## Getting Started

### Prerequisites

| Tool | Version |
|---|---|
| [Bun](https://bun.sh/) | latest |
| Node / Bun runtime | — |
| PostgreSQL (optional) | — or use the built-in SQLite fallback |
| OpenRouter API key | — |
| Telegram bot token | — |

### Setup

```bash
git clone https://github.com/GabrielTenma/apollo-bun.git
cd apollo-bun
bun install
cp .env.example .env
# Edit .env and fill in your credentials
```

The server uses SQLite automatically when `DATABASE_URL` is not set, so you can start developing without provisioning PostgreSQL.

### Quick-start commands

| Task | Command |
|---|---|
| Dev (server) | `bun run dev` |
| Dev (Vite frontend) | `bun run web:dev` |
| Type-check | `bun run check` |
| Lint | `bun run lint` |
| Format | `bun run format` |
| Unit / Integration tests | `bun run test` |
| Coverage | `bun run test:cov` |
| Full CI check | `bun run compile` |

---

## Architecture Overview

Apollo is an **Elysia + Bun** server in a **plugin-based** architecture. The backend is in `src/`, the React frontend is in `src/web/`.

### Key directories

```
src/
├── index.ts              # Entry point (thin wrapper, imports ./app)
├── app.ts                # Composition root — wires plugins, routes, middleware
├── config/               # Bun.env helpers (env.string / env.number / env.bool)
├── types/                # Module augmentation + shared interfaces
├── plugins/              # Elysia plugins — one per external service
├── middleware/            # Reusable route guards (auth, etc.)
├── routes/v1/             # Route definitions grouped by resource
├── lib/                   # Core library — plain classes, no framework
│   ├── services/          # Business logic services (auth, scraper, openrouter, …)
│   ├── routine.service.ts # Timer utility (wait / skip / overlap modes)
│   └── memory-key-store.ts # In-memory TTL store (no Redis)
├── scraper/               # Playwright scrape targets (plain classes)
├── supabase/entities/     # TypeORM entities (PostgreSQL/SQLite compatible)
├── openrouter/            # OpenRouter config & types
└── telegram/              # Telegram config & types
```

### Data flow (high level)

```
Playwright scrapers (FinancialJuice, YahooFinance, CoinMarketCap)
        ↓  ScraperRoutineService (~ every 20 s)
MemoryKeyStore (in-memory key/value, TTL 120 s)
        ↓  OpenrouterRoutineService (~ every 20 s, only when all 3 keys present)
OpenRouter AI via FinancialAgentService → Markdown analysis
        ↓
MemoryKeyStore  completion / completion-previous
        ↓  GET /api/v1/openrouter/completion  →  consumed by React frontend
```

Read [DESIGN.md](DESIGN.md) for the full architecture. Read [AGENTS.md](AGENTS.md) for conventions that all contributors (and AI agents) must follow.

---

## Development Workflow

### Environment

All env vars are read via `Bun.env` through `src/config/env.ts` helpers (`env.string`, `env.number`, `env.bool`). There is no separate config-service — Bun.env is read eagerly at module scope and is safe within Bun's single-threaded runtime.

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string. Omit to use SQLite. |
| `SQLITE_DATABASE` | SQLite file path when using SQLite fallback. |
| `OPENROUTER_API_KEY` | OpenRouter API key. |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token from BotFather. |
| `ROUTINE_ENABLED` | `true\|false` to enable background scrapers. Default `false`. |
| `ROUTINE_EXECUTION_MODE` | `wait`\|`skip`\|`overlap`. Default `wait`. |

### Working with services

Services are **plain TypeScript classes** — no DI container. They are instantiated once at the top of `src/app.ts` and injected into route handlers via Elysia's `.decorate()`.

```ts
// In src/app.ts
const authService = new AuthService();
const scraperService = new ScraperService(memoryKeyStore);
// …
app.decorate('authService', authService);
```

In a route handler you access injected services through `store`:

```ts
.set('createUser', async ({ store, body }) => {
  return store.authService.createUser(body.username, body.password);
})
```

Read the AGENTS.md _Naming_ and _Key Conventions_ sections before adding new files.

---

## Coding Conventions

- **TypeScript only** — no plain JS files.
- **No `npm`** — all scripts and tooling use `bun` / `bunx`.
- **ESM** — `"type": "module"` in `package.json`, no CommonJS.
- **snake_case DB columns → camelCase entity properties** in TypeORM entities.
- **No scattered `console.error` / `console.log`** in production code. Use [evlog](https://evlog.dev) for structured logging.
- **Errlog pattern** — one wide event per failure with full context via:

  ```ts
  log.error({ error: e.message, route: '/api/v1/…' })
  ```

- **`@Column({ type: '…' })`** must always be present on TypeORM entities with explicit column types (SQLite-compatible — `varchar` for uuid, `uuid` / `timestamptz` / `jsonb` become `varchar` / `timestamp` / `json` respectively).
- **Internal imports use explicit `.ts` extensions** per Bun's Bundler module resolution.
- **Do not create new route groups under `routes/v1/` without a corresponding test file.**
- **No nested comments** anywhere in the codebase.

---

## Testing

- **Unit / Integration:** `bun test` (Bun-native). Test files live at `**/*.spec.ts` under `src/`.
- **E2E:** Playwright — run `bun run test` (CI filters automatically). CI is Ubuntu via `.github/workflows/playwright.yml`.
- **Coverage:** `bun run test:cov`.
- **Test names / titles** in `it()` should use `'… (should …)'` / `'… (given …)'` BDD style per the AGENTS.md testing conventions — use the same style when adding new tests.
- Every route tested must include at minimum a **success case** and a **failure case**.

### Running a single test file

```bash
bun test --timeout 12000 src/lib/services/scraper-routine.service.spec.ts
```

---

## Submitting Changes

1. Open an issue first to discuss bugs or feature ideas before writing code.
2. Fork the repo and create a feature branch from `main`.
3. Install deps — `bun install`.
4. Make changes, following the conventions above.
5. Ensure lint and type-check both pass:

   ```bash
   bun run check
   bun run lint
   bun run format
   ```

6. Add or update tests. Ensure all existing tests still pass:

   ```bash
   bun run test
   ```

7. Open a pull request against `main`.

### Commit message style

Keep messages concise and focused on the _why_, not the _what_ — consistent with the AGENTS.md style.

### Pull request checklist

- [ ] `bun run check` passes (no TypeScript errors)
- [ ] `bun run lint` passes (no Biome lint errors)
- [ ] `bun run format` has been run (no formatting diff)
- [ ] `bun run test` passes
- [ ] Relevant tests added or updated
- [ ] AGENTS.md consulted for naming and architecture conventions

---

 thanks to [GabrielTenma](https://github.com/GabrielTenma) for this project ✌️
