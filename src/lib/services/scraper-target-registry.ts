import type { ScrapeOptions } from "../../scraper/interfaces/scraper.interface.ts";

export interface RegisteredTarget {
	name: string;
	storeKey: string;
	getOptions: () => ScrapeOptions;
	parse: (html: string) => unknown;
}

const TARGET_DESCRIPTIONS: Record<string, string> = {
	coinmarketcap: "real-time crypto prices, 24h changes, volume, market cap",
	financialjuice: "US macro/live news",
	yahoofinance: "equity news",
	cnbc: "markets news",
	investing: "latest investing news",
};

export class ScraperTargetRegistry {
	private registry = new Map<string, RegisteredTarget>();
	private enabledNames: string[];

	constructor() {
		const raw = (Bun.env.SCRAPER_TARGETS ?? "coinmarketcap,financialjuice")
			.split(",")
			.map((s) => s.trim().toLowerCase())
			.filter(Boolean);
		this.enabledNames = raw;
	}

	register(
		name: string,
		getOptions: () => ScrapeOptions,
		parse: (html: string) => unknown,
	): void {
		const key = name.toLowerCase();
		this.registry.set(key, { name: key, storeKey: key, getOptions, parse });
	}

	getEnabledTargets(): RegisteredTarget[] {
		return this.enabledNames
			.map((n) => this.registry.get(n))
			.filter((t): t is RegisteredTarget => t !== undefined);
	}

	getEnabledNames(): string[] {
		return this.getEnabledTargets().map((t) => t.name);
	}

	getAllNames(): string[] {
		return Array.from(this.registry.keys());
	}

	getAllTargets(): RegisteredTarget[] {
		return Array.from(this.registry.values());
	}

	isEnabled(name: string): boolean {
		return this.enabledNames.includes(name.toLowerCase());
	}

	getDescription(name: string): string {
		return TARGET_DESCRIPTIONS[name.toLowerCase()] ?? "";
	}
}
