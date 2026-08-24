/**
 * Lifecycle of a single channel delivery attempt record.
 */
export enum NotificationDeliveryStatus {
  /** Created, not yet handed to the channel provider. */
  PENDING = 'PENDING',
  /** Provider send attempt in progress. */
  PROCESSING = 'PROCESSING',
  /** Accepted by the channel provider. */
  SENT = 'SENT',
  /** Provider rejected or failed the send. */
  FAILED = 'FAILED',
  /** Cancelled before the provider send completed. */
  CANCELLED = 'CANCELLED',
}
