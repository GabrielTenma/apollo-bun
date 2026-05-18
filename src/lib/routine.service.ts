import { env } from '../config/env.ts';

export interface RoutineConfig {
  enabled: boolean;
  executionMode?: 'wait' | 'skip' | 'overlap';
}

export class RoutineService {
  private readonly intervals = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(private config: RoutineConfig) {}

  isEnabled(): boolean {
    return this.config.enabled;
  }

  private getExecutionMode(): 'wait' | 'skip' | 'overlap' {
    return this.config.executionMode || 'wait';
  }

  async executeRoutine(
    routineName: string,
    routineFn: () => Promise<void>,
  ): Promise<void> {
    if (!this.isEnabled()) return;
    console.log(`Executing routine: ${routineName}`);
    try {
      await routineFn();
      console.log(`Routine "${routineName}" completed successfully`);
    } catch (error: any) {
      console.error(`Routine "${routineName}" failed:`, error.message);
      throw error;
    }
  }

  startRoutine(
    routineName: string,
    routineFn: () => Promise<void>,
    intervalMs: number,
  ): number {
    if (!this.isEnabled()) return 0;
    if (intervalMs <= 0) {
      throw new Error(
        `Invalid interval for routine "${routineName}": must be positive`,
      );
    }
    this.stopRoutine(routineName);
    const executionMode = this.getExecutionMode();
    console.log(
      `Starting routine "${routineName}" with interval ${intervalMs}ms (mode: ${executionMode})`,
    );

    if (executionMode === 'overlap' || executionMode === 'skip') {
      const id = setInterval(
        () => void this.executeRoutine(routineName, routineFn),
        intervalMs,
      );
      this.intervals.set(routineName, id);
      return id as unknown as number;
    }

    // wait mode: next timer is only set after current run completes
    let active = true;
    const run = async () => {
      if (!active) return;
      try {
        await this.executeRoutine(routineName, routineFn);
      } catch {
        // already logged
      }
      if (active) {
        const id = setTimeout(run, intervalMs);
        this.intervals.set(routineName, id);
      }
    };
    const first = setTimeout(run, 0);
    this.intervals.set(routineName, first);
    return 0;
  }

  stopRoutine(routineName: string): void {
    const h = this.intervals.get(routineName);
    if (h != null) {
      clearInterval(h);
      clearTimeout(h);
      this.intervals.delete(routineName);
      console.log(`Stopped routine: ${routineName}`);
    }
  }

  stopAllRoutines(): void {
    for (const [routineName, h] of this.intervals.entries()) {
      clearInterval(h);
      clearTimeout(h);
      console.log(`Stopped routine: ${routineName}`);
    }
    this.intervals.clear();
  }

  getRunningRoutines(): string[] {
    return Array.from(this.intervals.keys());
  }
}
