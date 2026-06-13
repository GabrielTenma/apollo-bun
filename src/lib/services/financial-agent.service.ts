import type { PromptConfig } from "../../openrouter/interfaces/financialagent.interface.ts";
import type { OpenRouterService } from "./openrouter.service.ts";

export class FinancialAgentService {
	constructor(public openRouterService: OpenRouterService) {}

	async queryChat(promptConfig: PromptConfig): Promise<string> {
		const response = await Promise.race([
			this.openRouterService.chat(
				this.getPrompt(promptConfig),
				"openrouter/free",
				"You are a helpful financial consultant assistant.",
			),
			new Promise<string>((_, reject) =>
				setTimeout(
					() => reject(new Error("OpenRouter request timed out after 300 s")),
					300_000,
				),
			),
		]);
		console.log("Response:", response.length);
		return response;
	}

	getPrompt(promptConfig: PromptConfig): string {
		const textLength = promptConfig.maxTextLength || 500;
		const ideaWords = promptConfig.ideaWordsLength || 100;
		const riskReminder = promptConfig.riskReminder || 5;
		const tradeIdeas = promptConfig.tradeIdeas || "1-5";
		const language = promptConfig.language || "native english";

		const sourceEntries: Array<{
			key: keyof PromptConfig;
			name: string;
			desc: string;
		}> = [
			{
				key: "financialJuiceContent",
				name: "FinancialJuice",
				desc: "US macro/live news",
			},
			{
				key: "yahooFinanceContent",
				name: "Yahoo Finance",
				desc: "equity news",
			},
			{
				key: "coinmarketCapContent",
				name: "CoinMarketCap",
				desc: "real-time crypto prices, 24h changes, volume, market cap",
			},
			{ key: "cnbcContent", name: "CNBC", desc: "markets news" },
		];

		const available = sourceEntries.filter((s) => promptConfig[s.key]);

		const sourceList = available
			.map((s) => `${s.name} (${s.desc}) "${promptConfig[s.key]}"`)
			.join(", ");

		const sourceNames = available.map((s) => s.name);
		const hasCrypto = sourceNames.includes("CoinMarketCap");

		const sections: string[] = [];

		sections.push(`You are an elite financial analyst. You will be given ${available.length} separate JSON data source${available.length > 1 ? "s" : ""}: ${sourceList}.
Synthesize the incoming data and output ONLY markdown. The entire response must be plain text under ${textLength} words.`);

		if (sourceNames.length > 0) {
			sections.push(`## Overall Market Stance
State the short-term directional bias for US equities (e.g., cautiously bearish/defensive, favoring specific sectors)${hasCrypto ? " and for crypto (e.g., neutral with a bullish BTC tilt, selective alt momentum)" : ""}. Attribute the stance to the single biggest macro or news driver from the provided data.`);
		}

		if (sourceNames.length > 0) {
			sections.push(`## High-Conviction Tactical Ideas
Name exactly ${tradeIdeas} trade ideas${hasCrypto ? " (stock ticker or crypto symbol)" : ""} with entry, target, and stop logic, presented in a markdown table with columns: Ticker, Entry, Target, Stop, Thesis. Keep each thesis under ${ideaWords} words.`);
		}

		sections.push(`## Risk & Percentage Impact
Based solely on the provided data (never using internal knowledge), estimate:${hasCrypto ? " for the US stock market, potential upside percentage and downside percentage with the ticker(s) most impacted; for crypto, potential upside percentage and downside percentage with the crypto ticker(s) most impacted." : " the potential upside percentage and downside percentage with the ticker(s) most impacted."} Compare the news sentiment with the latest price action data to justify the estimates. Present figures in a markdown table with columns: Asset Class, Ticker, Upside %, Downside %. End with a ${riskReminder}-word risk reminder.`);

		const hasFjYf =
			sourceNames.includes("FinancialJuice") ||
			sourceNames.includes("Yahoo Finance");

		if (hasFjYf) {
			sections.push(` ## USD IDR Currency Impact
Based solely on the provided FinancialJuice and Yahoo Finance data, analyze USD IDR currency impact or potentially impact and state whether it is good news or bad news for the IDR currency. Never use internal knowledge.`);
			sections.push(`## XAU (Gold) Impact
Based solely on the provided FinancialJuice and Yahoo Finance data, analyze the impact on XAU (Gold) or potentially impact and state whether the current data is bullish or bearish for gold. Never use internal knowledge.`);
		}

		sections.push(
			`Use assertive, ${language} appropriate for a hedge fund morning note.`,
		);

		return sections.join("\n");
	}
}
