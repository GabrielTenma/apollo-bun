import { Module, Global } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ScraperService } from './scraper.service';
import { ScraperController } from './scraper.controller';
import { FinancialJuiceTarget } from './target/financialjuice.target';
import { CoinmarketCapTarget } from './target/coinmarketcap.target';
import { YahooFinanceTarget } from './target/yahoofinance.target';
import { AppConstantsModule } from '../constants/app.module';
import { AppConstants } from '../constants/app.constants';
import { ScraperRoutineService } from './routines/scraper-routine.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScrapedDataEntity } from '../supabase/entities/scraped-data.entity';
import { ScrapingSourceEntity } from '../supabase/entities/scraping-source.entity';
import { CommonModule } from '../common/common.module';
import { RoutineService } from '../common/routines/services/routine.service';

/**
 * Factory for ScraperService — no external deps; factory exists so that
 * `design:paramtypes` is never read under esbuild/tsx.
 */
function buildScraperService(): ScraperService {
  return ScraperService.create();
}

/**
 * Factory for FinancialJuiceTarget.
 */
function buildFinancialJuiceTarget(
  scraperService: ScraperService,
): FinancialJuiceTarget {
  return FinancialJuiceTarget.create(scraperService);
}

/**
 * Factory for CoinmarketCapTarget.
 */
function buildCoinmarketCapTarget(
  scraperService: ScraperService,
): CoinmarketCapTarget {
  return CoinmarketCapTarget.create(scraperService);
}

/**
 * Factory for YahooFinanceTarget.
 */
function buildYahooFinanceTarget(
  scraperService: ScraperService,
): YahooFinanceTarget {
  return YahooFinanceTarget.create(scraperService);
}

/**
 * Factory for ScraperRoutineService.
 *
 * Under tsx/bun: esbuild emits `Reflect.metadata("self:paramtypes", ...)` instead of
 * `"design:paramtypes"`. NestJS 9 reads only `"design:paramtypes"` for class-type token
 * resolution, so all plain-typed constructor params are silently resolved as `undefined`.
 *
 * FIX: We avoid the broken path entirely by using:
 *   - a static factory (`createFromModule`) called from the module's `useFactory`, and
 *   - public fields (not constructor params) for all dependencies.
 */
function buildScraperRoutineService(
  routineService: RoutineService,
  coinMarketCapTarget: CoinmarketCapTarget,
  yahooFinanceTarget: YahooFinanceTarget,
  financialJuiceTarget: FinancialJuiceTarget,
  scraperService: ScraperService,
  scrapedDataRepository: any,
  constants: any,
): ScraperRoutineService {
  return ScraperRoutineService.create(
    routineService,
    coinMarketCapTarget,
    yahooFinanceTarget,
    financialJuiceTarget,
    scraperService,
    scrapedDataRepository,
    constants,
  );
}

/**
 * Factory for ScraperController.
 */
function buildScraperController(
  scraperService: ScraperService,
  financialJuiceTarget: FinancialJuiceTarget,
  coinmarketCapTarget: CoinmarketCapTarget,
  yahooFinanceTarget: YahooFinanceTarget,
  constants: AppConstants,
  scrapingSourceRepository: Repository<ScrapingSourceEntity>,
  scrapedDataRepository: Repository<ScrapedDataEntity>,
): ScraperController {
  return ScraperController.create(
    scraperService,
    financialJuiceTarget,
    coinmarketCapTarget,
    yahooFinanceTarget,
    constants,
    scrapingSourceRepository,
    scrapedDataRepository,
  );
}

/**
 * Module for Playwright-based web scraping functionality.
 * Provides the ScraperService for advanced web scraping operations
 * including single/multiple page scraping, structured data extraction,
 * and concurrent scraping with configurable options.
 *
 * ScraperRoutineService is provided via a factory so that all its constructor
 * dependencies are resolved explicitly — esbuild's TypeScript transformer
 * emits `self:paramtypes` instead of `design:paramtypes`, silently breaking
 * NestJS 9's auto class-type injection for ClassProviders under bun/tsx.
 */
@Global()
@Module({
  imports: [
    CommonModule,
    AppConstantsModule,
    TypeOrmModule.forFeature([ScrapedDataEntity, ScrapingSourceEntity]),
  ],
  providers: [
    {
      provide: ScraperService,
      useFactory: buildScraperService,
      inject: [],
    },
    {
      provide: FinancialJuiceTarget,
      useFactory: buildFinancialJuiceTarget,
      inject: [ScraperService],
    },
    {
      provide: CoinmarketCapTarget,
      useFactory: buildCoinmarketCapTarget,
      inject: [ScraperService],
    },
    {
      provide: YahooFinanceTarget,
      useFactory: buildYahooFinanceTarget,
      inject: [ScraperService],
    },
    {
      provide: ScraperController,
      useFactory: buildScraperController,
      inject: [
        ScraperService,
        FinancialJuiceTarget,
        CoinmarketCapTarget,
        YahooFinanceTarget,
        'APP_CONSTANTS',
        getRepositoryToken(ScrapingSourceEntity),
        getRepositoryToken(ScrapedDataEntity),
      ],
    },
    {
      provide: ScraperRoutineService,
      useFactory: buildScraperRoutineService,
      inject: [
        RoutineService,            // CommonModule factory provider token
        CoinmarketCapTarget,        // factory-based provider in this module
        YahooFinanceTarget,         // factory-based provider in this module
        FinancialJuiceTarget,       // factory-based provider in this module
        ScraperService,             // factory-based provider in this module
        getRepositoryToken(ScrapedDataEntity), // TypeORM dynamic repo token
        'APP_CONSTANTS',            // AppConstantsModule useValue constant
      ],
    },
  ],
  controllers: [ScraperController],
  exports: [
    ScraperService,
    FinancialJuiceTarget,
    CoinmarketCapTarget,
    YahooFinanceTarget,
    ScraperRoutineService,
  ],
})
export class ScraperModule {}
