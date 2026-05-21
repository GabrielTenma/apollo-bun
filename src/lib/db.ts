// src/lib/db.ts — manual TypeORM DataSource (AppDataSource)
//
// Startup order
// ─────────────
// 1. detectAndInitDatabase() (imported from db-init.ts) runs first.
//    It checks Bun.env for DATABASE_URL / SUPABASE_URL.
//    If neither is set, it:
//      • writes DATABASE_URL=sqlite to .env  (so env.ts picks it up everywhere)
//      • purges any stale data/ directory
//      • creates a temporary DataSource with synchronize: true → auto-creates tables
//      • replays .workspace/db_init.sqllite.sql to add indexes / constraints
//      • closes the temporary DataSource
// 2. createDataSource(useSqlite) builds the AppDataSource that every entity
//    and repository in the rest of the codebase imports and uses.
//    For SQLite: synchronize: true (safe because schema has been seeded clean)
//    For Postgres: synchronize: false (migrations are managed externally)

import 'reflect-metadata';
import { DataSource } from 'typeorm';
import path from 'node:path';
import { env } from '../config/env.ts';

import {
  UserEntity,
  UserAuthProviderEntity,
  UserSessionEntity,
  TelegramBotEntity,
  TelegramChatEntity,
  TelegramUpdateEntity,
  ScrapingSourceEntity,
  ScrapedDataEntity,
  FeatureConfigEntity,
} from '../supabase/entities/index.ts';

import { detectAndInitDatabase } from './db-init.ts';

// ── 1. auto-detect + auto-init (runs at module load, before AppDataSource) ───
const _databaseMode = await detectAndInitDatabase();

// Force Bun.env to match what detectAndInitDatabase wrote to .env
const _DATABASE_URL = env.string('DATABASE_URL', '');

// ── 2. build the real DataSource used by every repository in the codebase ────

const useSqlite = !_DATABASE_URL || _DATABASE_URL === 'sqlite';

// Help TypeORM's SQLite dialect resolve the file before attempting to connect
if (useSqlite) {
  const dbPath = env.string('SQLITE_DATABASE', 'data/apollo.sqlite');
  const dir = path.dirname(dbPath);
  try { await import('fs').then((m) => m.mkdirSync(dir, { recursive: true })); }
  catch { /* directory already exists or permissions issue — non-fatal here */ }
}

function createDataSource(sqlite: boolean): DataSource {
  if (sqlite) {
    return new DataSource({
      type: 'sqlite',
      database: env.string('SQLITE_DATABASE', 'data/apollo.sqlite'),
      synchronize: true,          // safe: db-init seeded the schema first
      logging: env.bool('NODE_ENV', false) ? ['query'] : false,
      entities: [
        UserEntity,
        UserAuthProviderEntity,
        UserSessionEntity,
        TelegramBotEntity,
        TelegramChatEntity,
        TelegramUpdateEntity,
        ScrapingSourceEntity,
        ScrapedDataEntity,
        FeatureConfigEntity,
      ],
    });
  }

  return new DataSource({
    type: 'postgres',
    url: env.string('DATABASE_URL') ?? '',
    synchronize: false,            // Postgres: migrations managed externally
    logging: env.bool('NODE_ENV', false) ? ['query'] : false,
    extra: {
      max: 20,
      min: 5,
      connectionTimeoutMillis: 10_000,
      idleTimeoutMillis: 30_000,
      keepAlive: true,
    },
    entities: [
      UserEntity,
      UserAuthProviderEntity,
      UserSessionEntity,
      TelegramBotEntity,
      TelegramChatEntity,
      TelegramUpdateEntity,
      ScrapingSourceEntity,
      ScrapedDataEntity,
      FeatureConfigEntity,
    ],
  });
}

// ── 3. export the shared DataSource instance ────────────────────────────────
export const AppDataSource = createDataSource(useSqlite);
