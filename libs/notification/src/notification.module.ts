import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullMqModule, BullMqRootOptions, QueueDefinition } from '@app/bullmq';
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
import { NotificationDeliveryOrmEntity } from './infrastructure/persistence/typeorm/entities/notification-delivery.orm-entity';
import { NotificationOutboxOrmEntity } from './infrastructure/persistence/typeorm/entities/notification-outbox.orm-entity';
import { NotificationOrmEntity } from './infrastructure/persistence/typeorm/entities/notification.orm-entity';
import { TypeOrmNotificationDeliveryRepository } from './infrastructure/persistence/typeorm/repositories/typeorm-notification-delivery.repository';
import { TypeOrmNotificationOutboxRepository } from './infrastructure/persistence/typeorm/repositories/typeorm-notification-outbox.repository';
import { TypeOrmNotificationRepository } from './infrastructure/persistence/typeorm/repositories/typeorm-notification.repository';
import { NOTIFICATION_QUEUE_NAMES } from './infrastructure/queue/bullmq/notification-delivery.job.helper';
import { NotificationQueuePublisher } from './infrastructure/queue/bullmq/notification-queue.publisher';
import { OUTBOX_SCHEDULER_CONFIG, NotificationOutboxScheduler } from './infrastructure/scheduler';

/** Delivery queues registered through the shared BullMqModule. */
const NOTIFICATION_QUEUE_DEFINITIONS: QueueDefinition[] = [
  { name: NOTIFICATION_QUEUE_NAMES.EMAIL },
  { name: NOTIFICATION_QUEUE_NAMES.WHATSAPP },
];

/**
 * Notification library module.
 *
 * Registers the notification persistence entities and exposes the
 * application repository ports bound to their TypeORM implementations.
 * Also registers the delivery queues through the shared BullMqModule, binds
 * the {@link QUEUE_PUBLISHER} port to its BullMQ adapter, and wires the
 * outbox publisher, retry policy, and scheduler.
 * Requires a configured TypeORM connection (e.g. `DatabaseModule`) and a
 * global `ConfigService` (e.g. `SharedConfigModule`).
 */
@Module({
  imports: [
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
  ],
})
export class NotificationModule {}
