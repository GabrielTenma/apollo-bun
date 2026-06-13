import * as cheerio from "cheerio";
import type { ScraperService } from "../../lib/services/scraper.service.ts";
import type { ScrapeOptions } from "../interfaces/scraper.interface.ts";

export interface CnbcNewsItem {
	title: string;
	link: string;
	time: string;
	category: string;
}

export class CnbcTarget {
	constructor(public scraperService: ScraperService) {}

	getOptions(): ScrapeOptions {
		return {
			url: "https://www.cnbc.com/markets/",
			waitForSelector: "a.Card-title",
			timeout: 35000,
			addStyleHidePopup: true,
			pageLocatorPerformAutoScroll: false,
			addPageEvaluateLazyScroll: false,
		};
	}

	async scrapeLatestNews(): Promise<CnbcNewsItem[]> {
		const result = await this.scraperService.scrape(this.getOptions());
		if (!result.content)
			throw new Error("Scraping failed: HTML content unavailable");
		return this.parseNewsItems(result.content);
	}

	parseNewsItems(html: string): CnbcNewsItem[] {
		const $ = cheerio.load(html);
		const items: CnbcNewsItem[] = [];

		$("a.Card-title").each((_, element) => {
			const $link = $(element);
			const title = $link.text().trim();
			const href = $link.attr("href") || "";
			if (!title || !href) return;

			const $card = $link.closest("[class*=Card]");
			const time = $card.find(".Card-time").first().text().trim();
			const category = $card.find(".Card-eyebrow").first().text().trim();

			const link = href.startsWith("http")
				? href
				: `https://www.cnbc.com${href}`;

			items.push({ title, link, time, category });
		});

		return items;
	}
}
