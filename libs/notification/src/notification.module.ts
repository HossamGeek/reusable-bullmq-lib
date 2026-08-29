import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullMqModule, BullMqRootOptions, QueueDefinition } from '@app/bullmq';
import { Module, Provider } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { CreateNotificationHandler } from './application/services/handler/create-notification.handler';
import { NotificationApplicationService } from './application/services/notification-application.service';
import { NotificationRequestPreparation } from './application/services/notification-request-preparation.service';
import {
  NOTIFICATION_DELIVERY_REPOSITORY,
  NOTIFICATION_OUTBOX_REPOSITORY,
  NOTIFICATION_REPOSITORY,
  QUEUE_PUBLISHER,
} from './application/ports';
import { OUTBOX_PUBLISHER_CONFIG, OutboxPublisherConfig } from './application/config';
import {
  ExponentialRetryPolicy,
  RETRY_POLICY,
  RETRY_POLICY_CONFIG,
  RetryPolicyConfig,
} from './application/policies';
import { OUTBOX_PUBLISHER, OutboxPublisher } from './application/services';
import {
  NOTIFICATION_TRANSACTION,
} from './application/ports/persistence';
import { NotificationDeliveryOrmEntity } from './infrastructure/persistence/typeorm/entities/notification-delivery.orm-entity';
import { NotificationOutboxOrmEntity } from './infrastructure/persistence/typeorm/entities/notification-outbox.orm-entity';
import { NotificationOrmEntity } from './infrastructure/persistence/typeorm/entities/notification.orm-entity';
import { TypeOrmNotificationDeliveryRepository } from './infrastructure/persistence/typeorm/repositories/typeorm-notification-delivery.repository';
import { TypeOrmNotificationOutboxRepository } from './infrastructure/persistence/typeorm/repositories/typeorm-notification-outbox.repository';
import { TypeOrmNotificationRepository } from './infrastructure/persistence/typeorm/repositories/typeorm-notification.repository';
import { NOTIFICATION_QUEUE_NAMES } from './infrastructure/queue/bullmq/notification-delivery.job.helper';
import { NotificationQueuePublisher } from './infrastructure/queue/bullmq/notification-queue.publisher';
import { OUTBOX_SCHEDULER_CONFIG, NotificationOutboxScheduler } from './infrastructure/scheduler';
import { TypeOrmNotificationTransaction } from './infrastructure/persistence/typeorm/transactions';

/** Delivery queues registered through the shared BullMqModule. */
const NOTIFICATION_QUEUE_DEFINITIONS: QueueDefinition[] = [
  { name: NOTIFICATION_QUEUE_NAMES.EMAIL },
  { name: NOTIFICATION_QUEUE_NAMES.WHATSAPP },
];

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
    BullMqModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService): BullMqRootOptions => ({
        connection: {
          host: config.get<string>('REDIS_HOST'),
          port: config.get<number>('REDIS_PORT'),
          db: config.get<number>('REDIS_DB'),
          username: config.get<string>('REDIS_USERNAME'),
          password: config.get<string>('REDIS_PASSWORD'),
        },
        queuePrefix: config.get<string>('QUEUE_PREFIX'),
      }),
      queues: NOTIFICATION_QUEUE_DEFINITIONS,
    }),
  ],
  providers: [
    { provide: NOTIFICATION_REPOSITORY, useClass: TypeOrmNotificationRepository },
    { provide: NOTIFICATION_DELIVERY_REPOSITORY, useClass: TypeOrmNotificationDeliveryRepository },
    { provide: NOTIFICATION_OUTBOX_REPOSITORY, useClass: TypeOrmNotificationOutboxRepository },
    { provide: QUEUE_PUBLISHER, useClass: NotificationQueuePublisher },
    {
      provide: OUTBOX_PUBLISHER_CONFIG,
      inject: [ConfigService],
      useFactory: (config: ConfigService): OutboxPublisherConfig => ({
        batchSize: config.get<number>('OUTBOX_BATCH_SIZE', 100),
      }),
    },
    {
      provide: RETRY_POLICY_CONFIG,
      inject: [ConfigService],
      useFactory: (config: ConfigService): RetryPolicyConfig => ({
        baseDelayMs: config.get<number>('OUTBOX_RETRY_BASE_DELAY_MS', 1000),
        maxDelayMs: config.get<number>('OUTBOX_RETRY_MAX_DELAY_MS'),
      }),
    },
    {
      provide: RETRY_POLICY,
      inject: [RETRY_POLICY_CONFIG],
      useFactory: (config: RetryPolicyConfig) => new ExponentialRetryPolicy(config),
    },
    {
      provide: OUTBOX_SCHEDULER_CONFIG,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        intervalMs: config.get<number>('OUTBOX_POLL_INTERVAL_MS', 5000),
      }),
    },
    { provide: OUTBOX_PUBLISHER, useClass: OutboxPublisher },
    { provide: NOTIFICATION_TRANSACTION, useClass: TypeOrmNotificationTransaction },
    CreateNotificationHandler,
    NotificationOutboxScheduler,
  ],
  exports: [
    NOTIFICATION_REPOSITORY,
    NOTIFICATION_DELIVERY_REPOSITORY,
    NOTIFICATION_OUTBOX_REPOSITORY,
    QUEUE_PUBLISHER,
    OUTBOX_PUBLISHER_CONFIG,
    RETRY_POLICY,
    RETRY_POLICY_CONFIG,
    NOTIFICATION_TRANSACTION,
    CreateNotificationHandler,
    CqrsModule,
  ],
})
export class NotificationModule {}