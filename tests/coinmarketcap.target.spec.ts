import { test, expect } from '@playwright/test';
import * as cheerio from 'cheerio';

/**
 * Playwright spec for CoinmarketCapTarget
 * (src/scraper/target/coinmarketcap.target.ts).
 *
 * IMPORTANT: chromium only — run with:
 *   npx playwright test tests/coinmarketcap.target.spec.ts --project=chromium
 */

/**
 * Parser: scrapes a CoinmarketCap HTML page into objects conforming to
 * the CoinmarketCapTarget.CoinData interface
 * (src/scraper/target/coinmarketcap.target.ts:5).
 */
function parsePriceList(html: string): Record<string, unknown>[] {
  const $ = cheerio.load(html);
  const coins: Record<string, unknown>[] = [];

  $('table.cmc-table tbody tr').each((_, row) => {
    const cells = $(row).find('td');
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

/**
 * Page URL.
 */
const URL = 'https://coinmarketcap.com/';
const SELECTOR = 'table.cmc-table tbody tr';
const TIMEOUT = 35000;

/**
 * Setup: navigate to CoinmarketCap before each test.
 */
test.beforeEach(async ({ page }) => {
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.locator(SELECTOR).first({ timeout: TIMEOUT });
});

test('page loads and cmc-table rows are present', async ({ page }) => {
    const rowCount = await page.locator(SELECTOR).count();
    expect(rowCount).toBeGreaterThan(0);
  });

  test('parse coin data with correct shape', async ({ page }) => {
    const html = await page.content();
    const coins = parsePriceList(html);

    expect(coins.length).toBeGreaterThan(0);

    for (const coin of coins) {
      expect(typeof coin.rank).toBe('string');
      expect(typeof coin.name).toBe('string');
      expect(typeof coin.symbol).toBe('string');
      expect(typeof coin.price).toBe('string');
      expect(typeof coin.change1h).toBe('string');
      expect(typeof coin.change24h).toBe('string');
      expect(typeof coin.change7d).toBe('string');
      expect(typeof coin.marketCap).toBe('string');
      expect(typeof coin.volume24h).toBe('string');
      expect(typeof coin.circulatingSupply).toBe('string');
      expect(coin.name.length).toBeGreaterThan(0);
    }
  });

  test('should return at least 10 coins', async ({ page }) => {
    const html = await page.content();
    const coins = parsePriceList(html);
    expect(coins.length).toBeGreaterThanOrEqual(10);
  });

  test('fields match CoinmarketCapTarget.CoinData interface', async ({ page }) => {
    const html = await page.content();
    const coins = parsePriceList(html);
    const firstCoin = coins[0];

    expect(firstCoin).toBeDefined();
    expect(firstCoin).toHaveProperty('rank');
    expect(firstCoin).toHaveProperty('name');
    expect(firstCoin).toHaveProperty('symbol');
    expect(firstCoin).toHaveProperty('price');
    expect(firstCoin).toHaveProperty('change1h');
    expect(firstCoin).toHaveProperty('change24h');
    expect(firstCoin).toHaveProperty('change7d');
    expect(firstCoin).toHaveProperty('marketCap');
    expect(firstCoin).toHaveProperty('volume24h');
    expect(firstCoin).toHaveProperty('circulatingSupply');
  });

  test('each parsed coin has a non-empty name and symbol', async ({ page }) => {
    const html = await page.content();
    const coins = parsePriceList(html);

    for (const coin of coins) {
      expect(coin.name.length).toBeGreaterThan(0);
      expect(coin.symbol.length).toBeGreaterThan(0);
    }
  });
