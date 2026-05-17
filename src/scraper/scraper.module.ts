import { Module, Global } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ScraperService } from './scraper.service';
import { ScraperController } from './scraper.controller';
import { FinancialJuiceTarget } from './target/financialjuice.target';
import { CoinmarketCapTarget } from './target/coinmarketcap.target';
import { YahooFinanceTarget } from './target/yahoofinance.target';
import { AppConstantsModule } from '../constants/app.module';
import { ScraperRoutineService } from './routines/scraper-routine.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScrapedDataEntity } from '../supabase/entities/scraped-data.entity';
import { CommonModule } from '../common/common.module';
import { RoutineService } from '../common/routines/services/routine.service';

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
 * Module for Playwright-based web scraping functionality.
 * Provides the ScraperService for advanced web scraping operations
 * including single/multiple page scraping, structured data extraction,
 * and concurrent scraping with configurable options.
 *
 * Can be imported globally to make the ScraperService available
 * throughout the application.
 */
@Global()
@Module({
  imports: [
    CommonModule,
    AppConstantsModule,
    TypeOrmModule.forFeature([ScrapedDataEntity]),
  ],
  providers: [
    ScraperService,
    FinancialJuiceTarget,
    CoinmarketCapTarget,
    YahooFinanceTarget,
    {
      provide: ScraperRoutineService,
      useFactory: buildScraperRoutineService,
      inject: [
        RoutineService,            // CommonModule factory provider token
        CoinmarketCapTarget,        // declared in this module providers: []
        YahooFinanceTarget,         // declared in this module providers: []
        FinancialJuiceTarget,       // declared in this module providers: []
        ScraperService,             // declared in this module providers: []
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
