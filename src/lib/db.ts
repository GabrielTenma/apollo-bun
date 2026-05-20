// src/lib/db.ts — manual TypeORM DataSource (no NestJS)
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

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: env.string('DATABASE_URL') ?? '',
  synchronize: false,
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
