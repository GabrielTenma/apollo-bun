import { Module, Provider } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_INTERCEPTOR, APP_FILTER } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CommonModule } from './common/common.module';
import { AuthModule } from './auth/auth.module';
import { ScraperModule } from './scraper/scraper.module';
import { OpenRouterModule } from './openrouter/openrouter.module';
import { TelegramModule } from './telegram/telegram.module';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { openRouterConfig } from './openrouter/config/openrouter.config';
import { telegramConfig } from './telegram/config/telegram.config';
import { supabaseConfig } from './supabase/config/supabase.config';
import { SupabaseModule } from './supabase/supabase.module';

const interceptors: Provider[] = [
  {
    provide: APP_INTERCEPTOR,
    useClass: TransformInterceptor,
  },
];

const filters: Provider[] = [
  {
    provide: APP_FILTER,
    useClass: HttpExceptionFilter,
  },
];

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      load: [openRouterConfig, telegramConfig, supabaseConfig],
    }),
    CommonModule,
    AuthModule,
    ScraperModule,
    OpenRouterModule,
    TelegramModule,
    SupabaseModule,
  ],
  controllers: [AppController],
  providers: [AppService, ...interceptors, ...filters],
})
export class AppModule {}
