import { NotificationDeliveryRepository } from './notification-delivery-repository.port';
import { NotificationOutboxRepository } from './notification-outbox-repository.port';
import { NotificationRepository } from './notification-repository.port';

/**
 * Injection token for the {@link NotificationTransaction}.
 */
export const NOTIFICATION_TRANSACTION = Symbol('NOTIFICATION_TRANSACTION');

export interface NotificationTransactionRepositories {
  readonly notifications: NotificationRepository;
  readonly deliveries: NotificationDeliveryRepository;
  readonly outbox: NotificationOutboxRepository;
}

export interface NotificationTransaction {
  run<T>(
    work: (repositories: NotificationTransactionRepositories) => Promise<T>,
  ): Promise<T>;
}
