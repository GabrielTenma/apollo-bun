import { Injectable } from '@nestjs/common';
import { ScraperService } from '../scraper.service';
import { ScrapeOptions } from '../interfaces/scraper.interface';
import * as cheerio from 'cheerio';

/**
 * CoinmarketCap - Interface for structured data CoinData
 */
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

/**
 * Scrapes coinmarketcap web latest price update
 */
@Injectable()
export class CoinmarketCapTarget {
  constructor(private readonly scraperService: ScraperService) {}

  // Options configuration
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

  /**
   * Collect CoinmarketCap latest price
   * until dynamic element cmc-table shows.
   */
  async scrapeLatestPrice(): Promise<CoinData[]> {
    // Call ScraperService (return assume { url, content: string })
    const result = await this.scraperService.scrape(this.getOptions());

    if (!result.content) {
      throw new Error('Scraping gagal: konten HTML tidak tersedia');
    }

    // Parse HTML with Cheerio
    const priceList = this.parsePriceList(result.content);
    return priceList;
  }

  parsePriceList(html: string): CoinData[] {
    const $ = cheerio.load(html);
    const coins: CoinData[] = [];

    $('table.cmc-table tbody tr').each((_, row) => {
      const $row = $(row);
      const cells = $row.find('td');

      // Pastikan baris cukup panjang (hindari baris kosong / iklan)
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
        // Hanya tambahkan jika ada nama (menyaring baris iklan)
        coins.push({
          rank,
          name,
          symbol,
          price,
          change1h,
          change24h,
          change7d,
          marketCap,
          volume24h,
          circulatingSupply,
        });
      }
    });

    return coins;
  }
}
