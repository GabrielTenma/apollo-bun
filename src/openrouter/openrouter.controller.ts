import { Controller, Post, Body, Get, Logger, Inject } from '@nestjs/common';
import { OpenRouterService } from './openrouter.service';
import {
  ChatCompletionOptions,
  ChatCompletionResponse,
  OpenRouterModel,
} from './interfaces/openrouter.interface';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import {
  APP_CONSTANTS,
  AppConstants,
  appConstants,
} from '../constants/app.constants';
import { successResponse } from '../common/utils/response.util';
import { FinancialAgentService } from './agents/financial.agent';

/**
 * Controller for OpenRouter AI operations.
 * Provides endpoints for chat completions, model listing,
 * and other AI model interactions through OpenRouter API.
 */
@Controller('/api/v1/openrouter')
export class OpenRouterController {
  private readonly logger = new Logger(OpenRouterController.name);

  constructor(
    private readonly openRouterService: OpenRouterService,
    private readonly financialAgentService: FinancialAgentService,
    @Inject(APP_CONSTANTS) private readonly constants: AppConstants,
  ) {}

  /**
   * Creates a chat completion
   * @param options - Chat completion options
   * @returns Chat completion result
   *
   * @example
   * POST /openrouter/chat
   * {
   *   "model": "google/gemini-2.0-flash-exp:free",
   *   "messages": [
   *     { "role": "user", "content": "Hello, how are you?" }
   *   ],
   *   "temperature": 0.7
   * }
   */
  @Post('chat')
  @Roles('admin', 'moderator')
  async createChatCompletion(
    @Body() options: ChatCompletionOptions,
  ): Promise<any> {
    this.logger.log(`Chat completion request with model: ${options.model}`);
    try {
      return await this.openRouterService.createChatCompletion(options);
    } catch (error) {
      this.logger.error('Chat completion failed:', error);
      throw error;
    }
  }

  /**
   * Lists available models from OpenRouter
   * @returns Array of available models
   *
   * @example
   * GET /openrouter/models
   */
  @Get('models')
  @Roles('admin', 'moderator')
  async listModels(): Promise<any> {
    this.logger.log('Listing available models');
    try {
      return await this.openRouterService.listModels();
    } catch (error) {
      this.logger.error('Failed to list models:', error);
      throw error;
    }
  }

  /**
   * Simple chat endpoint with just a prompt
   * @param prompt - User prompt
   * @param model - Model to use (optional)
   * @param systemPrompt - System prompt (optional)
   * @returns Generated text response
   *
   * @example
   * POST /openrouter/simple-chat
   * {
   *   "prompt": "What is the capital of France?",
   *   "model": "google/gemini-2.0-flash-exp:free",
   *   "systemPrompt": "You are a helpful assistant"
   * }
   */
  @Post('simple-chat')
  @Roles('admin', 'moderator')
  async simpleChat(
    @Body('prompt') prompt: string,
    @Body('model') model?: string,
    @Body('systemPrompt') systemPrompt?: string,
  ): Promise<any> {
    this.logger.log(`Simple chat request: ${prompt.substring(0, 50)}...`);
    try {
      const response = await this.openRouterService.chat(
        prompt,
        model,
        systemPrompt,
      );
      return { response };
    } catch (error) {
      this.logger.error('Simple chat failed:', error);
      throw error;
    }
  }

  /**
   * Health check endpoint for the OpenRouter service
   * @returns Health status
   */
  @Public()
  @Get('health')
  async healthCheck(): Promise<any> {
    return { status: 'ok', service: 'openrouter' };
  }

  @Public()
  @Get('completion')
  async completion(): Promise<any> {
    this.logger.log(`Requested to get routine completion`);

    type Content = {
      name: string;
      value: any;
    };
    const content: Content[] = [];

    // latest
    const contentLatest = appConstants.scrapedContentStore.get('completion');
    if (contentLatest != undefined) {
      content.push({
        name: 'latest',
        value: contentLatest,
      });
    }

    // old
    const contentPrevious = appConstants.scrapedContentStore.get(
      'completion-previous',
    );
    if (contentPrevious != undefined && contentPrevious != contentLatest) {
      content.push({
        name: 'previous',
        value: contentPrevious,
      });
    }
    return content.length === 0
      ? successResponse(undefined, 'on process routine', 202)
      : successResponse(content);
  }
}
