import * as cheerio from "cheerio";
import type { ScraperService } from "../../lib/services/scraper.service.ts";
import type { ScrapeOptions } from "../interfaces/scraper.interface.ts";

export interface InvestingNewsItem {
	title: string;
	link: string;
	date: string;
}

export class InvestingTarget {
	constructor(public scraperService: ScraperService) {}

	getOptions(): ScrapeOptions {
		return {
			url: "https://www.investing.com/news/latest-news",
			waitForSelector: "[class*=Article_article__]",
			timeout: 35000,
			addStyleHidePopup: true,
			addPageEvaluateLazyScroll: false,
		};
	}

	async scrapeLatestNews(): Promise<InvestingNewsItem[]> {
		const result = await this.scraperService.scrape(this.getOptions());
		if (!result.content)
			throw new Error("Scraping failed: HTML content unavailable");
		return this.parseNewsItems(result.content);
	}

	parseNewsItems(html: string): InvestingNewsItem[] {
		const $ = cheerio.load(html);
		const items: InvestingNewsItem[] = [];

		$("[class*=Article_article__]").each((_, element) => {
			const $article = $(element);
			const $titleEl = $article.find("[class*=Article_title__] a");
			const title = $titleEl.text().trim();
			const link = $titleEl.attr("href") || "";

			let date = "";
			$article.find("[class*=Article_item__]").each((_, el) => {
				const text = $(el).text().trim();
				if (/[A-Z][a-z]{2}\s\d{1,2},\s\d{4}/.test(text)) {
					date = text;
				}
			});

			if (!title || !link) return;
			items.push({ title, link, date });
		});

		return items;
	}
}
