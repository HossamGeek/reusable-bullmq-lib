import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DeepPartial,
  EntityManager,
  FindOptionsWhere,
  IsNull,
  LessThanOrEqual,
  Repository,
} from 'typeorm';
import {
  FindPublishableOptions,
  NotificationOutboxRecord,
  NotificationOutboxRepository,
  OutboxPublishTransaction,
} from '../../../../application/ports/persistence/notification-outbox-repository.port';
import { NotificationOutboxOrmEntity } from '../entities/notification-outbox.orm-entity';
import { NotificationOutboxMapper } from '../mappers/notification-outbox.mapper';

@Injectable()
export class TypeOrmNotificationOutboxRepository implements NotificationOutboxRepository {
  constructor(
    @InjectRepository(NotificationOutboxOrmEntity)
    private readonly repository: Repository<NotificationOutboxOrmEntity>,
  ) {}

  async save(record: NotificationOutboxRecord): Promise<NotificationOutboxRecord> {
    const saved = await this.repository.save(
      NotificationOutboxMapper.toOrm(record) as DeepPartial<NotificationOutboxOrmEntity>,
    );
    return NotificationOutboxMapper.toRecord(saved);
  }

  async findById(id: string): Promise<NotificationOutboxRecord | null> {
    const orm = await this.repository.findOne({
      where: { id },
      relations: {
        delivery: true,
      },
    });
    return orm ? NotificationOutboxMapper.toRecord(orm) : null;
  }

  async findPublishable(options?: FindPublishableOptions): Promise<NotificationOutboxRecord[]> {
    const now = options?.now ?? new Date();
    const limit = options?.limit ?? 100;
    const rows = await this.repository.find({
      where: this.publishableCriteria(now),
      order: { createdAt: 'ASC' },
      take: limit,
      relations: {
        delivery: true,
      },
    });
    return rows.map((row) => NotificationOutboxMapper.toRecord(row));
  }

  async processPublishable<T>(
    options: FindPublishableOptions,
    processor: (records: NotificationOutboxRecord[], tx: OutboxPublishTransaction) => Promise<T>,
  ): Promise<T> {
    const now = options?.now ?? new Date();
    const limit = options?.limit ?? 100;

    return this.repository.manager.transaction(async (manager) => {
      const repo = manager.getRepository(NotificationOutboxOrmEntity);
      const rows = await repo.find({
        where: this.publishableCriteria(now),
        order: { createdAt: 'ASC' },
        take: limit,
        relations: {
          delivery: true,
        },
        lock: { mode: 'pessimistic_write', onLocked: 'skip_locked' },
      });

      const records = rows.map((row) => NotificationOutboxMapper.toRecord(row));
      const tx: OutboxPublishTransaction = {
        markPublished: (recordId, publishedAt, publishAttempts) =>
          this.markPublishedIn(manager, recordId, publishedAt, publishAttempts),
        schedulePublishRetry: (recordId, nextPublishAt, error, publishAttempts) =>
          this.schedulePublishRetryIn(manager, recordId, nextPublishAt, error, publishAttempts),
      };

      return processor(records, tx);
    });
  }

  async markPublished(recordId: string, publishedAt: Date, publishAttempts: number): Promise<void> {
    await this.repository.update(
      { id: recordId },
      { publishedAt, lastPublishError: null, nextPublishAt: null, publishAttempts },
    );
  }

  async schedulePublishRetry(
    recordId: string,
    nextPublishAt: Date,
    error: string,
    publishAttempts: number,
  ): Promise<void> {
    await this.repository.update(
      { id: recordId },
      { lastPublishError: error, nextPublishAt, publishAttempts },
    );
  }

  private async markPublishedIn(
    manager: EntityManager,
    recordId: string,
    publishedAt: Date,
    publishAttempts: number,
  ): Promise<void> {
    await manager.update(
      NotificationOutboxOrmEntity,
      { id: recordId },
      { publishedAt, lastPublishError: null, nextPublishAt: null, publishAttempts },
    );
  }

  private async schedulePublishRetryIn(
    manager: EntityManager,
    recordId: string,
    nextPublishAt: Date,
    error: string,
    publishAttempts: number,
  ): Promise<void> {
    await manager.update(
      NotificationOutboxOrmEntity,
      { id: recordId },
      { lastPublishError: error, nextPublishAt, publishAttempts },
    );
  }

  /**
   * Rows are publishable when never published and either unscheduled
   * (publish immediately) or due at or before `now`.
   */
  private publishableCriteria(now: Date): FindOptionsWhere<NotificationOutboxOrmEntity>[] {
    return [
      { publishedAt: IsNull(), nextPublishAt: IsNull() },
      { publishedAt: IsNull(), nextPublishAt: LessThanOrEqual(now) },
    ];
  }
}
