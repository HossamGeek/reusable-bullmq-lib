import { NotificationType } from '../enums/notification-type.enum';
import { OrderCreatedContext } from './order-created.context';
import { OrderDeliveredContext } from './order-delivered.context';

export interface NotificationContextMap extends Record<NotificationType, unknown> {
  [NotificationType.ORDER_CREATED]: OrderCreatedContext;
  [NotificationType.ORDER_DELIVERED]: OrderDeliveredContext;
}

/** Typed context resolved from a concrete notification type. */
export type NotificationContext<T extends NotificationType> = NotificationContextMap[T];

/** Union of every valid notification context. */
export type AnyNotificationContext = NotificationContextMap[NotificationType];
