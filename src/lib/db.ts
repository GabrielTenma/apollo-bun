// src/lib/db.ts — manual TypeORM DataSource (no NestJS)
// Falls back to SQLite when DATABASE_URL is not set.
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { env } from '../config/env.ts';
import { UserEntity } from '../supabase/entities/user.entity.ts';
import { UserAuthProviderEntity } from '../supabase/entities/user-auth-provider.entity.ts';
import { UserSessionEntity } from '../supabase/entities/user-session.entity.ts';
import { TelegramBotEntity } from '../supabase/entities/telegram-bot.entity.ts';
import { TelegramChatEntity } from '../supabase/entities/telegram-chat.entity.ts';
import { TelegramUpdateEntity } from '../supabase/entities/telegram-update.entity.ts';
import { ScrapingSourceEntity } from '../supabase/entities/scraping-source.entity.ts';
import { ScrapedDataEntity } from '../supabase/entities/scraped-data.entity.ts';
import { FeatureConfigEntity } from '../supabase/entities/feature-config.entity.ts';

function createDataSource(useSqlite: boolean): DataSource {
  if (useSqlite) {
    return new DataSource({
      type: 'sqlite',
      database: env.string('SQLITE_DATABASE', 'data/apollo.sqlite'),
      synchronize: true,          // auto-create tables in local dev
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
    synchronize: false,
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

const useSqlite = !env.string('DATABASE_URL');

export const AppDataSource = createDataSource(useSqlite);

if (useSqlite) {
  // Ensure the data directory exists so SQLite file can be created
  const dbPath = env.string('SQLITE_DATABASE', 'data/apollo.sqlite');
  const fs = await import('fs');
  const dir = dbPath.split('/').slice(0, -1).join('/');
  if (dir) fs.mkdirSync(dir, { recursive: true });
}
