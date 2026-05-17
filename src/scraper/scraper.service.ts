import { Injectable, Logger } from '@nestjs/common';
import { chromium, Browser, Page, BrowserContext } from 'playwright';
import {
  ScrapeOptions,
  ScrapeResult,
  ExtractConfig,
  ElementSelector,
} from './interfaces/scraper.interface';
import * as os from 'node:os';

/**
 * Advanced Playwright scraper service for web scraping operations.
 * Provides methods for single page scraping, multiple page scraping,
 * structured data extraction, and more.
 */
@Injectable()
export class ScraperService {
  private readonly logger = new Logger(ScraperService.name);
  private browser: Browser | null = null;

  /**
   * Initializes and returns a Playwright browser instance.
   *
   * Additional Chromium launch arguments are used to minimise CPU and memory
   * consumption. These flags disable GPU usage, background timers, extensions,
   * and sandboxing (the latter is safe in most CI environments and when the
   * host is trusted). Adjust the flags as needed for your deployment.
   *
   * @param headless - Whether to run in headless mode (default: true)
   * @returns Browser instance
   */
  private async getBrowser(headless = true): Promise<Browser> {
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

  /**
   * Creates a new browser context with optional configurations
   * @param browser - Browser instance
   * @param options - Scrape options for context configuration
   * @returns Browser context
   */
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

    // Set cookies if provided
    if (options.cookies && options.cookies.length > 0) {
      await context.addCookies(options.cookies);
    }

    return context;
  }

  /**
   * Scrapes a single webpage with advanced options
   * @param options - Scrape configuration options
   * @returns Scrape result with extracted data
   */
  async scrape(options: ScrapeOptions): Promise<ScrapeResult> {
    const startTime = Date.now();
    const browser = await this.getBrowser();
    const context = await this.createContext(browser, options);
    const page = await context.newPage();

    try {
      this.logger.log(`Scraping: ${options.url}`);

      // Perform default popup close
      if (options.handlePopupClose) {
        await page.addLocatorHandler(
          page.getByRole('button', { name: 'Close' }), // Locator popup
          async () => {
            await page.getByRole('button', { name: 'Close' }).click();
          },
        );
      }

      // Navigate to the page
      await page.goto(options.url, {
        waitUntil: 'domcontentloaded',
        timeout: options.timeout || 30000,
      });

      // Add style hide popup
      if (options.addStyleHidePopup) {
        await page.addStyleTag({
          content:
            options.addStyleHidePopup === true
              ? '#popup-id { display: none !important; }'
              : (options.addStyleHidePopup as string),
        });
      }

      // Perform click
      if (options.pageLocatorPerformClick) {
        await page.locator(options.pageLocatorPerformClick).click();
      }

      // Perform click by coordinate
      if (options.pageLocatorPerformClickCoordinate) {
        let toggle = true;
        do {
          await page.waitForTimeout(3000);
          await page.mouse.click(
            options.pageLocatorPerformClickCoordinate.x,
            options.pageLocatorPerformClickCoordinate.y,
            { button: 'left', clickCount: 1, delay: 0 },
          );
          if (!options.pageLocatorPerformClickCoordinate.isLoop) {
            toggle = false;
          }
        } while (toggle);
      }

      // Custom page evaluate
      if (options.addPageEvaluate) {
        for (const fn of options.addPageEvaluate) {
          await page.evaluate(fn);
        }
      }

      // Perform auto scroll
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

      // Perform auto scroll - lazy load page type
      if (options.addPageEvaluateLazyScroll) {
        let previousHeight;
        while (true) {
          previousHeight = await page.evaluate('document.body.scrollHeight');
          await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
          // Wait for new content to load
          await page.waitForTimeout(2000);
          const currentHeight = await page.evaluate(
            'document.body.scrollHeight',
          );
          if (currentHeight === previousHeight) break; // Stop if height didn't change
        }
      }

      // Wait for specific selector if provided
      if (options.waitForSelector) {
        await page.locator(options.waitForSelector);
      }

      // Extract basic page information
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

      // Take screenshot if requested
      if (options.screenshot) {
        const screenshotPath =
          options.screenshotPath || `screenshot-${Date.now()}.png`;
        await page.screenshot({ path: screenshotPath, fullPage: true });
        result.screenshot = screenshotPath;
      }

      await context.close();
      this.logger.log(`Successfully scraped: ${options.url}`);

      return result;
    } catch (error) {
      await context.close();
      this.logger.error(`Failed to scrape: ${options.url}`, error);
      throw error;
    }
  }

  /**
   * Extracts structured data from a page based on configuration
   * @param page - Playwright Page object
   * @param config - Extraction configuration
   * @returns Extracted structured data
   */
  async extractStructuredData(
    page: Page,
    config: ExtractConfig,
  ): Promise<Record<string, unknown>> {
    const data: Record<string, unknown> = {};

    // Extract title
    if (config.title) {
      data.title = await page.textContent(config.title);
    }

    // Extract description
    if (config.description) {
      data.description = await page.textContent(config.description);
    }

    // Extract image
    if (config.image) {
      data.image = await page.getAttribute(config.image, 'src');
    }

    // Extract links
    if (config.links) {
      const links = await page.$$eval(
        config.links.selector,
        (elements, attr) =>
          elements.map((el) => el.getAttribute(attr || 'href')),
        config.links.attribute || 'href',
      );
      data.links = links.filter((link): link is string => link !== null);
    }

    // Extract custom data
    if (config.custom) {
      for (const [key, selector] of Object.entries(config.custom)) {
        data[key] = await this.extractElementData(page, selector);
      }
    }

    return data;
  }

  /**
   * Extracts data from a single element based on selector configuration
   * @param page - Playwright Page object
   * @param selector - Element selector configuration
   * @returns Extracted element data
   */
  private async extractElementData(
    page: Page,
    selector: ElementSelector,
  ): Promise<unknown> {
    if (selector.multiple) {
      // Extract multiple elements
      const elements = await page.$$(selector.selector);
      const results: unknown[] = [];

      for (const element of elements) {
        if (selector.attribute) {
          const attr = await element.getAttribute(selector.attribute);
          if (attr !== null) results.push(attr);
        } else if (selector.textContent) {
          const text = await element.textContent();
          if (text !== null) results.push(text.trim());
        } else {
          const text = await element.textContent();
          if (text !== null) results.push(text.trim());
        }
      }

      return results;
    } else {
      // Extract single element
      const element = await page.$(selector.selector);
      if (!element) return null;

      if (selector.attribute) {
        return await element.getAttribute(selector.attribute);
      } else if (selector.textContent) {
        const text = await element.textContent();
        return text?.trim() || null;
      } else {
        const text = await element.textContent();
        return text?.trim() || null;
      }
    }
  }

  /**
   * Scrapes multiple pages concurrently with advanced options
   * @param options - Array of ScrapeOptions objects, each with potentially different configurations
   * @param concurrency - Number of concurrent scrapes (default: 3)
   * @param continueOnError - Whether to continue scraping other URLs on error (default: true)
   * @param maxRetries - Maximum number of retries per URL on failure (default: 0)
   * @returns Array of scrape results
   *
   * @example
   * // Each option can have completely different configurations
   * const results = await scraperService.scrapeMultiple([
   *   {
   *     url: 'https://example1.com',
   *     waitForSelector: '.content',
   *     screenshot: true,
   *     pageLocatorPerformClick: '#load-more'
   *   },
   *   {
   *     url: 'https://example2.com',
   *     handlePopupClose: true,
   *     timeout: 60000,
   *     addStyleHidePopup: '#modal { display: none; }'
   *   },
   *   {
   *     url: 'https://example3.com',
   *     pageLocatorPerformAutoScroll: true,
   *     waitForSelector: '.items',
   *     screenshot: true,
   *     screenshotPath: 'custom-name.png'
   *   }
   * ], 2, true, 3);
   */
  /**
   * Scrapes multiple pages concurrently with advanced options.
   *
   * The implementation now uses a lightweight semaphore to limit the number of
   * concurrent scrapes based on the `concurrency` argument. By default the
   * concurrency is set to half of the available CPU cores, which provides a
   * good balance between throughput and CPU usage. The previous macOS‑specific
   * throttling logic has been removed in favour of an optional `throttleDelayMs`
   * parameter that can be used to introduce a configurable pause between each
   * scrape when needed.
   *
   * @param options - Array of {@link ScrapeOptions} objects, each with potentially different configurations.
   * @param concurrency - Maximum number of scrapes to run in parallel. Defaults to half of the CPU cores.
   * @param continueOnError - Whether to continue scraping other URLs on error (default: true).
   * @param maxRetries - Maximum number of retries per URL on failure (default: 0).
   * @param throttleDelayMs - Optional delay (in milliseconds) to wait after each individual scrape. Useful for rate‑limiting without the heavy macOS‑only pause.
   * @returns Array of {@link ScrapeResult} objects.
   */
  async scrapeMultiple(
    options: ScrapeOptions[],
    concurrency = Math.max(1, Math.floor(os.cpus().length / 2)),
    continueOnError = true,
    maxRetries = 0,
    throttleDelayMs = 0,
  ): Promise<ScrapeResult[]> {
    const results: ScrapeResult[] = [];
    // Index shared among workers to fetch the next job
    let nextIndex = 0;

    // Worker function that processes options sequentially while respecting the concurrency limit
    const worker = async () => {
      while (true) {
        const currentIdx = nextIndex++;
        if (currentIdx >= options.length) {
          break;
        }
        const scrapeOptions = options[currentIdx];

        // Validate URL presence
        if (!scrapeOptions.url) {
          this.logger.error('URL is required for each scrape option');
          continue;
        }

        let lastError: Error | null = null;
        // Retry logic with exponential backoff
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
          try {
            const result = await this.scrape(scrapeOptions);
            results.push(result);
            break; // success, exit retry loop
          } catch (error) {
            lastError = error as Error;
            if (attempt < maxRetries) {
              this.logger.warn(
                `Retrying ${scrapeOptions.url} (attempt ${attempt + 1}/${
                  maxRetries + 1
                })`,
              );
              // Exponential backoff: 1s, 2s, 4s, ...
              await new Promise((r) =>
                setTimeout(r, 1000 * Math.pow(2, attempt)),
              );
            }
          }
        }

        if (!continueOnError && lastError) {
          // Propagate the error to abort all workers
          throw lastError;
        }

        if (lastError) {
          this.logger.error(
            `Failed to scrape ${scrapeOptions.url} after ${
              maxRetries + 1
            } attempts:`,
            lastError,
          );
        }

        // Optional throttle between individual scrapes
        if (throttleDelayMs > 0) {
          await new Promise((r) => setTimeout(r, throttleDelayMs));
        }
      }
    };

    // Launch workers up to the concurrency limit
    const workers = Array.from(
      { length: Math.min(concurrency, options.length) },
      () => worker(),
    );
    await Promise.all(workers);
    return results;
  }

  /**
   * Closes the browser instance
   */
  async closeBrowser(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.logger.log('Browser closed');
    }
  }
}
