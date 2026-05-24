// src/lib/db-init.ts
// Eager, at-module-load init that runs before AppDataSource is created.
//
// Decision flow
// ─────────────
// 1) Read Bun.env (env vars injected by Docker --env-file, -e, Bun loader, etc.).
// 2) Detect whether any Postgres / Supabase config is present:
//      DATABASE_URL  — direct Postgres DSN
//      SUPABASE_URL  — Supabase project URL (implies Postgres)
//    If at least one is set → Postgres path, no auto-init needed.
// 3) If nothing above is set → force SQLite (local dev only):
//      a) Write DATABASE_URL=sqlite to .env + Bun.env   (skipped when DOCKERIZED)
//      b) Upsert JWT_SECRET (random UUID)               (skipped when DOCKERIZED)
//      c) Purge + recreate data/ directory
//      d) TypeORM synchronize + replay of .workspace/db_init.sqllite.sql
//      e) Close bootstrap DataSource; db.ts opens the real one later.
//
// In Docker / container environments (DOCKERIZED=true or /.dockerenv):
//   • No .env file is read or written at any time.
//   • You must supply DATABASE_URL (or SUPABASE_*) + JWT_SECRET etc.
//     exclusively via `docker run --env-file .env` or `-e KEY=val`.
//
// The SQLite DDL script lives in .workspace/ because it is a hand-maintained
// reference file, not part of the TypeORM auto-sync path.

import "reflect-metadata";
import { promises as fs } from "node:fs";
import path from "node:path";
import { DataSource } from "typeorm";

// ── paths ────────────────────────────────────────────────────────────────────
const PROJECT_ROOT = path.resolve(import.meta.dir, "../../");
const DATA_DIR = path.join(PROJECT_ROOT, "data");
const ENV_FILE = path.join(PROJECT_ROOT, ".env");
const SQLITE_DDL = path.join(PROJECT_ROOT, ".workspace", "db_init.sqllite.sql");

// When running under Docker (or Kubernetes, etc.) we must never write a .env file.
// All secrets are supplied exclusively via --env-file / -e at container start.
const SKIP_ENV_FILE_WRITES =
	(Bun.env.DOCKERIZED ?? "").toLowerCase() === "true" ||
	(Bun.env.SKIP_ENV_FILE_WRITES ?? "").toLowerCase() === "true" ||
	(() => {
		try {
			// Standard Docker marker file (present in almost all containers)
			return require("node:fs").existsSync("/.dockerenv");
		} catch {
			return false;
		}
	})();

// ── helpers ──────────────────────────────────────────────────────────────────

/**
 * Load key=value pairs from `.env` into `Bun.env` at process start.
 * Only keys not already present in Bun.env are written so that
 * externally-injected env vars (Docker --env-file, -e, CI, etc.) are never clobbered.
 *
 * Under DOCKERIZED / container environments the file is typically absent;
 * all configuration arrives via Docker environment injection.
 */
async function loadDotEnv(): Promise<void> {
	try {
		const raw = await fs.readFile(ENV_FILE, "utf-8");
		for (const line of raw.split("\n")) {
			const trimmed = line.trim();
			if (!trimmed || trimmed.startsWith("#")) continue;
			const eq = trimmed.indexOf("=");
			if (eq === -1) continue;
			const key = trimmed.slice(0, eq).trim();
			const val = trimmed.slice(eq + 1).trim();
			if (key && !(key in Bun.env)) Bun.env[key] = val;
		}
	} catch {
		// `.env` does not exist yet — will be created below.
	}
}

/**
 * Write or update a single `KEY=VALUE` in `.env`, then mirror the value
 * into `Bun.env` immediately.
 *
 * In containerized environments (DOCKERIZED=true or /.dockerenv present)
 * filesystem writes are skipped — all configuration must arrive via
 * Docker --env-file / -e at `docker run` time.
 */
async function upsertEnvVar(
	key: string,
	value: string,
	forceNonEmpty?: boolean,
): Promise<void> {
	if (forceNonEmpty && !Bun.env[key]) {
		value = crypto.randomUUID();
	}

	// Never mutate .env on disk when running in Docker / pure-env injection mode.
	if (SKIP_ENV_FILE_WRITES) {
		Bun.env[key] = value;
		return;
	}

	let raw = "";
	try {
		raw = await fs.readFile(ENV_FILE, "utf-8");
	} catch {
		raw = "";
	}
	const regex = new RegExp(`^${key}=`, "i");
	let found = false;
	const updated = raw.split("\n").map((line) => {
		if (regex.test(line.trim())) {
			found = true;
			return `${key}=${value}`;
		}
		return line;
	});
	if (!found) updated.push(`${key}=${value}`);
	await fs.writeFile(
		ENV_FILE,
		updated.join("\n").replace(/\n{2,}/g, "\n"),
		"utf-8",
	);
	Bun.env[key] = value;
}

/** Remove the `data/` directory so stale WAL/shm/schema files are gone. */
async function purgeDataDir(): Promise<void> {
	try {
		await fs.rm(DATA_DIR, { recursive: true, force: true });
	} catch {
		// did not exist — nothing to clean
	}
}

// ── SQLite bootstrap ─────────────────────────────────────────────────────────

/**
 * Open a throwaway TypeORM DataSource with SQLite + synchronize:true.
 * TypeORM auto-creates every Entity-declared table.
 *
 * Caller must close the DataSource when the bootstrap is complete.
 */
async function createBootstrapDataSource(): Promise<DataSource> {
	const entities = [
		(await import("../supabase/entities/index.ts")).UserEntity,
		(await import("../supabase/entities/user-auth-provider.entity.ts"))
			.UserAuthProviderEntity,
		(await import("../supabase/entities/user-session.entity.ts"))
			.UserSessionEntity,
		(await import("../supabase/entities/telegram-bot.entity.ts"))
			.TelegramBotEntity,
		(await import("../supabase/entities/telegram-chat.entity.ts"))
			.TelegramChatEntity,
		(await import("../supabase/entities/telegram-update.entity.ts"))
			.TelegramUpdateEntity,
		(await import("../supabase/entities/scraping-source.entity.ts"))
			.ScrapingSourceEntity,
		(await import("../supabase/entities/scraped-data.entity.ts"))
			.ScrapedDataEntity,
		(await import("../supabase/entities/feature-config.entity.ts"))
			.FeatureConfigEntity,
	];

	const ds = new DataSource({
		type: "sqlite",
		database: path.join(DATA_DIR, "apollo.sqlite"),
		synchronize: true,
		logging: false,
		entities,
	});
	await ds.initialize();
	return ds;
}

// ── native sqlite3 DDL replay ────────────────────────────────────────────────

const SQLITE3 = (() => {
	try {
		return require("sqlite3");
	} catch {
		return null;
	}
})();

type Sqlite3Database = ReturnType<typeof SQLITE3.Database>;

/**
 * Execute the SQLite DDL script using the native `sqlite3` driver so that
 * raw statements (PRAGMA, bare `CREATE TABLE` blocks, DEFAULT expressions)
 * bypass TypeORM's query-builder parser, which mis-fires on them.
 *
 * Uses `db.serialize()` so statements run in connection order with no overlap.
 * Failures are caught per-statement; `already exists` and constraint
 * violations are silently swallowed because `synchronize: true` already
 * created all tables by the time this runs.
 */
function replaySqlliteDDL(
	dbFile: string,
): Promise<{ ok: boolean; errors: string[] }> {
	return new Promise((resolve) => {
		if (!SQLITE3) {
			resolve({ ok: false, errors: ["sqlite3 module not found"] });
			return;
		}

		const db: Sqlite3Database = new SQLITE3.Database(dbFile);
		db.serialize();

		(async () => {
			let sql: string;
			try {
				sql = await fs.readFile(SQLITE_DDL, "utf-8");
			} catch {
				db.close();
				resolve({ ok: false, errors: [`DDL file not found: ${SQLITE_DDL}`] });
				return;
			}

			// Split on semicolons that end a line.  The SQLite DDL script uses
			// `lower(hex(randomblob(n)) || '-4' || …)` inside DEFAULT clauses — a
			// bare `;` split would chop those expressions in half, so only split
			// at `;` followed by a line-break (or end of string).
			const rawStmts = sql.split(/;\s*\n/);
			const errors: string[] = [];
			let pending = rawStmts.length;

			if (pending === 0) {
				db.close();
				resolve({ ok: true, errors: [] });
				return;
			}

			for (const raw of rawStmts) {
				const stmt = raw.trim();
				// Skip empty lines, SQL line comments, and compound statements
				// such as INSERT … SELECT that TypeORM already handles.
				if (!stmt || stmt.startsWith("--") || stmt.startsWith("PRAGMA")) {
					if (--pending === 0) {
						db.close();
						resolve({ ok: errors.length === 0, errors });
					}
					continue;
				}
				db.run(stmt, (err) => {
					if (err && !err.message.includes("already exists")) {
						errors.push(err.message);
					}
					if (--pending === 0) {
						db.close();
						resolve({ ok: errors.length === 0, errors });
					}
				});
			}
		})();
	});
}

// ── public entry point ────────────────────────────────────────────────────────

/**
 * Called once at module scope by `src/lib/db.ts`, before any DataSource is
 * created.
 *
 * Detection logic
 * ───────────────
 * DATABASE_URL or SUPABASE_URL present ──→ Postgres path, return `'postgres'`
 * Neither present                       ──→ Force SQLite, return `'sqlite'`
 *
 * SQLite force-init steps (local dev only):
 *  1. upsert `DATABASE_URL=sqlite` into `.env` + `Bun.env`   (skipped under DOCKERIZED)
 *  2. upsert `JWT_SECRET=<uuid>` into `.env` + `Bun.env`     (skipped under DOCKERIZED)
 *  3. purge + recreate `data/`
 *  4. synchronize:true → creates tables
 *  5. native sqlite3 replay of `.workspace/db_init.sqllite.sql`
 *  6. close bootstrap DataSource
 *
 * When DOCKERIZED=true (set in Dockerfile) or /.dockerenv exists, no .env file
 * is ever read or written — all values must be supplied via Docker --env-file.
 *
 * @returns database mode selected by this run
 */
export async function detectAndInitDatabase(): Promise<"sqlite" | "postgres"> {
	await loadDotEnv();

	// DATABASE_URL=sqlite is our own sentinel value for SQLite mode.
	// Any other non-empty DATABASE_URL (e.g. postgresql://…) → Postgres.
	const rawDbUrl = Bun.env.DATABASE_URL;
	const isExplicitlySqlite = rawDbUrl === "sqlite";
	const hasRealPostgresUrl = !!rawDbUrl && !isExplicitlySqlite;
	const hasSupabase = Boolean(Bun.env.SUPABASE_URL);

	if (hasRealPostgresUrl || hasSupabase) return "postgres";

	// ── force SQLite (local development only) ──────────────────────────────────
	await upsertEnvVar("DATABASE_URL", "sqlite");

	// Auto-generate JWT_SECRET when absent so that `app.ts`'s jwt plugin
	// never receives an empty string.
	await upsertEnvVar("JWT_SECRET", crypto.randomUUID(), true);

	await purgeDataDir();
	await fs.mkdir(DATA_DIR, { recursive: true });

	// synchronize:true → entity tables auto-created
	const bootstrapDs = await createBootstrapDataSource();

	// native sqlite3 → indexes, UNIQUE, DEFAULT, PRAGMA (fragile DDL only)
	const ddlResult = await replaySqlliteDDL(
		path.join(DATA_DIR, "apollo.sqlite"),
	);
	if (!ddlResult.ok) {
		console.warn("db-init: SQLite DDL had non-fatal errors:", ddlResult.errors);
	}

	if (bootstrapDs.isInitialized) await bootstrapDs.destroy();

	console.log(
		`db-init: SQLite database bootstrapped → ${DATA_DIR}/apollo.sqlite`,
	);
	return "sqlite";
}
