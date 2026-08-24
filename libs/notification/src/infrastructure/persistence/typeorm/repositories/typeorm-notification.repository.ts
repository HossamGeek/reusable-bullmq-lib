import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, Repository } from 'typeorm';
import { Notification } from '../../../../domain/entities/notification.entity';
import {
  FindNotificationBySourceEventParams,
  NotificationRepository,
} from '../../../../application/ports/persistence/notification-repository.port';
import { NotificationOrmEntity } from '../entities/notification.orm-entity';
import { NotificationMapper } from '../mappers/notification.mapper';

@Injectable()
export class TypeOrmNotificationRepository implements NotificationRepository {
  constructor(
    @InjectRepository(NotificationOrmEntity)
    private readonly repository: Repository<NotificationOrmEntity>,
  ) {}

  async save(notification: Notification): Promise<Notification> {
    const saved = await this.repository.save(
      NotificationMapper.toOrm(notification) as DeepPartial<NotificationOrmEntity>,
    );
    return NotificationMapper.toDomain(saved);
  }

  async findById(id: string): Promise<Notification | null> {
    const orm = await this.repository.findOne({ where: { id } });
    return orm ? NotificationMapper.toDomain(orm) : null;
  }

  async findBySourceEventRecipientAndType(
    params: FindNotificationBySourceEventParams,
  ): Promise<Notification | null> {
    const orm = await this.repository.findOne({
      where: {
        sourceEventId: params.sourceEventId,
        recipientType: params.recipientType,
        recipientId: params.recipientId,
        type: params.type,
      },
    });
    return orm ? NotificationMapper.toDomain(orm) : null;
  }
}
