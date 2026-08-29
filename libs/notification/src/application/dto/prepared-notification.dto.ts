import { NotificationChannel } from '../../domain/enums/notification-channel.enum';
import { NotificationContextMap } from '../../domain/contexts/notification-context.map';
import { NotificationType } from '../../domain/enums/notification-type.enum';
import {
  NotificationInputRecipient,
  NotificationInputReference,
} from './notification-input.dto';

export interface PreparedDestinations {
  readonly email?: string;
  readonly whatsapp?: string;
}

export interface PreparedNotification<T extends NotificationType = NotificationType> {
  readonly sourceEventId: string;
  readonly type: T;
  readonly recipient: NotificationInputRecipient;
  readonly channels: readonly NotificationChannel[];
  readonly destinations: PreparedDestinations;
  readonly reference: NotificationInputReference;
  readonly context: NotificationContextMap[T];
}