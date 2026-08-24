import { NotificationType } from '../../../../domain/enums/notification-type.enum';
import { RecipientType } from '../../../../domain/enums/recipient-type.enum';
import { ReferenceType } from '../../../../domain/enums/reference-type.enum';
import { NotificationStatus } from '../../../../domain/enums/notification-status.enum';
import { OrderCreatedContext } from '../../../../domain/contexts/order-created.context';
import { NotificationReference } from '../../../../domain/value-objects/notification-reference.value-object';
import { Recipient } from '../../../../domain/value-objects/recipient.value-object';
import { Notification } from '../../../../domain/entities/notification.entity';
import { NotificationOrmEntity } from '../entities/notification.orm-entity';
import { NotificationMapper } from './notification.mapper';

describe('NotificationMapper', () => {
  const context: OrderCreatedContext = {
    orderId: '1001',
    orderNumber: 'ORD-1001',
    clientId: '42',
    invoice: { id: 'INV-9', number: '2026-0009' },
  };

  it('maps a new domain notification to an insert-ready ORM partial', () => {
    const notification = Notification.create({
      sourceEventId: 'evt-1',
      recipient: Recipient.create(RecipientType.CLIENT, '42', 'client@example.com'),
      type: NotificationType.ORDER_CREATED,
      reference: NotificationReference.create(ReferenceType.ORDER, 'ORD-1001'),
      context,
    });

    const orm = NotificationMapper.toOrm(notification);

    expect(orm).toEqual({
      id: undefined,
      sourceEventId: 'evt-1',
      recipientType: RecipientType.CLIENT,
      recipientId: '42',
      type: NotificationType.ORDER_CREATED,
      referenceType: ReferenceType.ORDER,
      referenceId: 'ORD-1001',
      context,
      status: NotificationStatus.PENDING,
      createdAt: undefined,
      updatedAt: undefined,
    });
  });

  it('keeps persistence ids and timestamps when mapping an existing notification', () => {
    const timestamp = new Date('2026-08-23T10:00:00Z');
    const notification = Notification.fromPersistence({
      id: '7',
      sourceEventId: 'evt-1',
      recipient: Recipient.create(RecipientType.PROVIDER, '99'),
      type: NotificationType.ORDER_DELIVERED,
      reference: NotificationReference.create(ReferenceType.ORDER, '1001'),
      context: {
        orderId: '1001',
        orderNumber: 'ORD-1001',
        clientId: '42',
        deliveredAt: timestamp.toISOString(),
      },
      status: NotificationStatus.SENT,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    const orm = NotificationMapper.toOrm(notification);

    expect(orm.id).toBe('7');
    expect(orm.createdAt).toBe(timestamp);
    expect(orm.updatedAt).toBe(timestamp);
    expect(orm.status).toBe(NotificationStatus.SENT);
  });

  it('round-trips an ORM row back into the typed domain model', () => {
    const orm = {
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

    const notification = NotificationMapper.toDomain(orm);

    expect(notification.id).toBe('7');
    expect(notification.recipient.type).toBe(RecipientType.CLIENT);
    expect(notification.recipient.id).toBe('42');
    expect(notification.reference.id).toBe('ORD-1001');
    expect(notification.status).toBe(NotificationStatus.PENDING);
    expect(notification.typedContext(NotificationType.ORDER_CREATED)).toEqual(context);
  });
});
