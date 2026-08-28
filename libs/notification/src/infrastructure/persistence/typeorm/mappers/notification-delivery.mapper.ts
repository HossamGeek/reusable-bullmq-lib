import { QueryDeepPartialEntity } from 'typeorm';
import { NotificationDelivery } from '../../../../domain/entities/notification-delivery.entity';
import { NotificationDeliveryOrmEntity } from '../entities/notification-delivery.orm-entity';

export class NotificationDeliveryMapper {
  static toOrm(
    delivery: NotificationDelivery,
  ): QueryDeepPartialEntity<NotificationDeliveryOrmEntity> {
    return {
      id: delivery.id ?? undefined,
      notification: { id: delivery.notificationId },
      channel: delivery.channel,
      recipientAddress: delivery.recipientAddress,
      status: delivery.status,
      attemptCount: delivery.attemptCount,
      providerMessageId: delivery.providerMessageId ?? null,
      lastError: delivery.lastError ?? null,
      sentAt: delivery.sentAt ?? null,
    };
  }

  static toDomain(orm: NotificationDeliveryOrmEntity): NotificationDelivery {
    if (!orm.notification) {
      throw new Error('NotificationDelivery row is missing its notification relation.');
    }
    return NotificationDelivery.fromPersistence({
      id: String(orm.id),
      notificationId: String(orm.notification.id),
      channel: orm.channel,
      recipientAddress: orm.recipientAddress,
      status: orm.status,
      attemptCount: Number(orm.attemptCount),
      providerMessageId: orm.providerMessageId ?? null,
      lastError: orm.lastError ?? null,
      sentAt: orm.sentAt ?? null,
      createdAt: orm.createdAt ?? null,
      updatedAt: orm.updatedAt ?? null,
    });
  }
}
