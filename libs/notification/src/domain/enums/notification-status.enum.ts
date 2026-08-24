/**
 * Lifecycle of a notification aggregate.
 */
export enum NotificationStatus {
  /** Created, not yet picked up for delivery. */
  PENDING = 'PENDING',
  /** Delivery to the configured channels is in progress. */
  PROCESSING = 'PROCESSING',
  /** Delivered on every configured channel. */
  SENT = 'SENT',
  /** Delivered on some, but not all, configured channels. */
  PARTIALLY_SENT = 'PARTIALLY_SENT',
  /** Not delivered on any configured channel. */
  FAILED = 'FAILED',
  /** Cancelled before delivery completed. */
  CANCELLED = 'CANCELLED',
}
