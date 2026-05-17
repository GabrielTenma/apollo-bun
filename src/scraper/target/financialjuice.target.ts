import { Injectable } from '@nestjs/common';
import { ScraperService } from '../scraper.service';
import { ScrapeOptions } from '../interfaces/scraper.interface';
import * as cheerio from 'cheerio';

/**
 * FinancialJuice - Interface for structured data NewsItem
 */
export interface NewsItem {
  id: string;
  title: string;
  link: string;
  time: string;
  tags: string[];
}

/**
 * Scrapes financialjuice web latest news
 */
@Injectable()
export class FinancialJuiceTarget {
  constructor(private readonly scraperService: ScraperService) {}

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

  /**
   * Collect FinancialJuice latest news
   * until dynamic element #mainFeed shows.
   */
  async scrapeLatestNews(): Promise<NewsItem[]> {
    // Call ScraperService (return assume { url, content: string })
    const result = await this.scraperService.scrape(this.getOptions());

    if (!result.content) {
      throw new Error('Scraping gagal: konten HTML tidak tersedia');
    }

    // Parse HTML with Cheerio
    const news = this.parseNewsItems(result.content);
    return news;
  }

  /**
   * Parse HTML and extract item news dari #mainFeed
   */
  parseNewsItems(html: string): NewsItem[] {
    const $ = cheerio.load(html);
    const items: NewsItem[] = [];

    $('#mainFeed .infinite-item.headline-item').each((_, element) => {
      const $item = $(element);

      // Lewati item tanpa judul (biasanya iklan / placeholder)
      const anchor = $item.find('p.headline-title a');
      let title: string;
      let link: string;

      if (anchor.length > 0) {
        title = anchor.text().trim();
        const href = anchor.attr('href') || '';
        link = href.startsWith('http')
          ? href
          : `https://www.financialjuice.com${href}`;
      } else {
        const span = $item.find('span.headline-title-nolink');
        title = span.text().trim();
        link = '';
      }

      if (!title) return; // ignore non-news content

      const time = $item.find('p.time').text().trim();

      const tags: string[] = [];
      $item.find('span.news-label').each((_, tagEl) => {
        const tagText = $(tagEl).text().trim();
        if (tagText) tags.push(tagText);
      });

      const id = $item.attr('data-headlineid') || '';

      if (id == '0') return; // ignore promotial content

      items.push({ id, title, link, time, tags });
    });

    return items;
  }
}
