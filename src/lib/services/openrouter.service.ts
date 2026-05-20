import {
  ChatCompletionOptions,
  ChatCompletionResponse,
  OpenRouterModel,
} from '../../openrouter/interfaces/openrouter.interface.ts';
import { env } from '../../config/env.ts';

interface CacheEntry {
  result: ChatCompletionResponse;
  expiresAt: number;
}

export class OpenRouterService {
  apiKey: string;
  baseUrl: string;
  defaultModel: string;
  timeout: number;
  private cache = new Map<string, CacheEntry>();
  private readonly CACHE_TTL = 60_000; // 60 s

  private cacheKey(options: ChatCompletionOptions): string {
    return `${options.model || this.defaultModel}:${JSON.stringify(options.messages)}`;
  }

  private getCached(key: string): ChatCompletionResponse | undefined {
    const entry = this.cache.get(key);
    if (entry && Date.now() < entry.expiresAt) return entry.result;
    this.cache.delete(key);
    return undefined;
  }

  private setCache(key: string, result: ChatCompletionResponse): void {
    this.cache.set(key, { result, expiresAt: Date.now() + this.CACHE_TTL });
  }

  constructor() {
    this.apiKey = env.string('OPENROUTER_API_KEY', '');
    this.baseUrl = env.string(
      'OPENROUTER_BASE_URL',
      'https://openrouter.ai/api/v1',
    );
    this.defaultModel = env.string(
      'OPENROUTER_DEFAULT_MODEL',
      'google/gemini-2.0-flash-exp:free',
    );
    this.timeout = env.number('OPENROUTER_TIMEOUT', 30000) ?? 30000;

    if (!this.apiKey) {
      console.warn('OpenRouter API key not configured');
    }
  }

  async createChatCompletion(
    options: ChatCompletionOptions,
  ): Promise<ChatCompletionResponse> {
    const startTime = Date.now();
    try {
      // In-memory cache: same model + messages within 60 s → skip the API call
      const key = this.cacheKey(options);
      const cached = this.getCached(key);
      if (cached) return cached;

      console.log(`Creating chat completion with model: ${options.model}`);
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://apollo.app',
          'X-Title': 'Apollo',
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
      this.setCache(key, result);
      console.log(
        `Chat completion successful in ${Date.now() - startTime}ms`,
      );
      return result;
    } catch (error) {
      console.error('Chat completion failed:', error);
      throw error;
    }
  }

  async listModels(): Promise<OpenRouterModel[]> {
    try {
      console.log('Fetching available models from OpenRouter');
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
      console.error('Failed to list models:', error);
      throw error;
    }
  }

  async chat(
    prompt: string,
    model?: string,
    systemPrompt?: string,
  ): Promise<string> {
    const messages: Array<{ role: 'system' | 'user'; content: string }> = [];
    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
    messages.push({ role: 'user', content: prompt });

    const response = await this.createChatCompletion({
      model: model || this.defaultModel,
      messages,
    });

    const content = response.choices[0]?.message?.content || '';
    return content.replace(/\n/g, '\n');
  }
}
