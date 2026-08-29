import { NotificationChannel } from '../../../domain/enums/notification-channel.enum';

/**
 * Injection token for the {@link NotificationOutboxRepository} port.
 */
export const NOTIFICATION_OUTBOX_REPOSITORY = Symbol('NOTIFICATION_OUTBOX_REPOSITORY');

/**
 * Outbox row contract.
 */
export interface NotificationOutboxRecord {
  /** Persistence id; `null` marks a row not yet inserted. */
  id: string | null;
  deliveryId: string;
  channel: NotificationChannel;
  publishedAt: Date | null;
  publishAttempts: number;
  lastPublishError: string | null;
  nextPublishAt: Date | null;
  createdAt: Date | null;
}

export interface FindPublishableOptions {
  /** Maximum number of rows to return. Defaults to 100. */
  limit?: number;
  /** Evaluation clock; defaults to `new Date()`. */
  now?: Date;
}

export interface OutboxPublishTransaction {
  /**
   * Marks a row published. Clears the last error and next retry while
   * persisting the given `publishAttempts` (the count already incremented
   * for this attempt).
   */
  markPublished(recordId: string, publishedAt: Date, publishAttempts: number): Promise<void>;
  /**
   * Schedules a retry for a failed row. Leaves the row unpublished, persists
   * the given `publishAttempts`, and stores the latest error and next retry.
   */
  schedulePublishRetry(
    recordId: string,
    nextPublishAt: Date,
    error: string,
    publishAttempts: number,
  ): Promise<void>;
}

export interface NotificationOutboxRepository {
  save(record: NotificationOutboxRecord): Promise<NotificationOutboxRecord>;
  findById(id: string): Promise<NotificationOutboxRecord | null>;
  findPublishable(options?: FindPublishableOptions): Promise<NotificationOutboxRecord[]>;
  processPublishable<T>(
    options: FindPublishableOptions,
    processor: (records: NotificationOutboxRecord[], tx: OutboxPublishTransaction) => Promise<T>,
  ): Promise<T>;
  /** Marks a single row published outside a batch transaction. */
  markPublished(recordId: string, publishedAt: Date, publishAttempts: number): Promise<void>;
  /** Schedules a retry for a single row outside a batch transaction. */
  schedulePublishRetry(
    recordId: string,
    nextPublishAt: Date,
    error: string,
    publishAttempts: number,
  ): Promise<void>;
}
