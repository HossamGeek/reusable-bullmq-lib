import { NotificationType } from '../../../domain/enums/notification-type.enum';
import { RecipientType } from '../../../domain/enums/recipient-type.enum';
import { Notification } from '../../../domain/entities/notification.entity';

export const NOTIFICATION_REPOSITORY = Symbol('NOTIFICATION_REPOSITORY');

export interface FindNotificationBySourceEventParams {
  sourceEventId: string;
  recipientType: RecipientType;
  recipientId: string;
  type: NotificationType;
}

export interface NotificationRepository {
  save(notification: Notification): Promise<Notification>;
  findById(id: string): Promise<Notification | null>;
  findBySourceEventRecipientAndType(
    params: FindNotificationBySourceEventParams,
  ): Promise<Notification | null>;
}
