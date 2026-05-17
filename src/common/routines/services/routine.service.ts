import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';

/**
 * Configuration shape for RoutineService.
 */
export interface RoutineConfig {
  enabled: boolean;
  executionMode?: 'wait' | 'skip' | 'overlap';
}

/**
 * Service for executing routines based on configuration.
 * Can be enabled/disabled via environment variables.
 * Each routine can have its own individual interval.
 * Supports different execution modes to control overlapping executions.
 */
@Injectable()
export class RoutineService implements OnModuleDestroy {
  private readonly logger = new Logger(RoutineService.name);
  private readonly intervals = new Map<string, NodeJS.Timeout>();
  private readonly runningRoutines = new Map<string, boolean>();
  private readonly abortControllers = new Map<string, AbortController>();

  constructor(private readonly config: RoutineConfig) {}

  /**
   * Check if routine execution is enabled globally
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Get the execution mode for routines
   */
  private getExecutionMode(): 'wait' | 'skip' | 'overlap' {
    return this.config.executionMode || 'wait';
  }

  /**
   * Check if a routine is currently running
   */
  isRoutineRunning(routineName: string): boolean {
    return this.runningRoutines.get(routineName) || false;
  }

  /**
   * Execute a routine function once if routines are enabled
   * @param routineName - Name of the routine for logging purposes
   * @param routineFn - The routine function to execute
   */
  async executeRoutine(
    routineName: string,
    routineFn: () => Promise<void>,
  ): Promise<void> {
    if (!this.isEnabled()) {
      this.logger.debug(
        `Routine "${routineName}" is disabled, skipping execution`,
      );
      return;
    }

    // Check if routine is already running (for skip mode)
    if (
      this.getExecutionMode() === 'skip' &&
      this.isRoutineRunning(routineName)
    ) {
      this.logger.warn(
        `Routine "${routineName}" is still running, skipping this execution`,
      );
      return;
    }

    // Mark routine as running
    this.runningRoutines.set(routineName, true);

    try {
      this.logger.log(`Executing routine: ${routineName}`);
      await routineFn();
      this.logger.log(`Routine "${routineName}" completed successfully`);
    } catch (error: any) {
      this.logger.error(
        `Routine "${routineName}" failed: ${error.message}`,
        error.stack,
      );
      throw error;
    } finally {
      // Mark routine as not running
      this.runningRoutines.set(routineName, false);
    }
  }

  /**
   * Start a routine with individual interval
   * @param routineName - Name of the routine for logging purposes
   * @param routineFn - The routine function to execute
   * @param intervalMs - Individual interval in milliseconds for this routine
   * @returns The interval ID
   */
  startRoutine(
    routineName: string,
    routineFn: () => Promise<void>,
    intervalMs: number,
  ): NodeJS.Timeout {
    if (!this.isEnabled()) {
      this.logger.debug(`Routine "${routineName}" is disabled, not starting`);
      return null;
    }

    if (intervalMs <= 0) {
      throw new Error(
        `Invalid interval for routine "${routineName}": must be positive`,
      );
    }

    // Clear existing interval if any
    this.stopRoutine(routineName);

    const executionMode = this.getExecutionMode();
    this.logger.log(
      `Starting routine "${routineName}" with interval ${intervalMs}ms (mode: ${executionMode})`,
    );

    if (executionMode === 'overlap') {
      const intervalId = setInterval(async () => {
        await this.executeRoutine(routineName, routineFn);
      }, intervalMs);
      this.intervals.set(routineName, intervalId);
      return intervalId;
    } else if (executionMode === 'skip') {
      const intervalId = setInterval(async () => {
        await this.executeRoutine(routineName, routineFn);
      }, intervalMs);
      this.intervals.set(routineName, intervalId);
      return intervalId;
    } else {
      // Wait mode (default) - recursive setTimeout, waits for completion before next run
      let isActive = true;

      const executeAndSchedule = async () => {
        if (!isActive) return;

        try {
          await this.executeRoutine(routineName, routineFn);
        } catch (error) {
          // Error already logged in executeRoutine
        } finally {
          // Schedule next execution after completion
          if (isActive) {
            const timeoutId = setTimeout(executeAndSchedule, intervalMs);
            this.intervals.set(routineName, timeoutId);
          }
        }
      };

      // Start the first execution
      const initialTimeoutId = setTimeout(executeAndSchedule, 0);
      this.intervals.set(routineName, initialTimeoutId);

      // Return a wrapper that allows stopping
      const wrapperInterval = {
        unref: () => {
          isActive = false;
        },
      } as NodeJS.Timeout;
      return wrapperInterval;
    }
  }

  /**
   * Stop a running routine
   * @param routineName - Name of the routine to stop
   */
  stopRoutine(routineName: string): void {
    const intervalId = this.intervals.get(routineName);
    if (intervalId) {
      clearInterval(intervalId);
      clearTimeout(intervalId);
      this.intervals.delete(routineName);
      this.runningRoutines.delete(routineName);
      this.logger.log(`Stopped routine: ${routineName}`);
    }
  }

  /**
   * Stop all running routines
   */
  stopAllRoutines(): void {
    for (const [name, intervalId] of this.intervals.entries()) {
      clearInterval(intervalId);
      clearTimeout(intervalId);
      this.logger.log(`Stopped routine: ${name}`);
    }
    this.intervals.clear();
    this.runningRoutines.clear();
  }

  /**
   * Get all running routine names
   */
  getRunningRoutines(): string[] {
    return Array.from(this.intervals.keys());
  }

  /**
   * Get all currently executing routine names
   */
  getCurrentlyExecutingRoutines(): string[] {
    return Array.from(this.runningRoutines.entries())
      .filter(([_, isRunning]) => isRunning)
      .map(([name, _]) => name);
  }

  /**
   * Clean up all intervals when module is destroyed
   */
  onModuleDestroy() {
    this.stopAllRoutines();
  }
}
