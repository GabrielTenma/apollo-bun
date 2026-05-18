import { chromium, Browser, Page, BrowserContext } from 'playwright';
import { env } from '../config/env.ts';
import {
  ScrapeOptions,
  ScrapeResult,
  ExtractConfig,
  ElementSelector,
} from './scraper.interface.ts';
import * as os from 'node:os';

export class ScraperService {
  browser: Browser | null = null;

  async getBrowser(headless = true): Promise<Browser> {
    if (!this.browser) {
      this.browser = await chromium.launch({
        headless,
        args: [
          '--disable-gpu',
          '--disable-dev-shm-usage',
          '--disable-extensions',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
          '--no-sandbox',
          '--disable-setuid-sandbox',
        ],
      });
    }
    return this.browser;
  }

  private async createContext(
    browser: Browser,
    options: ScrapeOptions,
  ): Promise<BrowserContext> {
    const context = await browser.newContext({
      userAgent:
        options.userAgent ||
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
      extraHTTPHeaders: options.headers,
      bypassCSP: options.bypassCSP || false,
      viewport: { width: 1920, height: 1080 },
    });
    if (options.cookies && options.cookies.length > 0) {
      await context.addCookies(options.cookies);
    }
    return context;
  }

  async scrape(options: ScrapeOptions): Promise<ScrapeResult> {
    const startTime = Date.now();
    const browser = await this.getBrowser();
    const context = await this.createContext(browser, options);
    const page = await context.newPage();

    try {
      if (options.handlePopupClose) {
        await page.addLocatorHandler(
          page.getByRole('button', { name: 'Close' }),
          async () => {
            await page.getByRole('button', { name: 'Close' }).click();
          },
        );
      }
      await page.goto(options.url, {
        waitUntil: 'domcontentloaded',
        timeout: options.timeout || 30000,
      });

      if (options.addStyleHidePopup) {
        await page.addStyleTag({
          content:
            options.addStyleHidePopup === true
              ? '#popup-id { display: none !important; }'
              : (options.addStyleHidePopup as string),
        });
      }

      if (options.pageLocatorPerformClick) {
        await page.locator(options.pageLocatorPerformClick).click();
      }

      if (options.pageLocatorPerformClickCoordinate) {
        let toggle = true;
        do {
          await page.waitForTimeout(3000);
          await page.mouse.click(
            options.pageLocatorPerformClickCoordinate.x,
            options.pageLocatorPerformClickCoordinate.y,
            { button: 'left', clickCount: 1, delay: 0 },
          );
          if (!options.pageLocatorPerformClickCoordinate.isLoop) toggle = false;
        } while (toggle);
      }

      if (options.addPageEvaluate) {
        for (const fn of options.addPageEvaluate) {
          await page.evaluate(fn);
        }
      }

      if (options.pageLocatorPerformAutoScroll) {
        await page.evaluate(async () => {
          await new Promise<void>((resolve) => {
            let totalHeight = 0;
            const distance = 100;
            const timer = setInterval(() => {
              const scrollHeight = document.body.scrollHeight;
              totalHeight += distance;
              if (totalHeight >= scrollHeight) {
                clearInterval(timer);
                resolve();
              }
            }, 100);
          });
        });
      }

      if (options.addPageEvaluateLazyScroll) {
        let previousHeight;
        while (true) {
          previousHeight = await page.evaluate('document.body.scrollHeight');
          await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
          await page.waitForTimeout(2000);
          const currentHeight = await page.evaluate('document.body.scrollHeight');
          if (currentHeight === previousHeight) break;
        }
      }

      if (options.waitForSelector) {
        await page.locator(options.waitForSelector);
      }

      const title = await page.title();
      const content = await page.content();

      const result: ScrapeResult = {
        url: options.url,
        title,
        content,
        data: {},
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
      };

      if (options.screenshot) {
        const screenshotPath =
          options.screenshotPath || `screenshot-${Date.now()}.png`;
        await page.screenshot({ path: screenshotPath, fullPage: true });
        result.screenshot = screenshotPath;
      }

      await context.close();
      return result;
    } catch (error) {
      await context.close();
      throw error;
    }
  }

  async extractStructuredData(
    page: Page,
    config: ExtractConfig,
  ): Promise<Record<string, unknown>> {
    const data: Record<string, unknown> = {};
    if (config.title) data.title = await page.textContent(config.title);
    if (config.description) data.description = await page.textContent(config.description);
    if (config.image) data.image = await page.getAttribute(config.image, 'src');
    if (config.links) {
      const links = await page.$$eval(
        config.links.selector,
        (elements, attr) =>
          elements.map((el) => el.getAttribute(attr || 'href')),
        config.links.attribute || 'href',
      );
      data.links = links.filter((link): link is string => link !== null);
    }
    if (config.custom) {
      for (const [key, selector] of Object.entries(config.custom)) {
        data[key] = await this.extractElementData(page, selector);
      }
    }
    return data;
  }

  private async extractElementData(
    page: Page,
    selector: ElementSelector,
  ): Promise<unknown> {
    if (selector.multiple) {
      const elements = await page.$$(selector.selector);
      const results: unknown[] = [];
      for (const element of elements) {
        if (selector.attribute) {
          const attr = await element.getAttribute(selector.attribute);
          if (attr !== null) results.push(attr);
        } else {
          const text = await element.textContent();
          if (text !== null) results.push(text.trim());
        }
      }
      return results;
    } else {
      const element = await page.$(selector.selector);
      if (!element) return null;
      if (selector.attribute) return await element.getAttribute(selector.attribute);
      const text = await element.textContent();
      return text?.trim() || null;
    }
  }

  async scrapeMultiple(
    options: ScrapeOptions[],
    concurrency = Math.max(1, Math.floor(os.cpus().length / 2)),
    continueOnError = true,
    maxRetries = 0,
    throttleDelayMs = 0,
  ): Promise<ScrapeResult[]> {
    const results: ScrapeResult[] = [];
    let nextIndex = 0;

    const worker = async () => {
      while (true) {
        const currentIdx = nextIndex++;
        if (currentIdx >= options.length) break;
        const scrapeOptions = options[currentIdx];

        if (!scrapeOptions.url) continue;
        let lastError: Error | null = null;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
          try {
            const result = await this.scrape(scrapeOptions);
            results.push(result);
            break;
          } catch (error) {
            lastError = error as Error;
            if (attempt < maxRetries) {
              await new Promise((r) =>
                setTimeout(r, 1000 * Math.pow(2, attempt)),
              );
            }
          }
        }

        if (!continueOnError && lastError) throw lastError;
        if (lastError) {
          console.error(
            `Failed to scrape ${scrapeOptions.url} after ${
              maxRetries + 1
            } attempts:`,
            lastError,
          );
        }
        if (throttleDelayMs > 0) {
          await new Promise((r) => setTimeout(r, throttleDelayMs));
        }
      }
    };

    const workers = Array.from(
      { length: Math.min(concurrency, options.length) },
      () => worker(),
    );
    await Promise.all(workers);
    return results;
  }

  async closeBrowser(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}
