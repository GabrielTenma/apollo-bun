// src/lib/db.ts — manual TypeORM DataSource (no NestJS)
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { env } from '../config/env';
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
