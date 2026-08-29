import { Inject, Injectable } from '@nestjs/common';
import { OUTBOX_PUBLISHER_CONFIG, OutboxPublisherConfig } from '../config/outbox-publisher.config';
import { RETRY_POLICY, RetryPolicy } from '../policies/retry-policy';
import {
  NOTIFICATION_OUTBOX_REPOSITORY,
  NotificationOutboxRecord,
  NotificationOutboxRepository,
  OutboxPublishTransaction,
} from '../ports/persistence/notification-outbox-repository.port';
import { QUEUE_PUBLISHER, QueuePublisherPort } from '../ports/queue/queue-publisher.port';

/** Injection token for the {@link OutboxPublisher} service. */
export const OUTBOX_PUBLISHER = Symbol('OUTBOX_PUBLISHER');

@Injectable()
export class OutboxPublisher {
  constructor(
    @Inject(NOTIFICATION_OUTBOX_REPOSITORY)
    private readonly outbox: NotificationOutboxRepository,
    @Inject(QUEUE_PUBLISHER)
    private readonly publisher: QueuePublisherPort,
    @Inject(RETRY_POLICY)
    private readonly retryPolicy: RetryPolicy,
    @Inject(OUTBOX_PUBLISHER_CONFIG)
    private readonly config: OutboxPublisherConfig,
  ) {}

  /** Processes one bounded batch of publishable outbox rows. */
  async run(): Promise<void> {
    const now = new Date();

    await this.outbox.processPublishable({ limit: this.config.batchSize, now }, (records, tx) =>
      this.processBatch(records, tx, now),
    );
  }

  private async processBatch(
    records: NotificationOutboxRecord[],
    tx: OutboxPublishTransaction,
    now: Date,
  ): Promise<void> {
    for (const record of records) {
      // Each publish attempt increments the count, including the successful one.
      const publishAttempts = record.publishAttempts + 1;

      try {
        await this.publisher.publishDelivery({
          deliveryId: record.deliveryId,
          channel: record.channel,
        });
        await tx.markPublished(record.id as string, now, publishAttempts);
      } catch (error) {
        const nextPublishAt = this.nextRetryAt(publishAttempts, now);
        const message = this.errorMessage(error);
        await tx.schedulePublishRetry(record.id as string, nextPublishAt, message, publishAttempts);
      }
    }
  }

  private nextRetryAt(attempt: number, now: Date): Date {
    return new Date(now.getTime() + this.retryPolicy.nextRetryDelayMs(attempt));
  }

  private errorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    return String(error);
  }
}
