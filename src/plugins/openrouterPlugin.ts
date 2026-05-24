// src/plugins/openrouterPlugin.ts
// Elysia plugin: wraps OpenRouterService and exposes its key methods on the context.
// Route handlers call `{ createChatCompletion }`, `{ listModels }`, `{ chat }`
// instead of importing or instantiating OpenRouterService directly.

import { Elysia } from "elysia";
import { env } from "../config/env.ts";
import type {
	ChatCompletionOptions,
	ChatCompletionResponse,
	OpenRouterModel,
} from "../openrouter/interfaces/openrouter.interface.ts";

// ── standalone facade (no Elysia dependency) ───────────────────────
interface CacheEntry {
	result: ChatCompletionResponse;
	expiresAt: number;
}

class OpenRouterFacade {
	readonly apiKey: string;
	readonly baseUrl: string;
	readonly defaultModel: string;
	readonly timeout: number;
	private cache = new Map<string, CacheEntry>();
	private readonly CACHE_TTL = 60_000;

	constructor() {
		this.apiKey = env.string("OPENROUTER_API_KEY", "");
		this.baseUrl = env.string(
			"OPENROUTER_BASE_URL",
			"https://openrouter.ai/api/v1",
		);
		this.defaultModel = env.string(
			"OPENROUTER_DEFAULT_MODEL",
			"google/gemini-2.0-flash-exp:free",
		);
		this.timeout = env.number("OPENROUTER_TIMEOUT", 30_000) ?? 30_000;

		if (!this.apiKey) console.warn("OpenRouter API key not configured");
	}

	private cacheKey(opts: ChatCompletionOptions): string {
		return `${opts.model || this.defaultModel}:${JSON.stringify(opts.messages)}`;
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

	async createChatCompletion(
		options: ChatCompletionOptions,
	): Promise<ChatCompletionResponse> {
		const cached = this.getCached(this.cacheKey(options));
		if (cached) return cached;

		console.log(
			`OpenRouter chat completion → model: ${options.model ?? this.defaultModel}`,
		);
		const response = await fetch(`${this.baseUrl}/chat/completions`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${this.apiKey}`,
				"Content-Type": "application/json",
				"HTTP-Referer": "https://apollo.app",
				"X-Title": "Apollo",
			},
			body: JSON.stringify({
				model: options.model || this.defaultModel,
				messages: options.messages,
				temperature: options.temperature,
				max_tokens: options.max_tokens,
				top_p: options.top_p,
				frequency_penalty: options.frequency_penalty,
				presence_penalty: options.presence_penalty,
				stream: options.stream ?? false,
				tools: options.tools,
				tool_choice: options.tool_choice,
			}),
			signal: AbortSignal.timeout(this.timeout),
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(
				`OpenRouter API error: ${response.status} — ${errorText}`,
			);
		}
		const result: ChatCompletionResponse = await response.json();
		this.setCache(this.cacheKey(options), result);
		console.log(`OpenRouter OK in ${Date.now() - performance.timeOrigin} ms`);
		return result;
	}

	async listModels(): Promise<OpenRouterModel[]> {
		console.log("Fetching OpenRouter models…");
		const response = await fetch(`${this.baseUrl}/models`, {
			method: "GET",
			headers: { Authorization: `Bearer ${this.apiKey}` },
			signal: AbortSignal.timeout(this.timeout),
		});
		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(
				`OpenRouter API error: ${response.status} — ${errorText}`,
			);
		}
		const data = await response.json();
		return data.data ?? [];
	}

	async chat(
		prompt: string,
		model?: string,
		systemPrompt?: string,
	): Promise<string> {
		const messages: Array<{ role: "system" | "user"; content: string }> = [];
		if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
		messages.push({ role: "user", content: prompt });

		const result = await this.createChatCompletion({
			model: model ?? this.defaultModel,
			messages,
		});
		return (result.choices[0]?.message?.content ?? "").replace(/\\n/g, "\n");
	}
}

// ── singleton + plugin ─────────────────────────────────────────────
const openRouter = new OpenRouterFacade();

export interface OpenRouterPluginContext {
	createChatCompletion: (
		opts: ChatCompletionOptions,
	) => Promise<ChatCompletionResponse>;
	listModels: () => Promise<OpenRouterModel[]>;
	chat: (
		prompt: string,
		model?: string,
		systemPrompt?: string,
	) => Promise<string>;
}

export const openrouterPlugin = new Elysia<OpenRouterPluginContext>({
	name: "OpenRouter",
})
	.decorate(
		"createChatCompletion",
		openRouter.createChatCompletion.bind(openRouter),
	)
	.decorate("listModels", openRouter.listModels.bind(openRouter))
	.decorate("chat", openRouter.chat.bind(openRouter));
