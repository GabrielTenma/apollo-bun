import { ScraperService } from '../../lib/services/scraper.service.ts';
import { ScrapeOptions } from '../interfaces/scraper.interface.ts';
import * as cheerio from 'cheerio';

export interface CoinData {
  rank: string;
  name: string;
  symbol: string;
  price: string;
  change1h: string;
  change24h: string;
  change7d: string;
  marketCap: string;
  volume24h: string;
  circulatingSupply: string;
}

export class CoinmarketCapTarget {
  constructor(public scraperService: ScraperService) {}

  getOptions(): ScrapeOptions {
    return {
      url: 'https://coinmarketcap.com/',
      waitForSelector: 'table.cmc-table tbody tr',
      timeout: 35000,
      pageLocatorPerformAutoScroll: false,
      addStyleHidePopup: true,
      addPageEvaluateLazyScroll: false,
      addPageEvaluate: [() => window.scrollTo(0, document.body.scrollHeight)],
    };
  }

  async scrapeLatestPrice(): Promise<CoinData[]> {
    const result = await this.scraperService.scrape(this.getOptions());
    if (!result.content) throw new Error('Scraping failed: HTML content unavailable');
    return this.parsePriceList(result.content);
  }

  parsePriceList(html: string): CoinData[] {
    const $ = cheerio.load(html);
    const coins: CoinData[] = [];
    $('table.cmc-table tbody tr').each((_, row) => {
      const $row = $(row);
      const cells = $row.find('td');
      if (cells.length < 10) return;

      const rank = $(cells[1]).text().trim();
      const name = $(cells[2]).find('.coin-item-name').text().trim();
      const symbol = $(cells[2]).find('.coin-item-symbol').text().trim();
      const price = $(cells[3]).text().trim();
      const change1h = $(cells[4]).text().trim();
      const change24h = $(cells[5]).text().trim();
      const change7d = $(cells[6]).text().trim();
      const marketCap = $(cells[7]).text().trim();
      const volume24h = $(cells[8]).text().trim();
      const circulatingSupply = $(cells[9]).text().trim();

      if (name) {
        coins.push({ rank, name, symbol, price, change1h, change24h, change7d, marketCap, volume24h, circulatingSupply });
      }
    });
    return coins;
  }
}
