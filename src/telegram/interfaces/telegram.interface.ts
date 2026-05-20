export interface TelegramConfig {
  botToken: string;
  webhookUrl?: string;
  webhookSecret?: string;
  timeout: number;
}

export interface SendMessageOptions {
  chat_id: number | string;
  text: string;
  parse_mode?: 'Markdown' | 'MarkdownV2' | 'HTML';
  disable_web_page_preview?: boolean;
  disable_notification?: boolean;
  reply_to_message_id?: number;
  reply_markup?: Record<string, unknown>;
}

export interface TelegramMessage {
  message_id: number;
  chat: {
    id: number;
    type: string;
    title?: string;
    username?: string;
  };
  date: number;
  text?: string;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}

export interface TelegramResponse<T> {
  ok: boolean;
  result: T;
  error_code?: number;
  description?: string;
}

export interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
}
