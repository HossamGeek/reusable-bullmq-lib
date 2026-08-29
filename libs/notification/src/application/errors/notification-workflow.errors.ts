import { NotificationChannel } from '../../domain/enums/notification-channel.enum';
// we'll change it to I18N later
export class NotificationWorkflowError extends Error {
  protected constructor(
    message: string,
    readonly code: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = new.target.name;
  }
}

/** A commanded channel has no destination address to snapshot. */
export class MissingDestinationError extends NotificationWorkflowError {
  constructor(readonly channel: NotificationChannel, options?: ErrorOptions) {
    super(
      `No recipient address is available for channel ${channel}.`,
      'NOTIFICATION_DESTINATION_MISSING',
      options,
    );
  }
}

/**
 * Idempotency signal: a notification with the same
 * `(sourceEventId, recipientType, recipientId, type)` tuple already exists.
 *
 * Raised only for PostgreSQL `23505` on constraint
 * `UQ_notifications_source_recipient_type`; every other database error keeps
 * its original shape. The original driver error is preserved as `cause`.
 */
export class DuplicateNotificationError extends NotificationWorkflowError {
  constructor(options?: ErrorOptions) {
    super(
      'A notification for this source event, recipient, and type already exists.',
      'DUPLICATE_NOTIFICATION',
      options,
    );
  }
}