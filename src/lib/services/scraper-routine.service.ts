import * as os from "node:os";
import type { Repository } from "typeorm";
import type { ScrapedDataEntity } from "../../supabase/entities/scraped-data.entity.ts";
import type { MemoryKeyStore } from "../memory-key-store.ts";
import type { RoutineService } from "../routine.service.ts";
import type { ScraperService } from "./scraper.service.ts";
import type { ScraperTargetRegistry } from "./scraper-target-registry.ts";

export class ScraperRoutineService {
	constructor(
		public routineService: RoutineService,
		public scraperTargetRegistry: ScraperTargetRegistry,
		public scraperService: ScraperService,
		public scrapedDataRepository: Repository<ScrapedDataEntity>,
		public constants: { appName: string; scrapedContentStore: MemoryKeyStore },
	) {}

	start() {
		if (!this.routineService.isEnabled()) {
			console.log("Routines are disabled globally, skipping scraper setup");
			return;
		}

		const enabledTargets = this.scraperTargetRegistry.getEnabledTargets();
		if (!enabledTargets.length) {
			console.log("No scraper targets enabled, skipping scraper routine");
			return;
		}

		this.routineService.startRoutine(
			"scraper-routine",
			async () => {
				console.log("Scraper collector routine executed");
				const scrapedContentStore = this.constants.scrapedContentStore;

				const scrapeOptions = enabledTargets.map((t) => t.getOptions());
				const scrapeAllResult = await this.scraperService.scrapeMultiple(
					scrapeOptions,
					Math.max(1, Math.floor(os.cpus().length / 2)),
					true,
					0,
				);

				if (!scrapeAllResult.length) {
					console.warn(
						"Scraper routine: all scrape attempts failed, skipping this run",
					);
					return;
				}

				for (let i = 0; i < enabledTargets.length; i++) {
					const target = enabledTargets[i];
					const html = scrapeAllResult[i]?.content;
					if (html) {
						scrapedContentStore.set(
							target.storeKey,
							target.parse(html),
							120_000,
						);
					}
				}

				console.log(
					`scrape routine done ${scrapeAllResult.length}/${enabledTargets.length}`,
				);
			},
			20000,
		);
	}

	async runManually(name: string): Promise<void> {
		await this.routineService.executeRoutine(name, async () => {
			console.log("Manual scraper routine executed");
		});
	}
}
