// src/routes/v1/scraper.route.ts
// Scraper routes under /api/v1/scraper/.
// deps:
//  - scraperService      -- ScraperService (plain class, no Elysia dep)
//  - scrapedContentStore -- same MemoryKeyStore as background routines
//  - scrapingSourceRepo  -- TypeORM repository (resolved at handler time)

import { Elysia } from "elysia";
import { AppDataSource } from "../../lib/db.ts";
import { MemoryKeyStore } from "../../lib/memory-key-store.ts";
import { ScraperService } from "../../lib/services/scraper.service.ts";
import { ScrapingSourceEntity } from "../../supabase/entities/scraping-source.entity.ts";

// ── module-scope singletons (created once, shared with background routines via context) ──
const scraperService = new ScraperService();
const scrapedContentStore = new MemoryKeyStore();

const scraperRoutes = new Elysia({
	prefix: "/scraper",
	name: "scraperRoutes",
})

	// POST /api/v1/scraper/scrape  -- { options?: ScrapeOptions }
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

	// POST /api/v1/scraper/scrape-multiple  -- multi-target scrape
	.post("/scrape-multiple", async ({ body }) => {
		const result = await scraperService.scrapeMultiple(
			(body as any).options ?? {},
		);
		return { success: true, data: result };
	})

	// GET /api/v1/scraper/health
	.get("/health", () => ({ status: "ok", service: "scraper" }))

	// Read from the same MemoryKeyStore the background routines write into.
	.get("/financialjuice", () => ({
		success: true,
		data: scrapedContentStore.get("financialjuice"),
	}))
	.get("/yahoofinance", () => ({
		success: true,
		data: scrapedContentStore.get("yahoofinance"),
	}))
	.get("/coinmarketcap", () => ({
		success: true,
		data: scrapedContentStore.get("coinmarketcap"),
	}))

	// GET  /api/v1/scraper/sources   -- list all scraping sources via TypeORM
	.get("/sources", async () => {
		if (!AppDataSource.isInitialized) await AppDataSource.initialize().catch();
		return {
			success: true,
			data: await AppDataSource.getRepository(ScrapingSourceEntity).find(),
		};
	})

	// POST /api/v1/scraper/sources   -- create a new scraping source via TypeORM
	.post("/sources", async ({ body, set }) => {
		if (!AppDataSource.isInitialized) await AppDataSource.initialize().catch();
		const repo = AppDataSource.getRepository(ScrapingSourceEntity);
		const saved = await repo.save(repo.create((body as any).data));
		set.status = 201;
		return { success: true, data: saved };
	});

export { scraperRoutes };
