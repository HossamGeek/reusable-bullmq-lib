import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import {
  OUTBOX_PUBLISHER,
  OutboxPublisher,
} from '../../application/services/outbox-publisher.service';
import { OUTBOX_SCHEDULER_CONFIG, OutboxSchedulerConfig } from './outbox-scheduler.config';

@Injectable()
export class NotificationOutboxScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationOutboxScheduler.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    @Inject(OUTBOX_PUBLISHER)
    private readonly outboxPublisher: OutboxPublisher,
    @Inject(OUTBOX_SCHEDULER_CONFIG)
    private readonly config: OutboxSchedulerConfig,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => void this.tick(), this.config.intervalMs);
    this.timer.unref?.();
    this.logger.log(`outbox scheduler started intervalMs=${this.config.intervalMs}`);
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.logger.log('outbox scheduler stopped');
  }

  /** Runs one poll; skips when a previous invocation is still in flight. */
  async tick(): Promise<void> {
    if (this.running) {
      this.logger.debug('outbox scheduler tick skipped (previous run in progress)');
      return;
    }
    this.running = true;
    try {
      await this.outboxPublisher.run();
    } catch (error) {
      this.logger.error(
        `outbox scheduler tick failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      this.running = false;
    }
  }
}
