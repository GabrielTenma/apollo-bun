import { Injectable, Logger } from '@nestjs/common';
import {
  ChatCompletionOptions,
  ChatCompletionResponse,
  OpenRouterConfig,
  OpenRouterModel,
} from './interfaces/openrouter.interface';
import { env } from '../common/utils/environment.util';

/**
 * OpenRouter service for interacting with OpenRouter API.
 * Factory pattern: constructor body runs under a static factory so that
 * `design:paramtypes` metadata is never read under tsx/esbuild.
 */
@Injectable()
export class OpenRouterService {
  // Assigned by the static factory; never `undefined` after construction
  logger!: Logger;
  apiKey!: string;
  baseUrl!: string;
  defaultModel!: string;
  timeout!: number;

  private constructor() {}

  /**
   * Static factory — NestJS resolves all deps manually.
   */
  static create(): OpenRouterService {
    const svc = new OpenRouterService();
    svc.logger = new Logger(OpenRouterService.name);
    svc.apiKey = env.string('OPENROUTER_API_KEY', '');
    svc.baseUrl = env.string(
      'OPENROUTER_BASE_URL',
      'https://openrouter.ai/api/v1',
    );
    svc.defaultModel = env.string(
      'OPENROUTER_DEFAULT_MODEL',
      'google/gemini-2.0-flash-exp:free',
    );
    svc.timeout = env.number('OPENROUTER_TIMEOUT', 30000) ?? 30000;

    if (!svc.apiKey) {
      svc.logger.warn('OpenRouter API key not configured');
    }
    return svc;
  }

  async createChatCompletion(
    options: ChatCompletionOptions,
  ): Promise<ChatCompletionResponse> {
    const startTime = Date.now();

    try {
      this.logger.log(`Creating chat completion with model: ${options.model}`);

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://apollo.app',
          'X-Title': 'Apollo NestJS App',
        },
        body: JSON.stringify({
          model: options.model || this.defaultModel,
          messages: options.messages,
          temperature: options.temperature,
          max_tokens: options.max_tokens,
          top_p: options.top_p,
          frequency_penalty: options.frequency_penalty,
          presence_penalty: options.presence_penalty,
          stream: options.stream || false,
          tools: options.tools,
          tool_choice: options.tool_choice,
        }),
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `OpenRouter API error: ${response.status} - ${errorText}`,
        );
      }

      const result: ChatCompletionResponse = await response.json();

      this.logger.log(
        `Chat completion successful in ${Date.now() - startTime}ms`,
      );

      return result;
    } catch (error) {
      this.logger.error('Chat completion failed:', error);
      throw error;
    }
  }

  async listModels(): Promise<OpenRouterModel[]> {
    try {
      this.logger.log('Fetching available models from OpenRouter');

      const response = await fetch(`${this.baseUrl}/models`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `OpenRouter API error: ${response.status} - ${errorText}`,
        );
      }

      const data = await response.json();
      return data.data || [];
    } catch (error) {
      this.logger.error('Failed to list models:', error);
      throw error;
    }
  }

  async chat(
    prompt: string,
    model?: string,
    systemPrompt?: string,
  ): Promise<string> {
    const messages: Array<{ role: 'system' | 'user'; content: string }> = [];

    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }

    messages.push({ role: 'user', content: prompt });

    const response = await this.createChatCompletion({
      model: model || this.defaultModel,
      messages,
    });

    const content = response.choices[0]?.message?.content || '';
    return content.replace(/\n/g, '\n');
  }
}
