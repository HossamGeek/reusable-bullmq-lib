import { Module, Provider } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CreateNotificationHandler } from './application/services/handler/create-notification.handler';
import { NotificationApplicationService } from './application/services/notification-application.service';
import { NotificationRequestPreparation } from './application/services/notification-request-preparation.service';
import {
  NOTIFICATION_DELIVERY_REPOSITORY,
  NOTIFICATION_OUTBOX_REPOSITORY,
  NOTIFICATION_REPOSITORY,
  NOTIFICATION_TRANSACTION,
} from './application/ports/persistence';
import { NotificationDeliveryOrmEntity } from './infrastructure/persistence/typeorm/entities/notification-delivery.orm-entity';
import { NotificationOutboxOrmEntity } from './infrastructure/persistence/typeorm/entities/notification-outbox.orm-entity';
import { NotificationOrmEntity } from './infrastructure/persistence/typeorm/entities/notification.orm-entity';
import { TypeOrmNotificationDeliveryRepository } from './infrastructure/persistence/typeorm/repositories/typeorm-notification-delivery.repository';
import { TypeOrmNotificationOutboxRepository } from './infrastructure/persistence/typeorm/repositories/typeorm-notification-outbox.repository';
import { TypeOrmNotificationRepository } from './infrastructure/persistence/typeorm/repositories/typeorm-notification.repository';
import { TypeOrmNotificationTransaction } from './infrastructure/persistence/typeorm/transactions';

/**
 * Workflow providers that depend on the recipient/context resolver ports.
 *
 * This repository ships no real infrastructure for
 * `RECIPIENT_DESTINATION_RESOLVER` / `NOTIFICATION_CONTEXT_RESOLVER` (the
 * owning data sources do not exist here), so these providers are NOT
 * registered statically. Host applications bind both resolver tokens to real
 * implementations and then spread this array into their module providers:
 *
 * ```ts
 * @Module({
 *   imports: [NotificationModule],
 *   providers: [
 *     { provide: RECIPIENT_DESTINATION_RESOLVER, useClass: MyDestinationResolver },
 *     { provide: NOTIFICATION_CONTEXT_RESOLVER, useClass: MyContextResolver },
 *     ...NOTIFICATION_WORKFLOW_PROVIDERS,
 *   ],
 * })
 * ```
 *
 * `CommandBus` is available to these providers because `NotificationModule`
 * imports and re-exports `CqrsModule`.
 */
export const NOTIFICATION_WORKFLOW_PROVIDERS: Provider[] = [
  NotificationRequestPreparation,
  NotificationApplicationService,
];

@Module({
  imports: [
    CqrsModule,
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
    { provide: NOTIFICATION_TRANSACTION, useClass: TypeOrmNotificationTransaction },
    CreateNotificationHandler,
  ],
  exports: [
    NOTIFICATION_REPOSITORY,
    NOTIFICATION_DELIVERY_REPOSITORY,
    NOTIFICATION_OUTBOX_REPOSITORY,
    NOTIFICATION_TRANSACTION,
    CreateNotificationHandler,
    CqrsModule,
  ],
})
export class NotificationModule {}