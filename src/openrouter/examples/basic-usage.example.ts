/**
 * OpenRouter Basic Usage Examples
 *
 * This file demonstrates how to use the OpenRouter module
 * in your NestJS application.
 */

import { Injectable } from '@nestjs/common';
import { OpenRouterService } from '../openrouter.service';
import {
  ChatCompletionOptions,
  ChatMessage,
} from '../interfaces/openrouter.interface';

@Injectable()
export class ExampleService {
  constructor(private readonly openRouterService: OpenRouterService) {}

  /**
   * Example 1: Simple chat completion
   */
  async simpleChatExample(): Promise<string> {
    const response = await this.openRouterService.chat(
      'What is the capital of France?',
      'google/gemini-2.0-flash-exp:free',
      'You are a helpful geography assistant.',
    );

    console.log('Response:', response);
    return response;
  }

  /**
   * Example 2: Advanced chat completion with full options
   */
  async advancedChatExample(): Promise<void> {
    const messages: ChatMessage[] = [
      { role: 'system', content: 'You are a helpful coding assistant.' },
      {
        role: 'user',
        content: 'Write a TypeScript function to sort an array.',
      },
    ];

    const options: ChatCompletionOptions = {
      model: 'google/gemini-2.0-flash-exp:free',
      messages,
      temperature: 0.7,
      max_tokens: 1000,
      top_p: 0.9,
    };

    const response = await this.openRouterService.createChatCompletion(options);

    console.log('Response:', response.choices[0]?.message?.content);
    console.log('Usage:', response.usage);
  }

  /**
   * Example 3: List available models
   */
  async listModelsExample(): Promise<void> {
    const models = await this.openRouterService.listModels();

    console.log('Available models:');
    models.forEach((model) => {
      console.log(`- ${model.name} (${model.id})`);
      console.log(`  Context length: ${model.context_length}`);
      console.log(
        `  Pricing: $${model.pricing.prompt}/1K prompt, $${model.pricing.completion}/1K completion`,
      );
    });
  }

  /**
   * Example 4: Using tools/functions
   */
  async toolsExample(): Promise<void> {
    const messages: ChatMessage[] = [
      { role: 'user', content: 'What is the weather in Paris?' },
    ];

    const options: ChatCompletionOptions = {
      model: 'google/gemini-2.0-flash-exp:free',
      messages,
      tools: [
        {
          type: 'function',
          function: {
            name: 'get_weather',
            description: 'Get the current weather in a location',
            parameters: {
              type: 'object',
              properties: {
                location: {
                  type: 'string',
                  description: 'The city and state, e.g. San Francisco, CA',
                },
              },
              required: ['location'],
            },
          },
        },
      ],
    };

    const response = await this.openRouterService.createChatCompletion(options);

    console.log('Response:', JSON.stringify(response, null, 2));
  }
}

/**
 * REST API Usage Examples:
 *
 * 1. Simple chat:
 * POST /openrouter/simple-chat
 * {
 *   "prompt": "What is the capital of France?",
 *   "model": "google/gemini-2.0-flash-exp:free",
 *   "systemPrompt": "You are a helpful assistant"
 * }
 *
 * 2. Advanced chat completion:
 * POST /openrouter/chat
 * {
 *   "model": "google/gemini-2.0-flash-exp:free",
 *   "messages": [
 *     { "role": "system", "content": "You are a helpful assistant" },
 *     { "role": "user", "content": "Hello!" }
 *   ],
 *   "temperature": 0.7,
 *   "max_tokens": 1000
 * }
 *
 * 3. List models:
 * GET /openrouter/models
 *
 * 4. Health check:
 * GET /openrouter/health
 */
