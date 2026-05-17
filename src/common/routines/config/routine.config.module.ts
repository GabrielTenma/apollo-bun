/**
 * Routine execution configuration module.
 * Deprecated: RoutineService is now provided by CommonModule's factory provider
 * (createRoutineConfig in common/common.module.ts), so this module's custom-token
 * approach (ROUTINE_CONFIG + @Inject(ROUTINE_CONFIG)) is no longer used.
 * Kept as a stub to avoid breaking any stale imports.
 */
import { Module, Global, Injectable } from '@nestjs/common';

interface RoutineConfig {
  enabled: boolean;
  executionMode?: 'wait' | 'skip' | 'overlap';
}

export const ROUTINE_CONFIG = 'ROUTINE_CONFIG' as const;

@Injectable()
export class RoutineConfigService {
  getConfig(): RoutineConfig {
    return {
      enabled: (process.env.ROUTINE_ENABLED ?? 'false') === 'true',
      executionMode:
        (process.env.ROUTINE_EXECUTION_MODE ?? 'wait') as
          | 'wait'
          | 'skip'
          | 'overlap',
    };
  }
}

/**
 * Stub module — not imported by any current module.
 * RoutineService is instantiated by CommonModule's factory provider.
 */
@Global()
@Module({
  providers: [
    RoutineConfigService,
    {
      provide: ROUTINE_CONFIG,
      useFactory: () => ({
        enabled: (process.env.ROUTINE_ENABLED ?? 'false') === 'true',
        executionMode:
          (process.env.ROUTINE_EXECUTION_MODE ?? 'wait') as
            | 'wait'
            | 'skip'
            | 'overlap',
      }),
    },
  ],
  exports: [ROUTINE_CONFIG, RoutineConfigService],
})
export class RoutineConfigModule {}
