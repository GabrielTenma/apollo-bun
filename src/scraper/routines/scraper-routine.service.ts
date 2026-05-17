import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as nodeCrypto from 'crypto';
import { RoutineService } from '../../common/routines/services/routine.service';
import { CoinmarketCapTarget } from '../target/coinmarketcap.target';
import { YahooFinanceTarget } from '../target/yahoofinance.target';
import { FinancialJuiceTarget } from '../target/financialjuice.target';
import { ScraperService } from '../scraper.service';
import { APP_CONSTANTS, AppConstants } from '../../constants/app.constants';
import { ScrapeOptions } from '../interfaces/scraper.interface';
import { Repository } from 'typeorm';
import { ScrapedDataEntity } from '../../supabase/entities/scraped-data.entity';
import { InjectRepository } from '@nestjs/typeorm';

/**
 * Scraper routine service.
 *
 * Under tsx/bun: esbuild emits `Reflect.metadata("self:paramtypes", ...)` instead of
 * `"design:paramtypes"`. NestJS 9 reads only `"design:paramtypes"` for class-type token
 * resolution, so all plain-typed constructor params are silently resolved as `undefined`.
 *
 * FIX: We avoid the broken path entirely by using:
 *   - a static factory (`createFromModule`) called from the module's `useFactory`, and
 *   - public fields (not constructor params) for all dependencies.
 */
@Injectable()
export class ScraperRoutineService implements OnModuleInit {
  private readonly logger = new Logger(ScraperRoutineService.name);
  // Public so factory can assign; never undefined after construction
  routineService!: RoutineService;
  coinMarketCapTarget!: CoinmarketCapTarget;
  yahooFinanceTarget!: YahooFinanceTarget;
  financialJuiceTarget!: FinancialJuiceTarget;
  scraperService!: ScraperService;
  scrapedDataRepository!: Repository<ScrapedDataEntity>;
  constants!: AppConstants;

  private constructor() {}

  /**
   * Static factory so NestJS can bypass broken @ClassProvider metadata entirely.
   */
  static create(
    routineService: RoutineService,
    coinMarketCapTarget: CoinmarketCapTarget,
    yahooFinanceTarget: YahooFinanceTarget,
    financialJuiceTarget: FinancialJuiceTarget,
    scraperService: ScraperService,
    scrapedDataRepository: Repository<ScrapedDataEntity>,
    constants: AppConstants,
  ): ScraperRoutineService {
    const svc = new ScraperRoutineService();
    svc.routineService = routineService;
    svc.coinMarketCapTarget = coinMarketCapTarget;
    svc.yahooFinanceTarget = yahooFinanceTarget;
    svc.financialJuiceTarget = financialJuiceTarget;
    svc.scraperService = scraperService;
    svc.scrapedDataRepository = scrapedDataRepository;
    svc.constants = constants;
    return svc;
  }

  onModuleInit() {
    if (!this.routineService.isEnabled()) {
      this.logger.log('Routines are disabled globally, skipping setup');
      return;
    }

    this.routineService.startRoutine(
      'scraper-routine',
      async () => {
        this.logger.log('Scraper collector routine executed');

        const scrapedContentStore = this.constants.scrapedContentStore;

        const scrapeOptions: ScrapeOptions[] = [
          this.coinMarketCapTarget.getOptions(),
          this.yahooFinanceTarget.getOptions(),
          this.financialJuiceTarget.getOptions(),
        ];
        const scrapeAllResult = await this.scraperService.scrapeMultiple(
          scrapeOptions,
          1,
          true,
          0,
        );

        if (!scrapeAllResult.length) {
          this.logger.warn(
            'Scraper routine: all scrape attempts failed, skipping this run',
          );
          return;
        }
        scrapedContentStore.set(
          'coinmarketcap',
          this.coinMarketCapTarget.parsePriceList(
            scrapeAllResult[0].content || '',
          ),
        );
        scrapedContentStore.set(
          'yahoofinance',
          this.yahooFinanceTarget.parseNewsItems(
            scrapeAllResult[1].content || '',
          ),
        );
        scrapedContentStore.set(
          'financialjuice',
          this.financialJuiceTarget.parseNewsItems(
            scrapeAllResult[2].content || '',
          ),
        );

        // const coinmarketcapDataEntity: ScrapedDataEntity = {
        //   source_id: '9d5d44d9-97b1-49d5-93df-fe4e461f6488',
        //   parsed_data: scrapedContentStore.get('coinmarketcap'),
        //   raw_content: Buffer.from(scrapeAllResult[0].content || '').toString(
        //     'utf-8',
        //   ),
        //   data_hash: nodeCrypto
        //     .createHash('sha256')
        //     .update(scrapeAllResult[0].content || '')
        //     .digest('hex')
        //     .substring(0, 64),
        //   status: 'new',
        // };
        // const yahoofinanceDataEntity: ScrapedDataEntity = {
        //   source_id: 'a1a84270-de34-4dd9-ae0b-90dc00b39dbc',
        //   parsed_data: scrapedContentStore.get('yahoofinance'),
        //   raw_content: Buffer.from(scrapeAllResult[1].content || '').toString(
        //     'utf-8',
        //   ),
        //   data_hash: nodeCrypto
        //     .createHash('sha256')
        //     .update(scrapeAllResult[1].content || '')
        //     .digest('hex')
        //     .substring(0, 64),
        //   status: 'new',
        // };
        // const financialjuiceDataEntity: ScrapedDataEntity = {
        //   source_id: '3ede22a5-e89b-4667-9b06-7cf404996720',
        //   parsed_data: scrapedContentStore.get('financialjuice'),
        //   raw_content: Buffer.from(scrapeAllResult[2].content || '').toString(
        //     'utf-8',
        //   ),
        //   data_hash: nodeCrypto
        //     .createHash('sha256')
        //     .update(scrapeAllResult[2].content || '')
        //     .digest('hex')
        //     .substring(0, 64),
        //   status: 'new',
        // };

        // const scrapedData = this.scrapedDataRepository.create([
        //   coinmarketcapDataEntity,
        //   yahoofinanceDataEntity,
        //   financialjuiceDataEntity,
        // ]);
        // await this.scrapedDataRepository.save(scrapedData);

        this.logger.log(`scrape routine done ${scrapeAllResult.length}`);
      },
      20000,
    );

    this.logger.log(
      `Started ${this.routineService.getRunningRoutines().length} collector routines`,
    );
  }

  /**
   * Manually trigger a routine (useful for testing or manual execution)
   */
  async runManually(name: string): Promise<void> {
    await this.routineService.executeRoutine(name, async () => {
      this.logger.log('Manual scraper routine executed');
    });
  }
}
