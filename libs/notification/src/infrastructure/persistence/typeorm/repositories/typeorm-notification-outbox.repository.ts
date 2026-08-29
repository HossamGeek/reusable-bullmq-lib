import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DeepPartial,
  FindOptionsWhere,
  IsNull,
  LessThanOrEqual,
  Repository,
} from 'typeorm';
import {
  FindPublishableOptions,
  NotificationOutboxRecord,
  NotificationOutboxRepository,
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
