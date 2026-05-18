import {
  Controller,
  Post,
  Body,
  Get,
  Query,
  Logger,
  Injectable,
  Inject,
  Param,
  Put,
  Delete,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { ScraperService } from './scraper.service';
import { ScrapeOptions, ExtractConfig } from './interfaces/scraper.interface';
import {
  ApiResponse,
  errorResponse,
  successResponse,
} from '../common/utils/response.util';
import { FinancialJuiceTarget, NewsItem } from './target/financialjuice.target';
import { CoinData, CoinmarketCapTarget } from './target/coinmarketcap.target';
import {
  YahooFinanceTarget,
  YahooNewsItem,
} from './target/yahoofinance.target';
import { Public } from '../common/decorators/public.decorator';
import {
  APP_CONSTANTS,
  appConstants,
  AppConstants,
} from '../constants/app.constants';
import { ScrapingSourceEntity } from '../supabase/entities/scraping-source.entity';
import { ScrapedDataEntity } from '../supabase/entities/scraped-data.entity';
import * as crypto from 'crypto';

/**
 * Controller for web scraping operations.
 * Provides endpoints for single page scraping, multiple page scraping,
 * and structured data extraction using Playwright.
 */
@Controller('/api/v1/scraper')
export class ScraperController {
  // Assigned by the static factory; never `undefined` after construction
  scraperService!: ScraperService;
  financialJuiceTarget!: FinancialJuiceTarget;
  coinmarketCapTarget!: CoinmarketCapTarget;
  yahooFinanceTarget!: YahooFinanceTarget;
  constants!: AppConstants;
  scrapingSourceRepository!: Repository<ScrapingSourceEntity>;
  scrapedDataRepository!: Repository<ScrapedDataEntity>;
  private readonly logger = new Logger(ScraperController.name);

  private constructor() {}

  /**
   * Static factory. Nest resolves and injects every dependency explicitly
   * from the module's `useFactory`, so `design:paramtypes` metadata is never read.
   */
  static create(
    scraperService: ScraperService,
    financialJuiceTarget: FinancialJuiceTarget,
    coinmarketCapTarget: CoinmarketCapTarget,
    yahooFinanceTarget: YahooFinanceTarget,
    constants: AppConstants,
    scrapingSourceRepository: Repository<ScrapingSourceEntity>,
    scrapedDataRepository: Repository<ScrapedDataEntity>,
  ): ScraperController {
    const ctrl = new ScraperController();
    ctrl.scraperService = scraperService;
    ctrl.financialJuiceTarget = financialJuiceTarget;
    ctrl.coinmarketCapTarget = coinmarketCapTarget;
    ctrl.yahooFinanceTarget = yahooFinanceTarget;
    ctrl.constants = constants;
    ctrl.scrapingSourceRepository = scrapingSourceRepository;
    ctrl.scrapedDataRepository = scrapedDataRepository;
    return ctrl;
  }

  /**
   * Scrapes a single webpage
   * @param options - Scrape options including URL and configuration
   * @returns Scrape result with extracted data
   *
   * @example
   * POST /scraper/scrape
   * {
   *   "url": "https://example.com",
   *   "waitForSelector": ".content",
   *   "timeout": 30000,
   *   "screenshot": true
   * }
   */
  @Post('scrape')
  async scrape(@Body() options: ScrapeOptions): Promise<any> {
    this.logger.log(`Scrape request for: ${options.url}`);
    try {
      return await this.scraperService.scrape(options);
    } catch (error) {
      this.logger.error(`Scrape failed for ${options.url}:`, error);
      throw error;
    }
  }

  /**
   * Scrapes multiple pages concurrently
   * @param urls - Array of URLs to scrape
   * @param options - Common scrape options (optional)
   * @param concurrency - Number of concurrent scrapes (default: 3)
   * @returns Array of scrape results
   *
   * @example
   * POST /scraper/scrape-multiple
   * {
   *   "urls": ["https://example1.com", "https://example2.com"],
   *   "concurrency": 2,
   *   "options": {
   *     "timeout": 30000
   *   }
   * }
   */
  @Post('scrape-multiple')
  async scrapeMultiple(
    @Body('options') options: ScrapeOptions[],
    @Body('concurrency') concurrency = 3,
    @Body('continueOnError') contineOnError?: boolean,
    @Body('maxRetries') maxRetries = 3,
  ): Promise<any> {
    this.logger.log(
      `Scraping ${options.length} URLs with concurrency ${concurrency}`,
    );
    try {
      return await this.scraperService.scrapeMultiple(
        options,
        concurrency,
        contineOnError,
        maxRetries,
      );
    } catch (error) {
      this.logger.error('Multiple scrape failed:', error);
      throw error;
    }
  }

  /**
   * Extracts structured data from a webpage
   * @param url - URL to scrape
   * @param config - Extraction configuration
   * @returns Extracted structured data
   *
   * @example
   * POST /scraper/extract
   * {
   *   "url": "https://example.com",
   *   "config": {
   *     "title": "h1",
   *     "description": ".description",
   *     "image": "img.hero",
   *     "links": {
   *       "selector": "a",
   *       "attribute": "href"
   *     },
   *     "custom": {
   *       "prices": {
   *         "selector": ".price",
   *         "multiple": true,
   *         "textContent": true
   *       }
   *     }
   *   }
   * }
   */
  @Post('extract')
  async extractStructured(
    @Body('url') url: string,
    @Body('config') config: ExtractConfig,
  ): Promise<any> {
    this.logger.log(`Extracting structured data from: ${url}`);
    try {
      const result = await this.scraperService.scrape({
        url,
        waitForSelector: config.title || undefined,
      });

      // Re-open page for structured extraction (simplified example)
      const browser = await this.scraperService['getBrowser']();
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.goto(url, { waitUntil: 'networkidle' });

      const extractedData = await this.scraperService.extractStructuredData(
        page,
        config,
      );

      await context.close();

      return {
        url,
        extracted: extractedData,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`Structured extraction failed for ${url}:`, error);
      throw error;
    }
  }

  /**
   * Health check endpoint for the scraper service
   * @returns Health status
   */
  @Public()
  @Get('health')
  async healthCheck(): Promise<any> {
    return { status: 'ok', service: 'scraper' };
  }

  /**
   * FinancialJuice endpoint for get latest news
   * @returns News
   */
  @Get('financialjuice')
  async financialJuice(): Promise<any> {
    this.logger.log(`Requested to scrape FinancialJuice`);
    const content = appConstants.scrapedContentStore.get('financialjuice');
    if (content != undefined) {
      return content;
    }
    return successResponse(undefined, 'on process routine', 202);
  }

  /**
   * CoinmarketCap endpoint for get latest price
   * @returns Coins
   */
  @Get('coinmarketcap')
  async coinmarketCap(): Promise<any> {
    this.logger.log(`Requested to scrape CoinmarketCap`);
    const content = appConstants.scrapedContentStore.get('coinmarketcap');
    if (content != undefined) {
      return content;
    }
    return successResponse(undefined, 'on process routine', 202);
  }

  /**
   * CoinmarketCap endpoint for get latest price
   * @returns Coins
   */
  @Get('yahoofinance')
  async yahooFinance(): Promise<any> {
    this.logger.log(`Requested to scrape Yahoo Finance`);
    const content = appConstants.scrapedContentStore.get('yahoofinance');
    if (content != undefined) {
      return content;
    }
    return successResponse(undefined, 'on process routine', 202);
  }

  /**
   * Get all scraping sources
   * @returns Array of scraping sources
   */
  @Get('sources')
  async getAllSources(): Promise<ScrapingSourceEntity[]> {
    this.logger.log('Getting all scraping sources');
    return await this.scrapingSourceRepository.find();
  }

  /**
   * Get a specific scraping source by ID
   * @param id - Source ID
   * @returns Scraping source
   */
  @Get('sources/:id')
  async getSource(@Param('id') id: string): Promise<ScrapingSourceEntity> {
    this.logger.log(`Getting scraping source: ${id}`);
    const source = await this.scrapingSourceRepository.findOne({
      where: { id },
    });
    if (!source) {
      throw new Error('Scraping source not found');
    }
    return source;
  }

  /**
   * Create a new scraping source
   * @param sourceData - Source data
   * @returns Created source
   */
  @Post('sources')
  async createSource(
    @Body() sourceData: Partial<ScrapingSourceEntity>,
  ): Promise<ScrapingSourceEntity> {
    this.logger.log('Creating new scraping source');
    const source = this.scrapingSourceRepository.create(sourceData);
    return await this.scrapingSourceRepository.save(source);
  }

  /**
   * Update an existing scraping source
   * @param id - Source ID
   * @param sourceData - Updated source data
   * @returns Updated source
   */
  @Put('sources/:id')
  async updateSource(
    @Param('id') id: string,
    @Body() sourceData: Partial<ScrapingSourceEntity>,
  ): Promise<ScrapingSourceEntity> {
    this.logger.log(`Updating scraping source: ${id}`);
    await this.scrapingSourceRepository.update(id, sourceData);
    const updatedSource = await this.scrapingSourceRepository.findOne({
      where: { id },
    });
    if (!updatedSource) {
      throw new Error('Scraping source not found');
    }
    return updatedSource;
  }

  /**
   * Delete a scraping source
   * @param id - Source ID
   */
  @Delete('sources/:id')
  async deleteSource(@Param('id') id: string): Promise<void> {
    this.logger.log(`Deleting scraping source: ${id}`);
    const result = await this.scrapingSourceRepository.delete(id);
    if (result.affected === 0) {
      throw new Error('Scraping source not found');
    }
  }

  /**
   * Scrape data using a configured scraping source
   * @param id - Source ID
   * @returns Scrape result
   */
  @Post('scrape-source/:id')
  async scrapeSource(@Param('id') id: string): Promise<any> {
    this.logger.log(`Scraping using source: ${id}`);
    const source = await this.scrapingSourceRepository.findOne({
      where: { id },
    });
    if (!source) {
      throw new Error('Scraping source not found');
    }
    if (!source.is_active) {
      throw new Error('Scraping source is not active');
    }
    const options: ScrapeOptions = source.connection_config as ScrapeOptions;
    const scrapeResult = await this.scraperService.scrape(options);

    // Save scraped data to database
    const rawContent = JSON.stringify(scrapeResult);
    const dataHash = crypto
      .createHash('sha256')
      .update(rawContent)
      .digest('hex')
      .substring(0, 64);

    const scrapedData = this.scrapedDataRepository.create({
      source_id: id,
      raw_content: rawContent,
      parsed_data: scrapeResult.data,
      data_hash: dataHash,
      status: 'processed',
    });

    await this.scrapedDataRepository.save(scrapedData);

    return scrapeResult;
  }

  /**
   * Get all scraped data
   * @returns Array of scraped data
   */
  @Get('scraped-data')
  async getAllScrapedData(): Promise<ScrapedDataEntity[]> {
    this.logger.log('Getting all scraped data');
    return await this.scrapedDataRepository.find({ relations: ['source'] });
  }

  /**
   * Get latest scraped data (llm result)
   * @returns single/multiple by size processed data
   */
  @Get('scraped-data/result/latest/:size')
  async getResultLatest(
    @Param('size') size?: number,
  ): Promise<ScrapedDataEntity[]> {
    this.logger.log('Getting single processed result');
    return await this.scrapedDataRepository.find({
      where: { source_id: 'ac851202-bc72-43c8-b784-e213b5907159' }, // openrouter source_id
      relations: ['source'],
      take: size || 1,
      skip: 0,
      order: { captured_at: 'DESC' },
    });
  }

  /**
   * Get scraped data by source ID
   * @param sourceId - Source ID
   * @returns Array of scraped data for the source
   */
  @Get('scraped-data/source/:sourceId')
  async getScrapedDataBySource(
    @Param('sourceId') sourceId: string,
  ): Promise<ScrapedDataEntity[]> {
    this.logger.log(`Getting scraped data for source: ${sourceId}`);
    return await this.scrapedDataRepository.find({
      where: { source_id: sourceId },
      relations: ['source'],
      order: { captured_at: 'DESC' },
    });
  }

  /**
   * Get a specific scraped data by ID
   * @param id - Scraped data ID
   * @returns Scraped data
   */
  @Get('scraped-data/:id')
  async getScrapedData(@Param('id') id: string): Promise<ScrapedDataEntity> {
    this.logger.log(`Getting scraped data: ${id}`);
    const data = await this.scrapedDataRepository.findOne({
      where: { id },
      relations: ['source'],
    });
    if (!data) {
      throw new Error('Scraped data not found');
    }
    return data;
  }

  /**
   * Create new scraped data
   * @param data - Scraped data
   * @returns Created scraped data
   */
  @Post('scraped-data')
  async createScrapedData(
    @Body() data: Partial<ScrapedDataEntity>,
  ): Promise<ScrapedDataEntity> {
    this.logger.log('Creating new scraped data');
    const scrapedData = this.scrapedDataRepository.create(data);
    return await this.scrapedDataRepository.save(scrapedData);
  }

  /**
   * Update scraped data
   * @param id - Scraped data ID
   * @param data - Updated data
   * @returns Updated scraped data
   */
  @Put('scraped-data/:id')
  async updateScrapedData(
    @Param('id') id: string,
    @Body() data: Partial<ScrapedDataEntity>,
  ): Promise<ScrapedDataEntity> {
    this.logger.log(`Updating scraped data: ${id}`);
    await this.scrapedDataRepository.update(id, data);
    const updatedData = await this.scrapedDataRepository.findOne({
      where: { id },
      relations: ['source'],
    });
    if (!updatedData) {
      throw new Error('Scraped data not found');
    }
    return updatedData;
  }

  /**
   * Delete scraped data
   * @param id - Scraped data ID
   */
  @Delete('scraped-data/:id')
  async deleteScrapedData(@Param('id') id: string): Promise<void> {
    this.logger.log(`Deleting scraped data: ${id}`);
    const result = await this.scrapedDataRepository.delete(id);
    if (result.affected === 0) {
      throw new Error('Scraped data not found');
    }
  }
}
