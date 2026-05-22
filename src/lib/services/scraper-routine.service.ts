import * as os from "node:os";
import type { Repository } from "typeorm";
import type { CoinmarketCapTarget } from "../../scraper/target/coinmarketcap.target.ts";
import type { FinancialJuiceTarget } from "../../scraper/target/financialjuice.target.ts";
import type { YahooFinanceTarget } from "../../scraper/target/yahoofinance.target.ts";
import type { ScrapedDataEntity } from "../../supabase/entities/scraped-data.entity.ts";
import type { MemoryKeyStore } from "../memory-key-store.ts";
import type { RoutineService } from "../routine.service.ts";
import type { ScraperService } from "./scraper.service.ts";

export class ScraperRoutineService {
	constructor(
		public routineService: RoutineService,
		public coinMarketCapTarget: CoinmarketCapTarget,
		public yahooFinanceTarget: YahooFinanceTarget,
		public financialJuiceTarget: FinancialJuiceTarget,
		public scraperService: ScraperService,
		public scrapedDataRepository: Repository<ScrapedDataEntity>,
		public constants: { appName: string; scrapedContentStore: MemoryKeyStore },
	) {}

	start() {
		if (!this.routineService.isEnabled()) {
			console.log("Routines are disabled globally, skipping scraper setup");
			return;
		}

		this.routineService.startRoutine(
			"scraper-routine",
			async () => {
				console.log("Scraper collector routine executed");
				const scrapedContentStore = this.constants.scrapedContentStore;

				const scrapeOptions = [
					this.coinMarketCapTarget.getOptions(),
					this.yahooFinanceTarget.getOptions(),
					this.financialJuiceTarget.getOptions(),
				];
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
				scrapedContentStore.set(
					"coinmarketcap",
					this.coinMarketCapTarget.parsePriceList(
						scrapeAllResult[0].content || "",
					),
					120_000, // 2-min TTL so stale data is evicted if the routine stops
				);
				scrapedContentStore.set(
					"yahoofinance",
					this.yahooFinanceTarget.parseNewsItems(
						scrapeAllResult[1].content || "",
					),
					120_000,
				);
				scrapedContentStore.set(
					"financialjuice",
					this.financialJuiceTarget.parseNewsItems(
						scrapeAllResult[2].content || "",
					),
					120_000,
				);

				console.log(`scrape routine done ${scrapeAllResult.length}`);
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
