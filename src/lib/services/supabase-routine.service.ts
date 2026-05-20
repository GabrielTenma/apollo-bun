import { RoutineService } from '../routine.service.ts';
import { SupabaseService } from './supabase.service.ts';

export class SupabaseRoutineService {
  private readonly routineName = 'supabase-routine';
  private readonly intervalMs = 300_000;

  constructor(
    public routineService: RoutineService,
    public supabaseService: SupabaseService,
  ) {}

  start() {
    if (!this.routineService.isEnabled()) {
      console.log(
        'Routines are disabled globally, skipping Supabase routine setup',
      );
      return;
    }

    this.routineService.startRoutine(this.routineName, async () => {
      console.log('Supabase routine executed');
      // Placeholder for routine logic.
    }, this.intervalMs);

    console.log(`Supabase routine started with interval ${this.intervalMs}ms`);
  }
}
