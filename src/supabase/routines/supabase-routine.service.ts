import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { RoutineService } from '../../common/routines/services/routine.service';
import { SupabaseService } from '../supabase.service';

/**
 * Supabase routine service.
 *
 * Under tsx/bun: esbuild emits `Reflect.metadata("self:paramtypes", ...)` instead of
 * `"design:paramtypes"`. NestJS 9 only reads `"design:paramtypes"` for auto class-
 * type token resolution. All plain-typed constructor params are silently resolved as
 * `undefined` under tsx.
 *
 * FIX: use a static factory (create) so the module calls it with proper deps.
 */
@Injectable()
export class SupabaseRoutineService implements OnModuleInit {
  private readonly logger = new Logger(SupabaseRoutineService.name);
  private readonly routineName = 'supabase-routine';
  private readonly intervalMs = 300_000;
  // Public fields (set by factory)
  routineService!: RoutineService;
  supabaseService!: SupabaseService;

  private constructor() {}

  static create(
    routineService: RoutineService,
    supabaseService: SupabaseService,
  ): SupabaseRoutineService {
    const svc = new SupabaseRoutineService();
    svc.routineService = routineService;
    svc.supabaseService = supabaseService;
    return svc;
  }

  onModuleInit() {
    if (!this.routineService.isEnabled()) {
      this.logger.log(
        'Routines are disabled globally, skipping Supabase routine setup',
      );
      return;
    }

    this.routineService.startRoutine(
      this.routineName,
      async () => {
        this.logger.log('Supabase routine executed');
        // Placeholder for routine logic.
      },
      this.intervalMs,
    );

    this.logger.log(
      `Supabase routine started with interval ${this.intervalMs}ms`,
    );
  }
}
