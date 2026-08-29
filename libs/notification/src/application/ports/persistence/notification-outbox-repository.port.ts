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

/**
 * Persistence port for the transactional outbox.
 *
 * A row is publishable while `published_at` is still null and either no
 * `next_publish_at` was scheduled or that time has been reached.
 */
export interface NotificationOutboxRepository {
  save(record: NotificationOutboxRecord): Promise<NotificationOutboxRecord>;
  findById(id: string): Promise<NotificationOutboxRecord | null>;
  findPublishable(options?: FindPublishableOptions): Promise<NotificationOutboxRecord[]>;
}
