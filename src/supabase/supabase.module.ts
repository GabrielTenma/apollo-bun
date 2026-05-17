import { Module, Global } from '@nestjs/common';
import { SupabaseService } from './supabase.service';
import { SupabaseController } from './supabase.controller';
import { SupabaseTypeOrmModule } from '../common/typeorm/typeorm.module';
import { CommonModule } from '../common/common.module';
import { RoutineService } from '../common/routines/services/routine.service';
import { SupabaseRoutineService } from './routines/supabase-routine.service';

/**
 * Factory for SupabaseRoutineService. Avoids broken tsx emitDecoratorMetadata path.
 */
function buildSupabaseRoutineService(
  routineService: RoutineService,
  supabaseService: SupabaseService,
): SupabaseRoutineService {
  return SupabaseRoutineService.create(routineService, supabaseService);
}

/**
 * Global module for Supabase integration.
 * Exposes SupabaseService for injection throughout the application.
 */
@Global()
@Module({
  imports: [CommonModule, SupabaseTypeOrmModule],
  providers: [SupabaseService, {
    provide: SupabaseRoutineService,
    useFactory: buildSupabaseRoutineService,
    inject: [
      RoutineService,              // CommonModule factory provider (class token)
      SupabaseService,
    ],
  }],
  controllers: [SupabaseController],
  exports: [SupabaseService, SupabaseTypeOrmModule],
})
export class SupabaseModule {}
