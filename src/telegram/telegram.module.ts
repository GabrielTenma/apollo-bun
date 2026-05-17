import { Module, Global } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { TelegramController } from './telegram.controller';

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
  providers: [TelegramService],
  controllers: [TelegramController],
  exports: [TelegramService],
})
export class TelegramModule {}
