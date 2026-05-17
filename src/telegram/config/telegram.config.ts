/**
 * Telegram configuration
 * This file contains the configuration for Telegram Bot API
 */
import { CommonConfigService } from '../../common/config/config.service';

// Instantiate CommonConfigService directly; reads process.env without any NestJS DI.
const commonConfigService = new CommonConfigService();

export const telegramConfig = () => ({
  telegram: {
    botToken: commonConfigService.get('TELEGRAM_BOT_TOKEN') ?? '',
    webhookUrl: commonConfigService.get('TELEGRAM_WEBHOOK_URL') ?? '',
    webhookSecret: commonConfigService.get('TELEGRAM_WEBHOOK_SECRET') ?? '',
    timeout: commonConfigService.getNumber('TELEGRAM_TIMEOUT', 30000),
  },
});

/**
 * Validation function for Telegram configuration
 */
export function validateTelegramConfig() {
  const config = telegramConfig();
  const errors: string[] = [];

  if (!config.telegram.botToken) {
    errors.push('TELEGRAM_BOT_TOKEN is not set in environment variables');
  }

  if (config.telegram.timeout <= 0) {
    errors.push('TELEGRAM_TIMEOUT must be a positive number');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
