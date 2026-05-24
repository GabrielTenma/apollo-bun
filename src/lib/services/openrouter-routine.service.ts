import * as crypto from "node:crypto";
import type { Repository } from "typeorm";
import type { ScrapedDataEntity } from "../../supabase/entities/scraped-data.entity.ts";
import type { MemoryKeyStore } from "../memory-key-store.ts";
import type { RoutineService } from "../routine.service.ts";
import type { FinancialAgentService } from "./financial-agent.service.ts";

export class OpenrouterRoutineService {
	private readonly BASE_INTERVAL = 20_000;

	constructor(
		public routineService: RoutineService,
		public financialAgentService: FinancialAgentService,
		public scrapedDataRepository: Repository<ScrapedDataEntity>,
		public constants: { appName: string; scrapedContentStore: MemoryKeyStore },
	) {}

	start() {
		if (!this.routineService.isEnabled()) {
			console.log("Routines are disabled globally, skipping openrouter setup");
			return;
		}

		this.routineService.startRoutine(
			"openrouter-routine",
			async () => {
				console.log("OpenRouter routine executed");
				const scrapedContentStore = this.constants.scrapedContentStore;

				const financialJuice = scrapedContentStore.get("financialjuice");
				const yahooFinance = scrapedContentStore.get("yahoofinance");
				const coinmarketCap = scrapedContentStore.get("coinmarketcap");

				const isStoreHasContents =
					financialJuice !== undefined &&
					yahooFinance !== undefined &&
					coinmarketCap !== undefined;

				if (isStoreHasContents) {
					const chatCompletion = await this.financialAgentService.queryChat({
						financialJuiceContent: JSON.stringify(financialJuice || ""),
						yahooFinanceContent: JSON.stringify(yahooFinance || ""),
						coinmarketCapContent: JSON.stringify(coinmarketCap || ""),
						maxTextLength: 1000,
						ideaWordsLength: 300,
						riskReminder: 3,
						tradeIdeas: "1-5",
						language: "english",
					});
					scrapedContentStore.set("completion", chatCompletion);
					scrapedContentStore.set("completion-previous", chatCompletion);

					const chatCompletionDataEntity = {
						source_id: "ac851202-bc72-43c8-b784-e213b5907159",
						parsed_data: { chatCompletion },
						raw_content: Buffer.from(chatCompletion || "").toString("utf-8"),
						data_hash: crypto
							.createHash("sha256")
							.update(chatCompletion || "")
							.digest("hex")
							.substring(0, 64),
						status: "result",
					};
					const scrapedData = this.scrapedDataRepository.create(
						chatCompletionDataEntity,
					);
					await this.scrapedDataRepository.save(scrapedData);
				} else {
					console.log("Not ready yet! skipped.");
				}
			},
			this.BASE_INTERVAL,
		);
	}

	async runManually(name: string): Promise<void> {
		await this.routineService.executeRoutine(name, async () => {
			console.log("Manual openrouter routine executed");
		});
	}
}
