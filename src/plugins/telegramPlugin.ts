// src/plugins/telegramPlugin.ts
// Elysia plugin: wraps TelegramService and exposes its key methods on the context.
// Route handlers call `{ sendMessage, sendText, setWebhook, getMe }` instead of
// importing the class directly.

import { Elysia } from "elysia";
import { TelegramService } from "../lib/services/telegram.service.ts";

// ── Elysia-bound context keys ───────────────────────────────────────
export interface TelegramPluginContext {
	/** Send a message (full options). */
	sendMessage: (opts: {
		chat_id: number | string;
		text: string;
		parse_mode?: string;
		reply_markup?: unknown;
	}) => Promise<unknown>;
	/** Shortcut — chat_id + text + optional parse mode. */
	sendText: (
		chatId: number | string,
		text: string,
		parseMode?: "Markdown" | "MarkdownV2" | "HTML",
	) => Promise<unknown>;
	/** Register / update the bot's webhook endpoint. */
	setWebhook: (url: string, secretToken?: string) => Promise<boolean>;
	/** `GET /getMe` — returns bot identity. */
	getMe: () => Promise<{
		id: number;
		is_bot: boolean;
		first_name: string;
		username: string;
	}>;
}

// ── singleton + plugin ──────────────────────────────────────────────
const telegramService = new TelegramService();

export const telegramPlugin = new Elysia<TelegramPluginContext>({
	name: "Telegram",
})
	.decorate("sendMessage", telegramService.sendMessage.bind(telegramService))
	.decorate("sendText", telegramService.sendText.bind(telegramService))
	.decorate("setWebhook", telegramService.setWebhook.bind(telegramService))
	.decorate("getMe", telegramService.getMe.bind(telegramService));
