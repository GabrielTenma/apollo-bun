import * as crypto from 'crypto';
import { RoutineService } from '../routine.service';
import { CoinmarketCapTarget } from '../../scraper/target/coinmarketcap.target';
import { YahooFinanceTarget } from '../../scraper/target/yahoofinance.target';
import { FinancialJuiceTarget } from '../../scraper/target/financialjuice.target';
import { ScraperService } from './scraper.service';
import { MemoryKeyStore } from '../memory-key-store';
import { Repository } from 'typeorm';
import { ScrapedDataEntity } from '../../supabase/entities/scraped-data.entity';

export class ScraperRoutineService {
  constructor(
    public routineService: RoutineService,
    public coinMarketCapTarget: CoinmarketCapTarget,
    public yahooFinanceTarget: YahooFinanceTarget,
    public financialJuiceTarget: FinancialJuiceTarget,
    public scraperService: ScraperService,
    public scrapedDataRepository: Repository<ScrapedDataEntity>,
    public constants: { appName: string; scrapedContentStore: MemoryKeyStore },
  ) {}

  start() {
    if (!this.routineService.isEnabled()) {
      console.log('Routines are disabled globally, skipping scraper setup');
      return;
    }

    this.routineService.startRoutine(
      'scraper-routine',
      async () => {
        console.log('Scraper collector routine executed');
        const scrapedContentStore = this.constants.scrapedContentStore;

        const scrapeOptions = [
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
          console.warn(
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

        console.log(`scrape routine done ${scrapeAllResult.length}`);
      },
      20000,
    );
  }

  async runManually(name: string): Promise<void> {
    await this.routineService.executeRoutine(name, async () => {
      console.log('Manual scraper routine executed');
    });
  }
}
