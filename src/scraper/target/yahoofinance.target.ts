import { Injectable } from '@nestjs/common';
import { ScraperService } from '../scraper.service';
import { ScrapeOptions } from '../interfaces/scraper.interface';
import * as cheerio from 'cheerio';

/**
 * Yahoo Finance - Interface for structured data
 */
export interface YahooNewsItem {
  title: string;
  link: string;
  publisher: string;
  timeAgo: string;
  tickers: string[];
}

/**
 * Scrapes Yahoo Finance news stream
 */
@Injectable()
export class YahooFinanceTarget {
  constructor(private readonly scraperService: ScraperService) {}

  getOptions(): ScrapeOptions {
    return {
      url: 'https://finance.yahoo.com/news/',
      waitForSelector:
        'div.news-stream ul.stream-items li.stream-item.story-item',
      timeout: 30000,
      addStyleHidePopup: true,
      pageLocatorPerformAutoScroll: false,
      bypassCSP: true,
      addPageEvaluateLazyScroll: false,
      addPageEvaluate: [() => window.scrollTo(0, document.body.scrollHeight)],
    };
  }

  /**
   * Collect latest Yahoo Finance news
   * until the dynamic news stream appears.
   */
  async scrapeLatestNews(): Promise<YahooNewsItem[]> {
    // Call ScraperService (assume return { url, content: string })
    const result = await this.scraperService.scrape(this.getOptions());

    if (!result.content) {
      throw new Error('Scraping gagal: konten HTML tidak tersedia');
    }

    // Parse HTML with Cheerio
    const news = this.parseNewsItems(result.content);
    return news;
  }

  /**
   * Parse HTML and extract news item from ul.stream-items
   */
  parseNewsItems(html: string): YahooNewsItem[] {
    const $ = cheerio.load(html);
    const items: YahooNewsItem[] = [];

    // Select every news item (ignore ads item)
    $('ul.stream-items li.stream-item.story-item').each((_, element) => {
      const $item = $(element);
      const $section = $item.find('section[data-testid="storyitem"]');
      if ($section.length === 0) return; // not a valid news

      // Title and link
      const $titleLink = $section.find(
        'a.subtle-link.fin-size-small.titles.noUnderline',
      );
      const title = $titleLink.find('h3.clamp').text().trim();
      const link = $titleLink.attr('href') || '';

      // Time and publisher
      const $publishing = $section.find('div.publishing');
      const pubText = $publishing.text().trim(); // example: "Motley Fool • 23h ago"
      const parts = pubText.split('•').map((s) => s.trim());
      const publisher = parts[0] || '';
      const timeAgo = parts[1] || '';

      // Ticker related
      const tickers: string[] = [];
      $section
        .find('div.taxonomy-links span.ticker-wrapper a.ticker')
        .each((_, tickerEl) => {
          const symbol = $(tickerEl).find('span.symbol').text().trim();
          if (symbol) {
            tickers.push(symbol);
          }
        });

      // Ignore empty title
      if (!title) return;

      items.push({
        title,
        link: link.startsWith('http')
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
