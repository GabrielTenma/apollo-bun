import {
  SendMessageOptions,
  TelegramMessage,
  TelegramUpdate,
  TelegramResponse,
  TelegramUser,
} from '../../telegram/interfaces/telegram.interface.ts';
import { env } from '../../config/env.ts';

export class TelegramService {
  botToken: string;
  baseUrl: string;
  timeout: number;

  constructor() {
    this.botToken = env.string('TELEGRAM_BOT_TOKEN', '');
    this.baseUrl = `https://api.telegram.org/bot${this.botToken}`;
    this.timeout = env.number('TELEGRAM_TIMEOUT', 30000) ?? 30000;
    if (!this.botToken) console.warn('Telegram bot token not configured');
  }

  async sendMessage(options: SendMessageOptions): Promise<TelegramMessage> {
    try {
      console.log(`Sending message to chat: ${options.chat_id}`);
      return await this.makeRequest<TelegramMessage>('sendMessage', {
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
    } catch (error) {
      console.error('Failed to send message:', error);
      throw error;
    }
  }

  async getMe(): Promise<TelegramUser> {
    try {
      console.log('Getting bot information');
      return await this.makeRequest<TelegramUser>('getMe');
    } catch (error) {
      console.error('Failed to get bot info:', error);
      throw error;
    }
  }

  async setWebhook(url: string, secretToken?: string): Promise<boolean> {
    try {
      console.log(`Setting webhook to: ${url}`);
      await this.makeRequest('setWebhook', { url, secret_token: secretToken });
      return true;
    } catch (error) {
      console.error('Failed to set webhook:', error);
      throw error;
    }
  }

  async getWebhookInfo(): Promise<Record<string, unknown>> {
    try {
      console.log('Getting webhook info');
      return await this.makeRequest('getWebhookInfo');
    } catch (error) {
      console.error('Failed to get webhook info:', error);
      throw error;
    }
  }

  async deleteWebhook(): Promise<boolean> {
    try {
      console.log('Deleting webhook');
      await this.makeRequest('deleteWebhook');
      return true;
    } catch (error) {
      console.error('Failed to delete webhook:', error);
      throw error;
    }
  }

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
      headers: { 'Content-Type': 'application/json' },
      body: Object.keys(body).length > 0 ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(this.timeout),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Telegram API error: ${response.status} - ${errorText}`,
      );
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
