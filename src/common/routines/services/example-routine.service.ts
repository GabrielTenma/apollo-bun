import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { RoutineService } from './routine.service';

/**
 * Example routine service demonstrating how to use the RoutineService
 * This service shows how to set up routines with individual intervals
 */
@Injectable()
export class ExampleRoutineService implements OnModuleInit {
  private readonly logger = new Logger(ExampleRoutineService.name);

  constructor(private readonly routineService: RoutineService) {}

  onModuleInit() {
    // Only set up routines if globally enabled
    if (!this.routineService.isEnabled()) {
      this.logger.log('Routines are disabled globally, skipping setup');
      return;
    }

    // Example 1: A routine that runs every 30 seconds
    this.routineService.startRoutine(
      'example-heartbeat',
      async () => {
        this.logger.log('Heartbeat routine executed');
        // Add your logic here
      },
      30000, // 30 seconds - individual interval for this routine
    );

    // Example 2: A routine that runs every 5 minutes
    this.routineService.startRoutine(
      'example-data-sync',
      async () => {
        this.logger.log('Data sync routine executed');
        // Add your data synchronization logic here
        await this.syncData();
      },
      300000, // 5 minutes - different interval for this routine
    );

    // Example 3: A routine that runs every hour
    this.routineService.startRoutine(
      'example-cleanup',
      async () => {
        this.logger.log('Cleanup routine executed');
        // Add your cleanup logic here
        await this.cleanupOldData();
      },
      3600000, // 1 hour - yet another interval
    );

    this.logger.log(
      `Started ${
        this.routineService.getRunningRoutines().length
      } example routines`,
    );
  }

  /**
   * Example data synchronization logic
   */
  private async syncData(): Promise<void> {
    // Implement your data sync logic here
    // This is just an example
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  /**
   * Example cleanup logic
   */
  private async cleanupOldData(): Promise<void> {
    // Implement your cleanup logic here
    // This is just an example
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  /**
   * Manually trigger a routine (useful for testing or manual execution)
   */
  async runHeartbeatManually(): Promise<void> {
    await this.routineService.executeRoutine(
      'example-heartbeat-manual',
      async () => {
        this.logger.log('Manual heartbeat executed');
      },
    );
  }
}
