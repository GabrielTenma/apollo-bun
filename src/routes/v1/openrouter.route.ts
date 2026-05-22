// src/routes/v1/openrouter.route.ts
// OpenRouter routes under /api/v1/openrouter/.
// deps: openrouterPlugin (context.{ createChatCompletion, listModels, chat })
//       + scrapedContentStore injected by app.ts

import { Elysia } from "elysia";
import type { ChatCompletionOptions } from "../../openrouter/interfaces/openrouter.interface.ts";
import { openrouterPlugin } from "../../plugins/openrouterPlugin.ts";

const openrouterRoutes = new Elysia({
	prefix: "/openrouter",
	name: "openrouterRoutes",
})
	.use(openrouterPlugin)

	// POST /api/v1/openrouter/chat  -- raw OpenAI-style payload
	.post("/chat", async ({ createChatCompletion, body }) => {
		const result = await createChatCompletion(body as ChatCompletionOptions);
		return { success: true, data: result };
	})

	// GET /api/v1/openrouter/models
	.get("/models", async ({ listModels }) => {
		const models = await listModels();
		return { success: true, data: models };
	})

	// POST /api/v1/openrouter/simple-chat  -- { prompt, model?, systemPrompt? }
	.post("/simple-chat", async ({ chat, body }) => {
		const result = await chat(
			(body as any).prompt,
			(body as any).model,
			(body as any).systemPrompt,
		);
		return { success: true, data: result };
	})

	.get("/health", () => ({ status: "ok", service: "openrouter" }))

	// GET /api/v1/openrouter/completion -- latest + previous from MemoryKeyStore
	.get("/completion", async ({ scrapedContentStore, set }) => {
		const latest = scrapedContentStore.get("completion");
		const previous = scrapedContentStore.get("completion-previous");
		if (!latest) {
			set.status = 404;
			return { success: false, message: "No completion available yet" };
		}
		return { success: true, data: { latest, previous } };
	});

export { openrouterRoutes };
