import { DeepPartial, Repository } from 'typeorm';
import { NotificationType } from '../../../../domain/enums/notification-type.enum';
import { RecipientType } from '../../../../domain/enums/recipient-type.enum';
import { ReferenceType } from '../../../../domain/enums/reference-type.enum';
import { NotificationStatus } from '../../../../domain/enums/notification-status.enum';
import { OrderCreatedContext } from '../../../../domain/contexts/order-created.context';
import { NotificationReference } from '../../../../domain/value-objects/notification-reference.value-object';
import { Recipient } from '../../../../domain/value-objects/recipient.value-object';
import { Notification } from '../../../../domain/entities/notification.entity';
import { NotificationOrmEntity } from '../entities/notification.orm-entity';
import { TypeOrmNotificationRepository } from './typeorm-notification.repository';

describe('TypeOrmNotificationRepository', () => {
  const context: OrderCreatedContext = {
    orderId: '1001',
    orderNumber: 'ORD-1001',
    clientId: '42',
  };

  const savedRow = {
    id: '7',
    sourceEventId: 'evt-1',
    recipientType: RecipientType.CLIENT,
    recipientId: '42',
    type: NotificationType.ORDER_CREATED,
    referenceType: ReferenceType.ORDER,
    referenceId: 'ORD-1001',
    context,
    status: NotificationStatus.PENDING,
    createdAt: new Date('2026-08-23T09:00:00Z'),
    updatedAt: new Date('2026-08-23T09:00:00Z'),
  } as NotificationOrmEntity;

  const buildNotification = () =>
    Notification.create({
      sourceEventId: 'evt-1',
      recipient: Recipient.create(RecipientType.CLIENT, '42'),
      type: NotificationType.ORDER_CREATED,
      reference: NotificationReference.create(ReferenceType.ORDER, 'ORD-1001'),
      context,
    });

  it('saves new notifications and maps the persisted row back to the domain', async () => {
    const save = jest.fn().mockResolvedValue(savedRow);
    const repository = new TypeOrmNotificationRepository({ save } as unknown as Repository<NotificationOrmEntity>);

    const result = await repository.save(buildNotification());

    expect(save).toHaveBeenCalledTimes(1);
    const [savedArgs] = save.mock.calls as Array<[DeepPartial<NotificationOrmEntity>]>;
    expect(savedArgs[0]).toMatchObject({
      id: undefined,
      sourceEventId: 'evt-1',
      recipientType: RecipientType.CLIENT,
      recipientId: '42',
      status: NotificationStatus.PENDING,
      context,
    });
    expect(result.id).toBe('7');
    expect(result.status).toBe(NotificationStatus.PENDING);
  });

  it('returns null when findById finds no row', async () => {
    const findOne = jest.fn().mockResolvedValue(null);
    const repository = new TypeOrmNotificationRepository({
      findOne,
    } as unknown as Repository<NotificationOrmEntity>);

    await expect(repository.findById('404')).resolves.toBeNull();
    expect(findOne).toHaveBeenCalledWith({ where: { id: '404' } });
  });

  it('finds by source event, recipient, and type with an exact where clause', async () => {
    const findOne = jest.fn().mockResolvedValue(savedRow);
    const repository = new TypeOrmNotificationRepository({
      findOne,
    } as unknown as Repository<NotificationOrmEntity>);

    const result = await repository.findBySourceEventRecipientAndType({
      sourceEventId: 'evt-1',
      recipientType: RecipientType.CLIENT,
      recipientId: '42',
      type: NotificationType.ORDER_CREATED,
    });

    expect(result?.id).toBe('7');
    expect(findOne).toHaveBeenCalledWith({
      where: {
        sourceEventId: 'evt-1',
        recipientType: RecipientType.CLIENT,
        recipientId: '42',
        type: NotificationType.ORDER_CREATED,
      },
    });
  });
});
