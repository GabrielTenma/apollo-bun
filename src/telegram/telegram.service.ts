import { Injectable, Logger } from '@nestjs/common';
import {
  TelegramConfig,
  SendMessageOptions,
  TelegramMessage,
  TelegramUpdate,
  TelegramResponse,
  TelegramUser,
} from './interfaces/telegram.interface';
import { env } from '../common/utils/environment.util';

/**
 * Telegram service for interacting with Telegram Bot API.
 * Provides methods for sending messages, managing webhooks,
 * and handling bot operations.
 */
@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);
  private readonly botToken: string;
  private readonly baseUrl: string;
  private readonly timeout: number;

  constructor() {
    this.botToken = env.string('TELEGRAM_BOT_TOKEN', '');
    this.baseUrl = `https://api.telegram.org/bot${this.botToken}`;
    this.timeout = env.number('TELEGRAM_TIMEOUT', 30000) ?? 30000;

    if (!this.botToken) {
      this.logger.warn('Telegram bot token not configured');
    }
  }

  /**
   * Sends a message to a chat
   * @param options - Send message options
   * @returns Sent message object
   */
  async sendMessage(options: SendMessageOptions): Promise<TelegramMessage> {
    try {
      this.logger.log(`Sending message to chat: ${options.chat_id}`);

      const response = await this.makeRequest<TelegramMessage>('sendMessage', {
        chat_id: options.chat_id,
        text: options.text,
        parse_mode: options.parse_mode,
        disable_web_page_preview: options.disable_web_page_preview,
        disable_notification: options.disable_notification,
        reply_to_message_id: options.reply_to_message_id,
        reply_markup: options.reply_markup
          ? JSON.stringify(options.reply_markup)
          : undefined,
      });

      return response;
    } catch (error) {
      this.logger.error('Failed to send message:', error);
      throw error;
    }
  }

  /**
   * Gets information about the bot
   * @returns Bot user information
   */
  async getMe(): Promise<TelegramUser> {
    try {
      this.logger.log('Getting bot information');
      return await this.makeRequest<TelegramUser>('getMe');
    } catch (error) {
      this.logger.error('Failed to get bot info:', error);
      throw error;
    }
  }

  /**
   * Sets webhook for receiving updates
   * @param url - Webhook URL
   * @param secretToken - Secret token for webhook verification
   * @returns Success status
   */
  async setWebhook(url: string, secretToken?: string): Promise<boolean> {
    try {
      this.logger.log(`Setting webhook to: ${url}`);

      await this.makeRequest('setWebhook', {
        url,
        secret_token: secretToken,
      });

      return true;
    } catch (error) {
      this.logger.error('Failed to set webhook:', error);
      throw error;
    }
  }

  /**
   * Gets webhook information
   * @returns Webhook info
   */
  async getWebhookInfo(): Promise<Record<string, unknown>> {
    try {
      this.logger.log('Getting webhook info');
      return await this.makeRequest('getWebhookInfo');
    } catch (error) {
      this.logger.error('Failed to get webhook info:', error);
      throw error;
    }
  }

  /**
   * Deletes the current webhook
   * @returns Success status
   */
  async deleteWebhook(): Promise<boolean> {
    try {
      this.logger.log('Deleting webhook');
      await this.makeRequest('deleteWebhook');
      return true;
    } catch (error) {
      this.logger.error('Failed to delete webhook:', error);
      throw error;
    }
  }

  /**
   * Sends a simple text message to a chat
   * @param chatId - Chat ID or username
   * @param text - Message text
   * @param parseMode - Parse mode (Markdown, HTML, etc.)
   * @returns Sent message
   */
  async sendText(
    chatId: number | string,
    text: string,
    parseMode?: 'Markdown' | 'MarkdownV2' | 'HTML',
  ): Promise<TelegramMessage> {
    return this.sendMessage({
      chat_id: chatId,
      text,
      parse_mode: parseMode,
    });
  }

  /**
   * Makes a request to Telegram Bot API
   * @param method - API method name
   * @param params - Method parameters
   * @returns API response
   */
  private async makeRequest<T>(
    method: string,
    params?: Record<string, unknown>,
  ): Promise<T> {
    const url = `${this.baseUrl}/${method}`;

    const body = params
      ? Object.fromEntries(
          Object.entries(params).filter(([, v]) => v !== undefined),
        )
      : {};

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: Object.keys(body).length > 0 ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(this.timeout),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Telegram API error: ${response.status} - ${errorText}`);
    }

    const data: TelegramResponse<T> = await response.json();

    if (!data.ok) {
      throw new Error(
        `Telegram API error: ${data.error_code} - ${data.description}`,
      );
    }

    return data.result as T;
  }
}
