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
 *
 * Factory pattern: all constructor params are injected explicitly by the module
 * via `useFactory`, bypassing the broken `design:paramtypes` code path.
 */
@Controller('/api/v1/openrouter')
export class OpenRouterController {
  // Assigned by the static factory; never `undefined` after construction
  openRouterService!: OpenRouterService;
  financialAgentService!: FinancialAgentService;
  constants!: AppConstants;
  private readonly logger = new Logger(OpenRouterController.name);

  private constructor() {}

  /**
   * Static factory — NestJS resolves all deps manually.
   */
  static create(
    openRouterService: OpenRouterService,
    financialAgentService: FinancialAgentService,
    constants: AppConstants,
  ): OpenRouterController {
    const ctrl = new OpenRouterController();
    ctrl.openRouterService = openRouterService;
    ctrl.financialAgentService = financialAgentService;
    ctrl.constants = constants;
    return ctrl;
  }

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
    const contentLatest = this.constants.scrapedContentStore.get('completion');
    if (contentLatest != undefined) {
      content.push({
        name: 'latest',
        value: contentLatest,
      });
    }

    // old
    const contentPrevious = this.constants.scrapedContentStore.get(
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
