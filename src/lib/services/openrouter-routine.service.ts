import * as crypto from "node:crypto";
import type { Repository } from "typeorm";
import type { ScrapedDataEntity } from "../../supabase/entities/scraped-data.entity.ts";
import type { MemoryKeyStore } from "../memory-key-store.ts";
import type { RoutineService } from "../routine.service.ts";
import type { FinancialAgentService } from "./financial-agent.service.ts";
import type { ScraperTargetRegistry } from "./scraper-target-registry.ts";

const STORE_KEY_TO_PROMPT_FIELD: Record<string, string> = {
	coinmarketcap: "coinmarketCapContent",
	financialjuice: "financialJuiceContent",
	yahoofinance: "yahooFinanceContent",
	cnbc: "cnbcContent",
};

export class OpenrouterRoutineService {
	private readonly BASE_INTERVAL = 20_000;

	constructor(
		public routineService: RoutineService,
		public financialAgentService: FinancialAgentService,
		public scrapedDataRepository: Repository<ScrapedDataEntity>,
		public constants: { appName: string; scrapedContentStore: MemoryKeyStore },
		public scraperTargetRegistry: ScraperTargetRegistry,
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
				const enabledTargets = this.scraperTargetRegistry.getEnabledTargets();

				if (!enabledTargets.length) {
					console.log(
						"No scraper targets enabled, skipping openrouter routine",
					);
					return;
				}

				const promptConfig: Record<string, string> = {};
				let allReady = true;

				for (const target of enabledTargets) {
					const data = scrapedContentStore.get(target.storeKey);
					if (data === undefined) {
						allReady = false;
						break;
					}
					const field = STORE_KEY_TO_PROMPT_FIELD[target.storeKey];
					if (field) {
						promptConfig[field] = JSON.stringify(data);
					}
				}

				if (!allReady) {
					console.log(
						`Not ready yet! waiting for: ${enabledTargets
							.filter((t) => scrapedContentStore.get(t.storeKey) === undefined)
							.map((t) => t.storeKey)
							.join(", ")}`,
					);
					return;
				}

				const chatCompletion = await this.financialAgentService.queryChat(
					promptConfig as any,
				);
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
