import { NotificationType } from '../enums/notification-type.enum';
import { RecipientType } from '../enums/recipient-type.enum';
import { ReferenceType } from '../enums/reference-type.enum';
import { NotificationStatus } from '../enums/notification-status.enum';
import { OrderCreatedContext } from '../contexts/order-created.context';
import { NotificationReference } from '../value-objects/notification-reference.value-object';
import { Recipient } from '../value-objects/recipient.value-object';
import { Notification } from './notification.entity';

describe('Notification', () => {
  const context: OrderCreatedContext = {
    orderId: '1001',
    orderNumber: 'ORD-1001',
    clientId: '42',
    invoice: { id: 'INV-9' },
  };

  it('creates new notifications in PENDING state without persistence data', () => {
    const notification = Notification.create({
      sourceEventId: 'evt-1',
      recipient: Recipient.create(RecipientType.CLIENT, '42'),
      type: NotificationType.ORDER_CREATED,
      reference: NotificationReference.create(ReferenceType.ORDER, '1001'),
      context,
    });

    expect(notification.id).toBeNull();
    expect(notification.status).toBe(NotificationStatus.PENDING);
    expect(notification.createdAt).toBeNull();
    expect(notification.updatedAt).toBeNull();
  });

  it('rejects notifications without a source event id', () => {
    expect(() =>
      Notification.create({
        sourceEventId: '  ',
        recipient: Recipient.create(RecipientType.CLIENT, '42'),
        type: NotificationType.ORDER_CREATED,
        reference: NotificationReference.create(ReferenceType.ORDER, '1001'),
        context,
      }),
    ).toThrow(/sourceEventId is required/);
  });

  it('rejects notifications without a valid recipient', () => {
    expect(() =>
      Notification.create({
        sourceEventId: 'evt-1',
        recipient: null as unknown as Recipient,
        type: NotificationType.ORDER_CREATED,
        reference: NotificationReference.create(ReferenceType.ORDER, '1001'),
        context,
      }),
    ).toThrow(/recipient is required/);
    expect(() =>
      Notification.create({
        sourceEventId: 'evt-1',
        recipient: { type: RecipientType.CLIENT, id: '42' } as unknown as Recipient,
        type: NotificationType.ORDER_CREATED,
        reference: NotificationReference.create(ReferenceType.ORDER, '1001'),
        context,
      }),
    ).toThrow(/recipient is required/);
  });

  it('rejects notifications without a valid reference', () => {
    expect(() =>
      Notification.create({
        sourceEventId: 'evt-1',
        recipient: Recipient.create(RecipientType.CLIENT, '42'),
        type: NotificationType.ORDER_CREATED,
        reference: null as unknown as NotificationReference,
        context,
      }),
    ).toThrow(/reference is required/);
    expect(() =>
      Notification.create({
        sourceEventId: 'evt-1',
        recipient: Recipient.create(RecipientType.CLIENT, '42'),
        type: NotificationType.ORDER_CREATED,
        reference: { type: ReferenceType.ORDER, id: '1001' },
        context,
      }),
    ).toThrow(/reference is required/);
  });

  it('rejects notifications without a type', () => {
    expect(() =>
      Notification.create({
        sourceEventId: 'evt-1',
        recipient: Recipient.create(RecipientType.CLIENT, '42'),
        type: undefined as unknown as NotificationType,
        reference: NotificationReference.create(ReferenceType.ORDER, '1001'),
        context,
      }),
    ).toThrow(/type is required/);
  });

  it('rejects notifications without a real context object', () => {
    expect(() =>
      Notification.create({
        sourceEventId: 'evt-1',
        recipient: Recipient.create(RecipientType.CLIENT, '42'),
        type: NotificationType.ORDER_CREATED,
        reference: NotificationReference.create(ReferenceType.ORDER, '1001'),
        context: null as unknown as OrderCreatedContext,
      }),
    ).toThrow(/context is required/);
    expect(() =>
      Notification.create({
        sourceEventId: 'evt-1',
        recipient: Recipient.create(RecipientType.CLIENT, '42'),
        type: NotificationType.ORDER_CREATED,
        reference: NotificationReference.create(ReferenceType.ORDER, '1001'),
        context: undefined as unknown as OrderCreatedContext,
      }),
    ).toThrow(/context is required/);
  });

  it('narrows the typed context for the matching notification type only', () => {
    const notification = Notification.create({
      sourceEventId: 'evt-1',
      recipient: Recipient.create(RecipientType.CLIENT, '42'),
      type: NotificationType.ORDER_CREATED,
      reference: NotificationReference.create(ReferenceType.ORDER, '1001'),
      context,
    });

    const typed = notification.typedContext(NotificationType.ORDER_CREATED);
    expect(typed.orderNumber).toBe('ORD-1001');
    // Invoice stays reference metadata; no document payload exists.
    expect(typed.invoice).toEqual({ id: 'INV-9' });

    expect(() => notification.typedContext(NotificationType.ORDER_DELIVERED)).toThrow(
      /does not match requested/,
    );
  });

  it('validates its value objects', () => {
    expect(() => Recipient.create(RecipientType.CLIENT, '')).toThrow(/Recipient id is required/);
    expect(() => NotificationReference.create(ReferenceType.ORDER, '')).toThrow(
      /reference id is required/,
    );
    expect(Recipient.create(RecipientType.PROVIDER, '9').address).toBeNull();
  });
});
