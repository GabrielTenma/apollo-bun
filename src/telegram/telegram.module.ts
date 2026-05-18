import { Module, Global } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { TelegramController } from './telegram.controller';

/**
 * Factory for TelegramService — no external deps; factory exists so that
 * `design:paramtypes` is never read under esbuild/tsx.
 */
function buildTelegramService(): TelegramService {
  return TelegramService.create();
}

/**
 * Factory for TelegramController — injects TelegramService from the
 * factory-based provider above.
 */
function buildTelegramController(
  telegramService: TelegramService,
): TelegramController {
  return TelegramController.create(telegramService);
}

/**
 * Module for Telegram Bot functionality.
 * Provides the TelegramService for interacting with Telegram Bot API,
 * including sending messages, webhook handling, and bot operations.
 *
 * Can be imported globally to make the TelegramService available
 * throughout the application.
 */
@Global()
@Module({
  providers: [
    {
      provide: TelegramService,
      useFactory: buildTelegramService,
      inject: [],
    },
    {
      provide: TelegramController,
      useFactory: buildTelegramController,
      inject: [TelegramService],
    },
  ],
  controllers: [TelegramController],
  exports: [TelegramService],
})
export class TelegramModule {}
