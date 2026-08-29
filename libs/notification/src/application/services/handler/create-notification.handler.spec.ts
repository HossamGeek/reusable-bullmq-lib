import { Notification } from '../../../domain/entities/notification.entity';
import { NotificationDelivery } from '../../../domain/entities/notification-delivery.entity';
import { NotificationChannel } from '../../../domain/enums/notification-channel.enum';
import { NotificationStatus } from '../../../domain/enums/notification-status.enum';
import { NotificationType } from '../../../domain/enums/notification-type.enum';
import { RecipientType } from '../../../domain/enums/recipient-type.enum';
import { ReferenceType } from '../../../domain/enums/reference-type.enum';
import { OrderCreatedContext } from '../../../domain/contexts/order-created.context';
import { NotificationReference } from '../../../domain/value-objects/notification-reference.value-object';
import { Recipient } from '../../../domain/value-objects/recipient.value-object';
import { CreateNotificationCommand } from '../../commands/create-notification.command';
import { PreparedNotification } from '../../dto';
import {
  DuplicateNotificationError,
  MissingDestinationError,
} from '../../errors';
import {
  NotificationDeliveryRepository,
  NotificationOutboxRecord,
  NotificationOutboxRepository,
  NotificationRepository,
} from '../../ports/persistence';
import { CreateNotificationHandler } from './create-notification.handler';

describe('CreateNotificationHandler', () => {
  const context: OrderCreatedContext = {
    orderId: '1001',
    orderNumber: 'ORD-1001',
    clientId: '42',
    invoice: { id: 'INV-9' },
  };

  const prepared: PreparedNotification<NotificationType.ORDER_CREATED> = {
    sourceEventId: 'evt-1',
    type: NotificationType.ORDER_CREATED,
    recipient: { type: RecipientType.CLIENT, id: '42' },
    channels: [NotificationChannel.EMAIL, NotificationChannel.WHATSAPP],
    destinations: { email: 'client@example.com', whatsapp: '+966500000000' },
    reference: { type: ReferenceType.ORDER, id: '1001' },
    context,
  };

  let findBySourceEventRecipientAndType: jest.Mock;
  let notificationSave: jest.Mock<Promise<Notification>, [Notification]>;
  let deliverySave: jest.Mock<Promise<NotificationDelivery>, [NotificationDelivery]>;
  let outboxSave: jest.Mock<Promise<NotificationOutboxRecord>, [NotificationOutboxRecord]>;
  let notificationTransactionRun: jest.Mock;
  let writeOrder: string[];
  let handler: CreateNotificationHandler;

  const savedDeliveryFor = (delivery: NotificationDelivery): NotificationDelivery =>
    NotificationDelivery.fromPersistence({
      id: String(5000 + deliverySave.mock.calls.length),
      notificationId: delivery.notificationId,
      channel: delivery.channel,
      recipientAddress: delivery.recipientAddress,
      status: delivery.status,
      attemptCount: delivery.attemptCount,
      providerMessageId: null,
      lastError: null,
      sentAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

  beforeEach(() => {
    writeOrder = [];
    findBySourceEventRecipientAndType = jest.fn().mockResolvedValue(null);
    notificationSave = jest.fn((notification: Notification) => {
      writeOrder.push('notification');
      return Promise.resolve(
        Notification.fromPersistence({
          id: '9001',
          sourceEventId: notification.sourceEventId,
          recipient: notification.recipient,
          type: notification.type,
          reference: notification.reference,
          context: notification.context,
          status: notification.status,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      );
    });
    deliverySave = jest.fn((delivery: NotificationDelivery) => {
      writeOrder.push(`delivery:${delivery.channel}`);
      return Promise.resolve(savedDeliveryFor(delivery));
    });
    outboxSave = jest.fn((record: NotificationOutboxRecord) => {
      writeOrder.push(`outbox:${record.deliveryId}`);
      return Promise.resolve({
        ...record,
        id: String(6000 + outboxSave.mock.calls.length),
      });
    });
    notificationTransactionRun = jest.fn(async (
      work: (repositories: {
        notifications: NotificationRepository;
        deliveries: NotificationDeliveryRepository;
        outbox: NotificationOutboxRepository;
      }) => Promise<void>,
    ) =>
      work({
        notifications: {
          save: notificationSave,
        } as unknown as NotificationRepository,
        deliveries: {
          save: deliverySave,
        } as unknown as NotificationDeliveryRepository,
        outbox: {
          save: outboxSave,
        } as unknown as NotificationOutboxRepository,
      }),
    );
    handler = new CreateNotificationHandler(
      { run: notificationTransactionRun },
      { findBySourceEventRecipientAndType } as unknown as NotificationRepository,
    );
  });

  it('creates one PENDING aggregate, one delivery per prepared channel with address snapshots, and one outbox row per delivery', async () => {
    await expect(handler.execute(new CreateNotificationCommand(prepared))).resolves.toBeUndefined();

    // Aggregate defaults.
    expect(notificationSave).toHaveBeenCalledTimes(1);
    const aggregate = notificationSave.mock.calls[0][0];
    expect(aggregate.id).toBeNull();
    expect(aggregate.status).toBe(NotificationStatus.PENDING);
    expect(aggregate.sourceEventId).toBe('evt-1');
    expect(aggregate.recipient).toEqual(Recipient.create(RecipientType.CLIENT, '42'));
    expect(aggregate.reference).toEqual(NotificationReference.create(ReferenceType.ORDER, '1001'));
    expect(aggregate.context).toEqual(context);

    // Deliveries snapshot the exact destination addresses at creation time.
    expect(deliverySave).toHaveBeenCalledTimes(2);
    const [emailDelivery, whatsappDelivery] = deliverySave.mock.calls.map(
      (call) => call[0],
    );
    expect(emailDelivery.channel).toBe(NotificationChannel.EMAIL);
    expect(emailDelivery.recipientAddress).toBe('client@example.com');
    expect(emailDelivery.status).toBe('PENDING');
    expect(emailDelivery.attemptCount).toBe(0);
    expect(whatsappDelivery.channel).toBe(NotificationChannel.WHATSAPP);
    expect(whatsappDelivery.recipientAddress).toBe('+966500000000');
    expect(whatsappDelivery.notificationId).toBe('9001');

    // One outbox row per delivery in creation order.
    expect(outboxSave).toHaveBeenCalledTimes(2);
    expect(outboxSave.mock.calls.map((call) => call[0])).toEqual([
      {
        id: null,
        deliveryId: '5001',
        channel: NotificationChannel.EMAIL,
        publishedAt: null,
        publishAttempts: 0,
        lastPublishError: null,
        nextPublishAt: null,
        createdAt: null,
      },
      {
        id: null,
        deliveryId: '5002',
        channel: NotificationChannel.WHATSAPP,
        publishedAt: null,
        publishAttempts: 0,
        lastPublishError: null,
        nextPublishAt: null,
        createdAt: null,
      },
    ]);

    // Deterministic write order: aggregate -> delivery -> its outbox -> ...
    expect(writeOrder).toEqual([
      'notification',
      'delivery:EMAIL',
      'outbox:5001',
      'delivery:WHATSAPP',
      'outbox:5002',
    ]);
  });

  it('returns idempotent success when the tuple already exists before any transaction', async () => {
    findBySourceEventRecipientAndType.mockResolvedValue(
      Notification.fromPersistence({
        id: '8001',
        sourceEventId: 'evt-1',
        recipient: Recipient.create(RecipientType.CLIENT, '42'),
        type: NotificationType.ORDER_CREATED,
        reference: NotificationReference.create(ReferenceType.ORDER, '1001'),
        context,
        status: NotificationStatus.PENDING,
        createdAt: null,
        updatedAt: null,
      }),
    );

    await expect(handler.execute(new CreateNotificationCommand(prepared))).resolves.toBeUndefined();

    expect(findBySourceEventRecipientAndType).toHaveBeenCalledWith({
      sourceEventId: 'evt-1',
      recipientType: RecipientType.CLIENT,
      recipientId: '42',
      type: NotificationType.ORDER_CREATED,
    });
    expect(notificationTransactionRun).not.toHaveBeenCalled();
  });

  it('treats a concurrent duplicate conflict as idempotent success', async () => {
    notificationTransactionRun.mockRejectedValueOnce(new DuplicateNotificationError());

    await expect(handler.execute(new CreateNotificationCommand(prepared))).resolves.toBeUndefined();
  });

  it('rejects a prepared channel without a destination before opening a transaction', async () => {
    const emailOnlyPrepared: PreparedNotification<NotificationType.ORDER_CREATED> = {
      ...prepared,
      channels: [NotificationChannel.EMAIL, NotificationChannel.WHATSAPP],
      destinations: { email: 'client@example.com' },
    };

    await expect(
      handler.execute(new CreateNotificationCommand(emailOnlyPrepared)),
    ).rejects.toThrow(MissingDestinationError);

    expect(findBySourceEventRecipientAndType).not.toHaveBeenCalled();
    expect(notificationTransactionRun).not.toHaveBeenCalled();
  });

  it('propagates delivery failures; mocks prove callback delegation while integration tests prove rollback', async () => {
    deliverySave
      .mockImplementationOnce((delivery: NotificationDelivery) =>
        Promise.resolve(savedDeliveryFor(delivery)),
      )
      .mockImplementationOnce(() => Promise.reject(new Error('simulated delivery failure')));

    await expect(handler.execute(new CreateNotificationCommand(prepared))).rejects.toThrow(
      /simulated delivery failure/,
    );

    expect(deliverySave).toHaveBeenCalledTimes(2);
    expect(outboxSave).toHaveBeenCalledTimes(1);
  });

  it('propagates outbox failures untouched', async () => {
    outboxSave.mockRejectedValueOnce(new Error('simulated outbox failure'));

    await expect(handler.execute(new CreateNotificationCommand(prepared))).rejects.toThrow(
      /simulated outbox failure/,
    );

    expect(deliverySave).toHaveBeenCalledTimes(1);
    expect(outboxSave).toHaveBeenCalledTimes(1);
  });

  it('propagates unrelated notification-transaction errors without translating them', async () => {
    const failure = new Error('connection refused');
    notificationTransactionRun.mockRejectedValueOnce(failure);

    let caught: unknown;
    try {
      await handler.execute(new CreateNotificationCommand(prepared));
    } catch (error) {
      caught = error;
    }
    expect(caught).toBe(failure);
    expect(caught).not.toBeInstanceOf(DuplicateNotificationError);
  });
});