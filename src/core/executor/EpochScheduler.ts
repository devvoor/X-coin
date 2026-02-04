import { logger } from '../../utils/logger.js';
import { config } from '../../config/env.js';

export class EpochScheduler {
  private intervalSeconds: number;
  private callback: () => Promise<void>;
  private intervalHandle: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(callback: () => Promise<void>, intervalSeconds?: number) {
    this.callback = callback;
    this.intervalSeconds = intervalSeconds || config.EPOCH_INTERVAL_SECONDS;
  }

  start(): void {
    if (this.isRunning) {
      logger.warn('Scheduler already running');
      return;
    }

    this.isRunning = true;
    logger.info({ intervalSeconds: this.intervalSeconds }, 'Starting epoch scheduler');

    // Run immediately
    this.runEpoch().catch((error) => {
      logger.error({ error }, 'Error in initial epoch');
    });

    // Then run on interval
    this.intervalHandle = setInterval(() => {
      this.runEpoch().catch((error) => {
        logger.error({ error }, 'Error in scheduled epoch');
      });
    }, this.intervalSeconds * 1000);
  }

  stop(): void {
    if (!this.isRunning) {
      logger.warn('Scheduler not running');
      return;
    }

    logger.info('Stopping epoch scheduler');
    this.isRunning = false;

    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
  }

  isActive(): boolean {
    return this.isRunning;
  }

  private async runEpoch(): Promise<void> {
    try {
      await this.callback();
    } catch (error) {
      logger.error({ error }, 'Epoch execution failed');
    }
  }
}
