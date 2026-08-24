import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  NOTIFICATION_DELIVERY_REPOSITORY,
  NOTIFICATION_OUTBOX_REPOSITORY,
  NOTIFICATION_REPOSITORY,
} from './application/ports/persistence';
import { NotificationDeliveryOrmEntity } from './infrastructure/persistence/typeorm/entities/notification-delivery.orm-entity';
import { NotificationOutboxOrmEntity } from './infrastructure/persistence/typeorm/entities/notification-outbox.orm-entity';
import { NotificationOrmEntity } from './infrastructure/persistence/typeorm/entities/notification.orm-entity';
import { TypeOrmNotificationDeliveryRepository } from './infrastructure/persistence/typeorm/repositories/typeorm-notification-delivery.repository';
import { TypeOrmNotificationOutboxRepository } from './infrastructure/persistence/typeorm/repositories/typeorm-notification-outbox.repository';
import { TypeOrmNotificationRepository } from './infrastructure/persistence/typeorm/repositories/typeorm-notification.repository';

/**
 * Notification library module.
 *
 * Registers the notification persistence entities and exposes the
 * application repository ports bound to their TypeORM implementations.
 * Requires a configured TypeORM connection (e.g. `DatabaseModule`).
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      NotificationOrmEntity,
      NotificationDeliveryOrmEntity,
      NotificationOutboxOrmEntity,
    ]),
  ],
  providers: [
    { provide: NOTIFICATION_REPOSITORY, useClass: TypeOrmNotificationRepository },
    { provide: NOTIFICATION_DELIVERY_REPOSITORY, useClass: TypeOrmNotificationDeliveryRepository },
    { provide: NOTIFICATION_OUTBOX_REPOSITORY, useClass: TypeOrmNotificationOutboxRepository },
  ],
  exports: [
    NOTIFICATION_REPOSITORY,
    NOTIFICATION_DELIVERY_REPOSITORY,
    NOTIFICATION_OUTBOX_REPOSITORY,
  ],
})
export class NotificationModule {}
