import { NotificationChannel } from '../../domain/enums/notification-channel.enum';
import { NotificationType } from '../../domain/enums/notification-type.enum';
import { RecipientType } from '../../domain/enums/recipient-type.enum';
import { ReferenceType } from '../../domain/enums/reference-type.enum';

export interface NotificationInputRecipient {
  readonly type: RecipientType;
  readonly id: string;
}

export interface NotificationInputReference {
  readonly type: ReferenceType;
  readonly id: string;
}

export interface NotificationInput<T extends NotificationType = NotificationType> {
  readonly sourceEventId: string;
  readonly type: T;
  readonly recipient: NotificationInputRecipient;
  readonly reference: NotificationInputReference;
  readonly channels: readonly NotificationChannel[];
}