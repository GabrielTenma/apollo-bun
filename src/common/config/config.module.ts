import { Global, Module } from '@nestjs/common';
import { CommonConfigService } from './config.service';

/**
 * Common configuration module
 * This module provides a centralized CommonConfigService to access all environment variables
 * as a key-value map throughout the application.
 *
 * The module is marked as @Global() so it only needs to be imported once in AppModule
 * and all other modules can inject CommonConfigService directly.
 *
 * Usage in other modules:
 * ```typescript
 * constructor(private readonly commonConfigService: CommonConfigService) {}
 *
 * // Get a specific value
 * const apiKey = this.commonConfigService.get('OPENROUTER_API_KEY');
 *
 * // Get all config as map
 * const allConfig = this.commonConfigService.getAll();
 *
 * // Get config by prefix
 * const telegramConfig = this.commonConfigService.getByPrefix('TELEGRAM_');
 * ```
 */
@Global()
@Module({
  providers: [
    {
      provide: CommonConfigService,
      useFactory: () => new CommonConfigService(),
    },
  ],
  exports: [CommonConfigService],
})
export class ConfigModule {}
