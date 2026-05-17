import { Injectable, Logger, OnModuleInit, InjectRepository } from '@nestjs/common';
import { RoutineService } from '../../common/routines/services/routine.service';
import { APP_CONSTANTS, appConstants, AppConstants } from '../../constants/app.constants';
import { FinancialAgentService } from '../agents/financial.agent';
import { ScrapedDataEntity } from '../../supabase/entities/scraped-data.entity';
import * as crypto from 'crypto';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';

/**
 * Openrouter routine service.
 *
 * Under tsx/bun: esbuild emits `Reflect.metadata("self:paramtypes", ...)` instead of
 * `"design:paramtypes"`. NestJS 9 reads only `"design:paramtypes"` for class-type token
 * resolution, so all plain-typed constructor params are silently resolved as `undefined`.
 *
 * FIX: Use a static factory (create) that the module calls with deps, and store deps
 * in public fields instead of `private readonly` constructor params.
 */
@Injectable()
export class OpenrouterRoutineService implements OnModuleInit {
  private readonly logger = new Logger(OpenrouterRoutineService.name);
  private routineTime = 20000;
  // Public fields so factory can assign
  routineService!: RoutineService;
  financialAgentService!: FinancialAgentService;
  scrapedDataRepository!: Repository<ScrapedDataEntity>;
  constants!: AppConstants;

  private constructor() {}

  /**
   * Static factory — bypasses broken @ClassProvider metadata resolution.
   */
  static create(
    routineService: RoutineService,
    financialAgentService: FinancialAgentService,
    scrapedDataRepository: Repository<ScrapedDataEntity>,
    constants: AppConstants,
  ): OpenrouterRoutineService {
    const svc = new OpenrouterRoutineService();
    svc.routineService = routineService;
    svc.financialAgentService = financialAgentService;
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
      'openrouter-routine',
      async () => {
        this.logger.log('Scraper collector routine executed');

        // fill value
        const financialJuice =
          appConstants.scrapedContentStore.get('financialjuice');
        const yahooFinance =
          appConstants.scrapedContentStore.get('yahoofinance');
        const coinmarketCap =
          appConstants.scrapedContentStore.get('coinmarketcap');
        const completionPrev = appConstants.scrapedContentStore.get(
          'completion-previous',
        );

        const isStoreHasContents =
          financialJuice != undefined &&
          yahooFinance != undefined &&
          coinmarketCap != undefined;

        // execute by condition
        if (isStoreHasContents) {
          const chatCompletion = await this.financialAgentService.queryChat({
            financialJuiceContent: JSON.stringify(financialJuice || ''),
            yahooFinanceContent: JSON.stringify(yahooFinance || ''),
            coinmarketCapContent: JSON.stringify(coinmarketCap || ''),
            maxTextLength: 1000,
            ideaWordsLength: 300,
            riskReminder: 3,
            tradeIdeas: '1-5',
            language: 'english',
          });
          appConstants.scrapedContentStore.set('completion', chatCompletion);

          // Put into repository
          const chatCompletionDataEntity: ScrapedDataEntity = {
            source_id: 'ac851202-bc72-43c8-b784-e213b5907159',
            parsed_data: { chatCompletion: chatCompletion },
            raw_content: Buffer.from(chatCompletion || '').toString('utf-8'),
            data_hash: crypto
              .createHash('sha256')
              .update(chatCompletion || '')
              .digest('hex')
              .substring(0, 64),
            status: 'result',
          };
          const scrapedData = this.scrapedDataRepository.create(
            chatCompletionDataEntity,
          );
          await this.scrapedDataRepository.save(scrapedData);

          this.routineTime = 100000;
        } else {
          this.logger.log(`Not ready yet! skipped.`);
          this.routineTime = 20000;
        }
      },
      this.routineTime,
    );

    this.logger.log(
      `Started ${
        this.routineService.getRunningRoutines().length
      } collector routines`,
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
