import { ScraperService } from '../../lib/services/scraper.service.ts';
import { ScrapeOptions } from '../interfaces/scraper.interface.ts';
import * as cheerio from 'cheerio';

export interface NewsItem {
  id: string;
  title: string;
  link: string;
  time: string;
  tags: string[];
}

export class FinancialJuiceTarget {
  constructor(public scraperService: ScraperService) {}

  getOptions(): ScrapeOptions {
    return {
      url: 'https://live.financialjuice.com/home',
      waitForSelector: '#mainFeed',
      timeout: 35000,
      pageLocatorPerformClickCoordinate: { x: 24, y: 19, isLoop: false },
      addStyleHidePopup: true,
      addPageEvaluateLazyScroll: false,
      addPageEvaluate: [() => window.scrollTo(0, document.body.scrollHeight)],
    };
  }

  async scrapeLatestNews(): Promise<NewsItem[]> {
    const result = await this.scraperService.scrape(this.getOptions());
    if (!result.content) throw new Error('Scraping failed: HTML content unavailable');
    return this.parseNewsItems(result.content);
  }

  parseNewsItems(html: string): NewsItem[] {
    const $ = cheerio.load(html);
    const items: NewsItem[] = [];
    $('#mainFeed .infinite-item.headline-item').each((_, element) => {
      const $item = $(element);
      const anchor = $item.find('p.headline-title a');
      let title: string;
      let link: string;

      if (anchor.length > 0) {
        title = anchor.text().trim();
        const href = anchor.attr('href') || '';
        link = href.startsWith('http') ? href : `https://www.financialjuice.com${href}`;
      } else {
        const span = $item.find('span.headline-title-nolink');
        title = span.text().trim();
        link = '';
      }

      if (!title) return;
      const time = $item.find('p.time').text().trim();
      const tags: string[] = [];
      $item.find('span.news-label').each((_, tagEl) => {
        const tagText = $(tagEl).text().trim();
        if (tagText) tags.push(tagText);
      });
      const id = $item.attr('data-headlineid') || '';
      if (id === '0') return;
      items.push({ id, title, link, time, tags });
    });
    return items;
  }
}
