import { QueryDeepPartialEntity } from 'typeorm';
import { Notification } from '../../../../domain/entities/notification.entity';
import { AnyNotificationContext } from '../../../../domain/contexts/notification-context.map';
import { NotificationReference } from '../../../../domain/value-objects/notification-reference.value-object';
import { Recipient } from '../../../../domain/value-objects/recipient.value-object';
import { NotificationOrmEntity } from '../entities/notification.orm-entity';

export class NotificationMapper {
  static toOrm(notification: Notification): QueryDeepPartialEntity<NotificationOrmEntity> {
    return {
      id: notification.id ?? undefined,
      sourceEventId: notification.sourceEventId,
      recipientType: notification.recipient.type,
      recipientId: notification.recipient.id,
      type: notification.type,
      referenceType: notification.reference.type,
      referenceId: notification.reference.id,
      context: notification.context,
      status: notification.status,
    };
  }

  static toDomain(orm: NotificationOrmEntity): Notification {
    return Notification.fromPersistence({
      id: String(orm.id),
      sourceEventId: orm.sourceEventId,
      recipient: Recipient.create(orm.recipientType, String(orm.recipientId)),
      type: orm.type,
      reference: NotificationReference.create(orm.referenceType, orm.referenceId),
      context: orm.context as AnyNotificationContext,
      status: orm.status,
      createdAt: orm.createdAt ?? null,
      updatedAt: orm.updatedAt ?? null,
    });
  }
}
