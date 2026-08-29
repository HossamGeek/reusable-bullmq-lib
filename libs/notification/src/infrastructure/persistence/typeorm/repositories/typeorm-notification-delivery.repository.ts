import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, Repository } from 'typeorm';
import { NotificationDelivery } from '../../../../domain/entities/notification-delivery.entity';
import { NotificationDeliveryRepository } from '../../../../application/ports/persistence/notification-delivery-repository.port';
import { NotificationDeliveryOrmEntity } from '../entities/notification-delivery.orm-entity';
import { NotificationDeliveryMapper } from '../mappers/notification-delivery.mapper';

@Injectable()
export class TypeOrmNotificationDeliveryRepository implements NotificationDeliveryRepository {
  constructor(
    @InjectRepository(NotificationDeliveryOrmEntity)
    private readonly repository: Repository<NotificationDeliveryOrmEntity>,
  ) {}

  async save(delivery: NotificationDelivery): Promise<NotificationDelivery> {
    const saved = await this.repository.save(
      NotificationDeliveryMapper.toOrm(delivery) as DeepPartial<NotificationDeliveryOrmEntity>,
    );
    return NotificationDeliveryMapper.toDomain(saved);
  }

  async findById(id: string): Promise<NotificationDelivery | null> {
    const orm = await this.repository.findOne({
      where: { id },
      relations: {
        notification: true,
      },
    });
    return orm ? NotificationDeliveryMapper.toDomain(orm) : null;
  }

  async findDeliveriesByNotificationId(notificationId: string): Promise<NotificationDelivery[]> {
    const rows = await this.repository.find({
      where: { notification: { id: notificationId } },
      relations: {
        notification: true,
      },
      order: { createdAt: 'ASC' },
    });
    return rows.map((row) => NotificationDeliveryMapper.toDomain(row));
  }
}
