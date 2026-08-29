/** Configuration for the outbox scheduler interval. */
export interface OutboxSchedulerConfig {
  /** Interval between polls in milliseconds. */
  intervalMs: number;
}

/** Injection token for the {@link OutboxSchedulerConfig} value. */
export const OUTBOX_SCHEDULER_CONFIG = Symbol('OUTBOX_SCHEDULER_CONFIG');
