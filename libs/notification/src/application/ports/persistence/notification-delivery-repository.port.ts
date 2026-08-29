import { NotificationDelivery } from '../../../domain/entities/notification-delivery.entity';

/** Injection token for the {@link NotificationDeliveryRepository} port. */
export const NOTIFICATION_DELIVERY_REPOSITORY = Symbol('NOTIFICATION_DELIVERY_REPOSITORY');

/**
 * Persistence port for per-channel deliveries of a notification.
 *
 * Uniqueness of `(notification_id, channel)` is enforced by the database.
 */
export interface NotificationDeliveryRepository {
  save(delivery: NotificationDelivery): Promise<NotificationDelivery>;
  findById(id: string): Promise<NotificationDelivery | null>;
  findDeliveriesByNotificationId(notificationId: string): Promise<NotificationDelivery[]>;
}
