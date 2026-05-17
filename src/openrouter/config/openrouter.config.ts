/**
 * OpenRouter configuration
 * This file contains the configuration for OpenRouter API
 */
import { CommonConfigService } from '../../common/config/config.service';

// Instantiate CommonConfigService directly; reads process.env without any NestJS DI.
const commonConfigService = new CommonConfigService();

export const openRouterConfig = () => ({
  openrouter: {
    apiKey: commonConfigService.get('OPENROUTER_API_KEY') ?? '',
    baseUrl:
      commonConfigService.get('OPENROUTER_BASE_URL') ??
      'https://openrouter.ai/api/v1',
    defaultModel:
      commonConfigService.get('OPENROUTER_DEFAULT_MODEL') ?? 'openrouter/free',
    timeout: commonConfigService.getNumber('OPENROUTER_TIMEOUT', 30000),
  },
});

/**
 * Validation function for OpenRouter configuration
 */
export function validateOpenRouterConfig() {
  const config = openRouterConfig();
  const errors: string[] = [];

  if (!config.openrouter.apiKey) {
    errors.push('OPENROUTER_API_KEY is not set in environment variables');
  }

  if (config.openrouter.timeout <= 0) {
    errors.push('OPENROUTER_TIMEOUT must be a positive number');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
