import { Repository } from 'typeorm';
import { NotificationChannel } from '../../../../domain/enums/notification-channel.enum';
import { NotificationDeliveryStatus } from '../../../../domain/enums/notification-delivery-status.enum';
import { NotificationDelivery } from '../../../../domain/entities/notification-delivery.entity';
import { NotificationOrmEntity } from '../entities/notification.orm-entity';
import { NotificationDeliveryOrmEntity } from '../entities/notification-delivery.orm-entity';
import { TypeOrmNotificationDeliveryRepository } from './typeorm-notification-delivery.repository';

describe('TypeOrmNotificationDeliveryRepository', () => {
  const sentAt = new Date('2026-08-23T10:05:00Z');
  const savedRow = {
    id: '11',
    notification: { id: '7' } as NotificationOrmEntity,
    channel: NotificationChannel.EMAIL,
    recipientAddress: 'client@example.com',
    status: NotificationDeliveryStatus.PENDING,
    attemptCount: 0,
    providerMessageId: null,
    lastError: null,
    sentAt: null,
    createdAt: sentAt,
    updatedAt: sentAt,
  } as unknown as NotificationDeliveryOrmEntity;

  const buildDelivery = () =>
    NotificationDelivery.create({
      notificationId: '7',
      channel: NotificationChannel.EMAIL,
      recipientAddress: 'client@example.com',
    });

  it('saves deliveries and maps the persisted row back to the domain', async () => {
    const save = jest.fn().mockResolvedValue(savedRow);
    const repository = new TypeOrmNotificationDeliveryRepository(
      { save } as unknown as Repository<NotificationDeliveryOrmEntity>,
    );

    const result = await repository.save(buildDelivery());

    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        notification: { id: '7' },
        channel: NotificationChannel.EMAIL,
        recipientAddress: 'client@example.com',
        status: NotificationDeliveryStatus.PENDING,
        attemptCount: 0,
      }),
    );
    expect(result.id).toBe('11');
    expect(result.notificationId).toBe('7');
  });

  it('loads the notification relation when finding by id', async () => {
    const findOne = jest.fn().mockResolvedValue(savedRow);
    const repository = new TypeOrmNotificationDeliveryRepository({
      findOne,
    } as unknown as Repository<NotificationDeliveryOrmEntity>);

    const result = await repository.findById('11');

    expect(result?.recipientAddress).toBe('client@example.com');
    expect(findOne).toHaveBeenCalledWith({
      where: { id: '11' },
      relations: { notification: true },
    });
  });

  it('lists deliveries of a notification ordered by creation', async () => {
    const find = jest.fn().mockResolvedValue([savedRow]);
    const repository = new TypeOrmNotificationDeliveryRepository({
      find,
    } as unknown as Repository<NotificationDeliveryOrmEntity>);

    const result = await repository.findDeliveriesByNotificationId('7');

    expect(result.map((delivery) => delivery.id)).toEqual(['11']);
    expect(find).toHaveBeenCalledWith({
      where: { notification: { id: '7' } },
      relations: { notification: true },
      order: { createdAt: 'ASC' },
    });
  });
});
