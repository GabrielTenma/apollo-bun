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
 * Factory for OpenRouterService — constructor body runs under factory control
 * so `design:paramtypes` is never read.
 */
function buildOpenRouterService(): OpenRouterService {
  return OpenRouterService.create();
}

/**
 * Factory for FinancialAgentService.
 * Uses explicit useFactory to avoid broken tsx/esbuild `design:paramtypes` metadata.
 */
function buildFinancialAgentService(
  openRouterService: OpenRouterService,
): FinancialAgentService {
  return FinancialAgentService.create(openRouterService);
}

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
 * Factory for OpenRouterController — factory-provided so its constructor
 * dependencies are resolved explicitly.
 */
function buildOpenRouterController(
  openRouterService: OpenRouterService,
  financialAgentService: FinancialAgentService,
  constants: any,
): OpenRouterController {
  return OpenRouterController.create(
    openRouterService,
    financialAgentService,
    constants,
  );
}

/**
 * Module for OpenRouter AI functionality.
 * Provides the OpenRouterService for interacting with OpenRouter API.
 */
@Global()
@Module({
  imports: [CommonModule, TypeOrmModule.forFeature([ScrapedDataEntity])],
  providers: [
    {
      provide: OpenRouterService,
      useFactory: buildOpenRouterService,
      inject: [],
    },
    {
      provide: FinancialAgentService,
      useFactory: buildFinancialAgentService,
      inject: [OpenRouterService],
    },
    {
      provide: OpenrouterRoutineService,
      useFactory: buildOpenrouterRoutineService,
      inject: [
        RoutineService,              // CommonModule factory provider (class token)
        FinancialAgentService,       // OpenRouterModule's own factory provider
        getRepositoryToken(ScrapedDataEntity), // TypeORM dynamic repo token
        'APP_CONSTANTS',             // AppConstantsModule useValue constant
      ],
    },
    {
      provide: OpenRouterController,
      useFactory: buildOpenRouterController,
      inject: [
        OpenRouterService,
        FinancialAgentService,
        'APP_CONSTANTS',
      ],
    },
  ],
  controllers: [OpenRouterController],
  exports: [OpenRouterService, FinancialAgentService, OpenrouterRoutineService],
})
export class OpenRouterModule {}
