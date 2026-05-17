/**
 * Interface for Telegram message
 */
export interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  chat: TelegramChat;
  date: number;
  text?: string;
  entities?: MessageEntity[];
}

/**
 * Interface for Telegram user
 */
export interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

/**
 * Interface for Telegram chat
 */
export interface TelegramChat {
  id: number;
  type: 'private' | 'group' | 'supergroup' | 'channel';
  title?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
}

/**
 * Interface for message entity (commands, mentions, etc.)
 */
export interface MessageEntity {
  type:
    | 'mention'
    | 'hashtag'
    | 'bot_command'
    | 'url'
    | 'email'
    | 'bold'
    | 'italic'
    | 'code'
    | 'pre'
    | 'text_link';
  offset: number;
  length: number;
  url?: string;
}

/**
 * Interface for send message options
 */
export interface SendMessageOptions {
  chat_id: number | string;
  text: string;
  parse_mode?: 'Markdown' | 'MarkdownV2' | 'HTML';
  disable_web_page_preview?: boolean;
  disable_notification?: boolean;
  reply_to_message_id?: number;
  reply_markup?: ReplyMarkup;
}

/**
 * Interface for reply markup (keyboards, etc.)
 */
export interface ReplyMarkup {
  inline_keyboard?: InlineKeyboardButton[][];
  keyboard?: KeyboardButton[][];
  resize_keyboard?: boolean;
  one_time_keyboard?: boolean;
  selective?: boolean;
}

/**
 * Interface for inline keyboard button
 */
export interface InlineKeyboardButton {
  text: string;
  url?: string;
  callback_data?: string;
  web_app?: WebAppInfo;
}

/**
 * Interface for keyboard button
 */
export interface KeyboardButton {
  text: string;
  request_contact?: boolean;
  request_location?: boolean;
}

/**
 * Interface for web app info
 */
export interface WebAppInfo {
  url: string;
}

/**
 * Interface for update object (webhook)
 */
export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
  channel_post?: TelegramMessage;
  callback_query?: CallbackQuery;
}

/**
 * Interface for callback query
 */
export interface CallbackQuery {
  id: string;
  from: TelegramUser;
  message?: TelegramMessage;
  data?: string;
}

/**
 * Interface for Telegram configuration
 */
export interface TelegramConfig {
  botToken: string;
  webhookUrl?: string;
  webhookSecret?: string;
  timeout?: number;
}

/**
 * Interface for API response
 */
export interface TelegramResponse<T> {
  ok: boolean;
  result?: T;
  description?: string;
  error_code?: number;
}
