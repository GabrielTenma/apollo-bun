import { Controller, Post, Body, Get, Logger, Headers } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import {
  TelegramUpdate,
  SendMessageOptions,
  TelegramMessage,
} from './interfaces/telegram.interface';

/**
 * Controller for Telegram bot operations.
 * Provides endpoints for webhook handling, sending messages,
 * and other Telegram Bot API interactions.
 */
@Controller('/api/v1/telegram')
export class TelegramController {
  private readonly logger = new Logger(TelegramController.name);

  constructor(private readonly telegramService: TelegramService) {}

  /**
   * Webhook endpoint for receiving Telegram updates
   * @param update - Telegram update object
   * @param secretToken - Secret token from header for verification
   * @returns Success status
   *
   * @example
   * POST /telegram/webhook
   * {
   *   "update_id": 123456789,
   *   "message": {
   *     "message_id": 1,
   *     "from": { ... },
   *     "chat": { ... },
   *     "date": 1234567890,
   *     "text": "/start"
   *   }
   * }
   */
  @Post('webhook')
  async webhook(
    @Body() update: TelegramUpdate,
    @Headers('X-Telegram-Bot-Api-Secret-Token') secretToken?: string,
  ): Promise<any> {
    this.logger.log(`Received update: ${update.update_id}`);

    try {
      // Process the update (can be extended with custom logic)
      if (update.message) {
        await this.handleMessage(update.message);
      }

      return { processed: true };
    } catch (error) {
      this.logger.error('Webhook processing failed:', error);
      throw error;
    }
  }

  /**
   * Sends a message to a chat
   * @param options - Send message options
   * @returns Sent message
   *
   * @example
   * POST /telegram/send-message
   * {
   *   "chat_id": 123456789,
   *   "text": "Hello from Apollo!",
   *   "parse_mode": "Markdown"
   * }
   */
  @Post('send-message')
  async sendMessage(@Body() options: SendMessageOptions): Promise<any> {
    this.logger.log(`Send message request to chat: ${options.chat_id}`);
    try {
      return await this.telegramService.sendMessage(options);
    } catch (error) {
      this.logger.error('Send message failed:', error);
      throw error;
    }
  }

  /**
   * Sends a simple text message
   * @param chatId - Chat ID or username
   * @param text - Message text
   * @param parseMode - Parse mode (optional)
   * @returns Sent message
   *
   * @example
   * POST /telegram/send-text
   * {
   *   "chatId": 123456789,
   *   "text": "Hello World!",
   *   "parseMode": "Markdown"
   * }
   */
  @Post('send-text')
  async sendText(
    @Body('chatId') chatId: number | string,
    @Body('text') text: string,
    @Body('parseMode') parseMode?: 'Markdown' | 'MarkdownV2' | 'HTML',
  ): Promise<any> {
    this.logger.log(`Send text request to chat: ${chatId}`);
    try {
      return await this.telegramService.sendText(chatId, text, parseMode);
    } catch (error) {
      this.logger.error('Send text failed:', error);
      throw error;
    }
  }

  /**
   * Gets bot information
   * @returns Bot user information
   *
   * @example
   * GET /telegram/bot-info
   */
  @Get('bot-info')
  async getBotInfo(): Promise<any> {
    this.logger.log('Getting bot info');
    try {
      return await this.telegramService.getMe();
    } catch (error) {
      this.logger.error('Get bot info failed:', error);
      throw error;
    }
  }

  /**
   * Sets webhook URL
   * @param url - Webhook URL
   * @param secretToken - Secret token (optional)
   * @returns Success status
   *
   * @example
   * POST /telegram/set-webhook
   * {
   *   "url": "https://your-domain.com/telegram/webhook",
   *   "secretToken": "your-secret-token"
   * }
   */
  @Post('set-webhook')
  async setWebhook(
    @Body('url') url: string,
    @Body('secretToken') secretToken?: string,
  ): Promise<any> {
    this.logger.log(`Setting webhook to: ${url}`);
    try {
      const result = await this.telegramService.setWebhook(url, secretToken);
      return { success: result };
    } catch (error) {
      this.logger.error('Set webhook failed:', error);
      throw error;
    }
  }

  /**
   * Gets webhook information
   * @returns Webhook info
   *
   * @example
   * GET /telegram/webhook-info
   */
  @Get('webhook-info')
  async getWebhookInfo(): Promise<any> {
    this.logger.log('Getting webhook info');
    try {
      return await this.telegramService.getWebhookInfo();
    } catch (error) {
      this.logger.error('Get webhook info failed:', error);
      throw error;
    }
  }

  /**
   * Health check endpoint for the Telegram service
   * @returns Health status
   */
  @Get('health')
  async healthCheck(): Promise<any> {
    return { status: 'ok', service: 'telegram' };
  }

  /**
   * Handles incoming messages (can be overridden or extended)
   * @param message - Telegram message
   */
  private async handleMessage(message: TelegramMessage): Promise<void> {
    // Basic message handling - can be extended
    if (message.text) {
      this.logger.log(`Received message: ${message.text.substring(0, 50)}...`);

      // Example: Respond to /start command
      if (message.text.startsWith('/start')) {
        await this.telegramService.sendText(
          message.chat.id,
          'Welcome to Apollo Bot! I am now active.',
        );
      }
    }
  }
}
