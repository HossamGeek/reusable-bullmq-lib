import { QueryDeepPartialEntity } from 'typeorm';
import { NotificationOutboxRecord } from '../../../../application/ports/persistence/notification-outbox-repository.port';
import { NotificationOutboxOrmEntity } from '../entities/notification-outbox.orm-entity';

export class NotificationOutboxMapper {
  static toOrm(
    record: NotificationOutboxRecord,
  ): QueryDeepPartialEntity<NotificationOutboxOrmEntity> {
    return {
      id: record.id ?? undefined,
      delivery: { id: record.deliveryId },
      publishedAt: record.publishedAt ?? null,
      publishAttempts: record.publishAttempts,
      lastPublishError: record.lastPublishError ?? null,
      nextPublishAt: record.nextPublishAt ?? null,
      createdAt: record.createdAt ?? undefined,
    };
  }

  static toRecord(orm: NotificationOutboxOrmEntity): NotificationOutboxRecord {
    if (!orm.delivery) {
      throw new Error('NotificationOutbox row is missing its delivery relation.');
    }
    return {
      id: String(orm.id),
      deliveryId: String(orm.delivery.id),
      channel: orm.delivery.channel,
      publishedAt: orm.publishedAt ?? null,
      publishAttempts: Number(orm.publishAttempts),
      lastPublishError: orm.lastPublishError ?? null,
      nextPublishAt: orm.nextPublishAt ?? null,
      createdAt: orm.createdAt ?? null,
    };
  }
}
