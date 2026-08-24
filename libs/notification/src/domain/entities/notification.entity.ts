import { NotificationStatus } from '../enums/notification-status.enum';
import { NotificationType } from '../enums/notification-type.enum';
import {
  AnyNotificationContext,
  NotificationContext,
} from '../contexts/notification-context.map';
import { NotificationReference } from '../value-objects/notification-reference.value-object';
import { Recipient } from '../value-objects/recipient.value-object';

export interface CreateNotificationParams {
  sourceEventId: string;
  recipient: Recipient;
  type: NotificationType;
  reference: NotificationReference;
  context: AnyNotificationContext;
}
export class Notification {
  private constructor(
    readonly id: string | null,
    readonly sourceEventId: string,
    readonly recipient: Recipient,
    readonly type: NotificationType,
    readonly reference: NotificationReference,
    readonly context: AnyNotificationContext,
    readonly status: NotificationStatus,
    readonly createdAt: Date | null,
    readonly updatedAt: Date | null,
  ) {}

  /** Creates a new `PENDING` notification not yet known to persistence. */
  static create(params: CreateNotificationParams): Notification {
    if (!params.sourceEventId || !params.sourceEventId.trim()) {
      throw new Error('Notification sourceEventId is required.');
    }

    if (!(params.recipient instanceof Recipient)) {
      throw new Error('Notification recipient is required.');
    }
    if (!params.type) {
      throw new Error('Notification type is required.');
    }
    if (!(params.reference instanceof NotificationReference)) {
      throw new Error('Notification reference is required.');
    }

    if (
      params.context === null ||
      params.context === undefined ||
      typeof params.context !== 'object'
    ) {
      throw new Error('Notification context is required.');
    }

    return new Notification(
      null,
      params.sourceEventId,
      params.recipient,
      params.type,
      params.reference,
      params.context,
      NotificationStatus.PENDING,
      null,
      null,
    );
  }

  /**
   * Rebuilds an existing aggregate from persistence data.
   *
   * There is no aggregate-level `sentAt`: per-channel send timestamps live on
   * `NotificationDelivery`, keeping the notification table exactly at the
   * specified column set.
   */
  static fromPersistence(data: {
    id: string;
    sourceEventId: string;
    recipient: Recipient;
    type: NotificationType;
    reference: NotificationReference;
    context: AnyNotificationContext;
    status: NotificationStatus;
    createdAt: Date | null;
    updatedAt: Date | null;
  }): Notification {
    return new Notification(
      data.id,
      data.sourceEventId,
      data.recipient,
      data.type,
      data.reference,
      data.context,
      data.status,
      data.createdAt,
      data.updatedAt,
    );
  }

  /** Returns the notification context narrowed to its concrete contract. */
  typedContext<T extends NotificationType>(type: T): NotificationContext<T> {
    if (this.type !== type) {
      throw new Error(`Notification type ${this.type} does not match requested ${type}.`);
    }
    return this.context as NotificationContext<T>;
  }
}
