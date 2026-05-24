import * as cheerio from "cheerio";
import type { ScraperService } from "../../lib/services/scraper.service.ts";
import type { ScrapeOptions } from "../interfaces/scraper.interface.ts";

export interface YahooNewsItem {
	title: string;
	link: string;
	publisher: string;
	timeAgo: string;
	tickers: string[];
}

export class YahooFinanceTarget {
	constructor(public scraperService: ScraperService) {}

	getOptions(): ScrapeOptions {
		return {
			url: "https://finance.yahoo.com/news/",
			waitForSelector:
				"div.news-stream ul.stream-items li.stream-item.story-item",
			timeout: 30000,
			addStyleHidePopup: true,
			pageLocatorPerformAutoScroll: false,
			bypassCSP: true,
			addPageEvaluateLazyScroll: false,
			addPageEvaluate: [() => window.scrollTo(0, document.body.scrollHeight)],
		};
	}

	async scrapeLatestNews(): Promise<YahooNewsItem[]> {
		const result = await this.scraperService.scrape(this.getOptions());
		if (!result.content)
			throw new Error("Scraping failed: HTML content unavailable");
		return this.parseNewsItems(result.content);
	}

	parseNewsItems(html: string): YahooNewsItem[] {
		const $ = cheerio.load(html);
		const items: YahooNewsItem[] = [];
		$("ul.stream-items li.stream-item.story-item").each((_, element) => {
			const $item = $(element);
			const $section = $item.find('section[data-testid="storyitem"]');
			if ($section.length === 0) return;

			const $titleLink = $section.find(
				"a.subtle-link.fin-size-small.titles.noUnderline",
			);
			const title = $titleLink.find("h3.clamp").text().trim();
			const link = $titleLink.attr("href") || "";

			const $publishing = $section.find("div.publishing");
			const pubText = $publishing.text().trim();
			const parts = pubText.split("•").map((s) => s.trim());
			const publisher = parts[0] || "";
			const timeAgo = parts[1] || "";

			const tickers: string[] = [];
			$section
				.find("div.taxonomy-links span.ticker-wrapper a.ticker")
				.each((_, tickerEl) => {
					const symbol = $(tickerEl).find("span.symbol").text().trim();
					if (symbol) tickers.push(symbol);
				});

			if (!title) return;
			items.push({
				title,
				link: link.startsWith("http")
					? link
					: `https://finance.yahoo.com${link}`,
				publisher,
				timeAgo,
				tickers,
			});
		});
		return items;
	}
}
