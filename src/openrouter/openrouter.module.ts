import { Module, Global } from '@nestjs/common';
import { OpenRouterService } from './openrouter.service';
import { OpenRouterController } from './openrouter.controller';
import { FinancialAgentService } from './agents/financial.agent';
import { OpenrouterRoutineService } from './routines/openrouter-routine.service';
import { RoutineService } from '../common/routines/services/routine.service';
import { ScrapedDataEntity } from '../supabase/entities/scraped-data.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommonModule } from '../common/common.module';
import { getRepositoryToken } from '@nestjs/typeorm';

/**
 * Factory for OpenrouterRoutineService.
 * Uses explicit useFactory to avoid broken tsx/esbuild `design:paramtypes` metadata.
 */
function buildOpenrouterRoutineService(
  routineService: any,
  financialAgentService: FinancialAgentService,
  scrapedDataRepository: any,
  constants: any,
): OpenrouterRoutineService {
  return OpenrouterRoutineService.create(
    routineService,
    financialAgentService,
    scrapedDataRepository,
    constants,
  );
}

/**
 * Module for OpenRouter AI functionality.
 * Provides the OpenRouterService for interacting with OpenRouter API,
 * including chat completions, model listing, and other AI operations.
 *
 * Can be imported globally to make the OpenRouterService available
 * throughout the application.
 */
@Global()
@Module({
  imports: [CommonModule, TypeOrmModule.forFeature([ScrapedDataEntity])],
  providers: [
    OpenRouterService,
    FinancialAgentService,
    {
      provide: OpenrouterRoutineService,
      useFactory: buildOpenrouterRoutineService,
      inject: [
        RoutineService,              // CommonModule factory provider (class token)
        FinancialAgentService,       // OpenRouterModule's own @Injectable()
        getRepositoryToken(ScrapedDataEntity), // TypeORM dynamic repo token
        'APP_CONSTANTS',             // AppConstantsModule value token
      ],
    },
  ],
  controllers: [OpenRouterController],
  exports: [OpenRouterService, FinancialAgentService, OpenrouterRoutineService],
})
export class OpenRouterModule {}
