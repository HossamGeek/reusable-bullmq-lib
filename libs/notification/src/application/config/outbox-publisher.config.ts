export interface OutboxPublisherConfig {
  /** Maximum number of rows processed per batch. */
  batchSize: number;
}

/** Injection token for the {@link OutboxPublisherConfig} value. */
export const OUTBOX_PUBLISHER_CONFIG = Symbol('OUTBOX_PUBLISHER_CONFIG');
