import { NotificationChannel } from '../enums/notification-channel.enum';
import { NotificationDeliveryStatus } from '../enums/notification-delivery-status.enum';

export interface CreateNotificationDeliveryParams {
  notificationId: string;
  channel: NotificationChannel;
  recipientAddress: string;
}

export class NotificationDelivery {
  private constructor(
    readonly id: string | null,
    readonly notificationId: string,
    readonly channel: NotificationChannel,
    readonly recipientAddress: string,
    readonly status: NotificationDeliveryStatus,
    readonly attemptCount: number,
    readonly providerMessageId: string | null,
    readonly lastError: string | null,
    readonly sentAt: Date | null,
    readonly createdAt: Date | null,
    readonly updatedAt: Date | null,
  ) {}

  /** Creates a new `PENDING` delivery with a zeroed attempt counter. */
  static create(params: CreateNotificationDeliveryParams): NotificationDelivery {
    if (!params.notificationId || !params.notificationId.trim()) {
      throw new Error('NotificationDelivery notificationId is required.');
    }
    if (!params.recipientAddress || !params.recipientAddress.trim()) {
      throw new Error('NotificationDelivery recipientAddress is required.');
    }
    return new NotificationDelivery(
      null,
      params.notificationId,
      params.channel,
      params.recipientAddress,
      NotificationDeliveryStatus.PENDING,
      0,
      null,
      null,
      null,
      null,
      null,
    );
  }

  /** Rebuilds an existing delivery from persistence data. */
  static fromPersistence(data: {
    id: string;
    notificationId: string;
    channel: NotificationChannel;
    recipientAddress: string;
    status: NotificationDeliveryStatus;
    attemptCount: number;
    providerMessageId: string | null;
    lastError: string | null;
    sentAt: Date | null;
    createdAt: Date | null;
    updatedAt: Date | null;
  }): NotificationDelivery {
    return new NotificationDelivery(
      data.id,
      data.notificationId,
      data.channel,
      data.recipientAddress,
      data.status,
      data.attemptCount,
      data.providerMessageId,
      data.lastError,
      data.sentAt,
      data.createdAt,
      data.updatedAt,
    );
  }
}
