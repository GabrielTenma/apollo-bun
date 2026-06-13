import { Elysia } from "elysia";
import { AppDataSource } from "../../lib/db.ts";
import type { MemoryKeyStore } from "../../lib/memory-key-store.ts";
import { ScraperService } from "../../lib/services/scraper.service.ts";
import type { ScraperTargetRegistry } from "../../lib/services/scraper-target-registry.ts";
import { ScrapingSourceEntity } from "../../supabase/entities/scraping-source.entity.ts";

const scraperService = new ScraperService();

export function createScraperRoutes(
	sharedStore: MemoryKeyStore,
	registry: ScraperTargetRegistry,
) {
	const enabledTargets = registry.getEnabledTargets();

	let routes = new Elysia({
		prefix: "/scraper",
		name: "scraperRoutes",
	})

		.post("/scrape", async ({ body }) => {
			const result = await scraperService.scrape((body as any).options ?? {});
			const safe =
				typeof result === "object" && result !== null
					? {
							...result,
							content: (result as any).content?.replace(/\r\n?/g, "\n") ?? "",
						}
					: result;
			return { success: true, data: safe };
		})

		.post("/scrape-multiple", async ({ body }) => {
			const result = await scraperService.scrapeMultiple(
				(body as any).options ?? {},
			);
			return { success: true, data: result };
		})

		.get("/health", () => ({ status: "ok", service: "scraper" }))

		.get("/targets", () => ({
			success: true,
			data: {
				enabled: registry.getEnabledTargets().map((t) => ({
					name: t.name,
					description: registry.getDescription(t.name),
				})),
				available: registry.getAllTargets().map((t) => ({
					name: t.name,
					description: registry.getDescription(t.name),
				})),
			},
		}));

	for (const target of enabledTargets) {
		routes = routes.get(`/${target.name}`, () => ({
			success: true,
			data: sharedStore.get(target.storeKey),
		}));
	}

	routes = routes
		.get("/sources", async () => {
			if (!AppDataSource.isInitialized)
				await AppDataSource.initialize().catch();
			return {
				success: true,
				data: await AppDataSource.getRepository(ScrapingSourceEntity).find(),
			};
		})

		.post("/sources", async ({ body, set }) => {
			if (!AppDataSource.isInitialized)
				await AppDataSource.initialize().catch();
			const repo = AppDataSource.getRepository(ScrapingSourceEntity);
			const saved = await repo.save(repo.create((body as any).data));
			set.status = 201;
			return { success: true, data: saved };
		});

	return routes;
}
