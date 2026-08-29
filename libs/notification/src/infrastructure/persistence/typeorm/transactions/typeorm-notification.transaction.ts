import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';

import { DuplicateNotificationError } from '../../../../application/errors';
import {
  NotificationTransaction,
  NotificationTransactionRepositories,
} from '../../../../application/ports/persistence';

import { NotificationDeliveryOrmEntity } from '../entities/notification-delivery.orm-entity';
import { NotificationOutboxOrmEntity } from '../entities/notification-outbox.orm-entity';
import { NotificationOrmEntity } from '../entities/notification.orm-entity';

import { TypeOrmNotificationDeliveryRepository } from '../repositories/typeorm-notification-delivery.repository';
import { TypeOrmNotificationOutboxRepository } from '../repositories/typeorm-notification-outbox.repository';
import { TypeOrmNotificationRepository } from '../repositories/typeorm-notification.repository';

/** PostgreSQL driver error fields the duplicate detection inspects. */
interface PostgresErrorFields {
  code?: string;
  constraint?: string;
  driverError?: unknown;
}

@Injectable()
export class TypeOrmNotificationTransaction implements NotificationTransaction {
  constructor(private readonly dataSource: DataSource) {}

  async run<T>(
    work: (repositories: NotificationTransactionRepositories) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.dataSource.transaction((manager) => work(this.createRepositories(manager)));
    } catch (error) {
      if (this.isDuplicateNotification(error)) {
        throw new DuplicateNotificationError({
          cause: error,
        });
      }

      throw error;
    }
  }

  private createRepositories(manager: EntityManager): NotificationTransactionRepositories {
    return {
      notifications: new TypeOrmNotificationRepository(
        manager.getRepository(NotificationOrmEntity),
      ),

      deliveries: new TypeOrmNotificationDeliveryRepository(
        manager.getRepository(NotificationDeliveryOrmEntity),
      ),

      outbox: new TypeOrmNotificationOutboxRepository(
        manager.getRepository(NotificationOutboxOrmEntity),
      ),
    };
  }

  private isDuplicateNotification(error: unknown): boolean {
    const direct =
      error !== null && typeof error === 'object'
        ? (error as PostgresErrorFields)
        : undefined;
    const nested =
      direct?.driverError !== null && typeof direct?.driverError === 'object'
        ? (direct.driverError as PostgresErrorFields)
        : undefined;

    const code = direct?.code ?? nested?.code;
    const constraint = direct?.constraint ?? nested?.constraint;

    return (
      code === '23505' &&
      constraint === 'UQ_notifications_source_recipient_type'
    );
  }
}
