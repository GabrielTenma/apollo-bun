import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { SupabaseOrmService } from './typeorm.service';
import { UserEntity } from '../../supabase/entities/user.entity';
import { UserAuthProviderEntity } from '../../supabase/entities/user-auth-provider.entity';
import { UserSessionEntity } from '../../supabase/entities/user-session.entity';
import { TelegramBotEntity } from '../../supabase/entities/telegram-bot.entity';
import { TelegramChatEntity } from '../../supabase/entities/telegram-chat.entity';
import { TelegramUpdateEntity } from '../../supabase/entities/telegram-update.entity';
import { ScrapingSourceEntity } from '../../supabase/entities/scraping-source.entity';
import { ScrapedDataEntity } from '../../supabase/entities/scraped-data.entity';
import { FeatureConfigEntity } from '../../supabase/entities/feature-config.entity';

/**
 * Module that sets up TypeORM for Supabase's PostgreSQL database.
 * It reads the connection URL from the `DATABASE_URL` environment variable.
 * The module is deliberately kept separate from the legacy Supabase client
 * integration so that existing functionality remains untouched.
 */
@Module({
  imports: [
    // Ensure ConfigModule is available (it is global, but we import it for clarity)
    ConfigModule,
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const url = configService.get<string>('DATABASE_URL') ?? '';
        // If a full connection URL is provided we can use it directly.
        // TypeORM will parse the URL and extract host, port, username, etc.
        return {
          type: 'postgres',
          url,
          // In production you would likely disable synchronize.
          // For the purpose of this integration example we disable it since schema is managed via SQL.
          synchronize: false,
          // Automatically load all entities registered via `forFeature`.
          autoLoadEntities: true,
          // Bun test environment: no DB available.  Do not retry connection so
          // the server can still listen on its HTTP port.
          retryAttempts: 0,
        } as const;
      },
    }),
    // Register entities for injection via @InjectRepository.
    TypeOrmModule.forFeature([
      UserEntity,
      UserAuthProviderEntity,
      UserSessionEntity,
      TelegramBotEntity,
      TelegramChatEntity,
      TelegramUpdateEntity,
      ScrapingSourceEntity,
      ScrapedDataEntity,
      FeatureConfigEntity,
    ]),
  ],
  // Export the DataSource so other modules can inject it if needed.
  providers: [
    {
      provide: 'DATA_SOURCE',
      useFactory: (dataSource: DataSource) => dataSource,
      inject: [DataSource],
    },
    SupabaseOrmService,
  ],
  exports: [TypeOrmModule, 'DATA_SOURCE', SupabaseOrmService],
})
export class SupabaseTypeOrmModule {}
