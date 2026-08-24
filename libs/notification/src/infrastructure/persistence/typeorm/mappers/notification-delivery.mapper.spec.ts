import { NotificationChannel } from '../../../../domain/enums/notification-channel.enum';
import { NotificationDeliveryStatus } from '../../../../domain/enums/notification-delivery-status.enum';
import { NotificationDelivery } from '../../../../domain/entities/notification-delivery.entity';
import { NotificationOrmEntity } from '../entities/notification.orm-entity';
import { NotificationDeliveryOrmEntity } from '../entities/notification-delivery.orm-entity';
import { NotificationDeliveryMapper } from './notification-delivery.mapper';

describe('NotificationDeliveryMapper', () => {
  it('maps a new domain delivery to an insert-ready ORM partial with FK reference and explicit nulls', () => {
    const delivery = NotificationDelivery.create({
      notificationId: '7',
      channel: NotificationChannel.EMAIL,
      recipientAddress: 'client@example.com',
    });

    const orm = NotificationDeliveryMapper.toOrm(delivery);

    expect(orm).toEqual({
      id: undefined,
      notification: { id: '7' },
      channel: NotificationChannel.EMAIL,
      recipientAddress: 'client@example.com',
      status: NotificationDeliveryStatus.PENDING,
      attemptCount: 0,
      // Nullable columns carry explicit null so inserts write NULL and
      // updates would clear stale values; only generated fields stay
      // undefined.
      providerMessageId: null,
      lastError: null,
      sentAt: null,
      createdAt: undefined,
      updatedAt: undefined,
    });
  });

  it('maps cleared nullable columns to explicit null so saves clear stale database values', () => {
    // Regression guard for the TypeORM nullable-update bug: undefined fields
    // are omitted from queries, so a cleared value must map to null (not
    // undefined) or stale database data would survive an update.
    const createdAt = new Date('2026-08-23T10:00:00Z');
    const updatedAt = new Date('2026-08-23T10:01:00Z');
    const delivery = NotificationDelivery.fromPersistence({
      id: '11',
      notificationId: '7',
      channel: NotificationChannel.WHATSAPP,
      recipientAddress: '+966500000000',
      status: NotificationDeliveryStatus.PENDING,
      attemptCount: 2,
      providerMessageId: null,
      lastError: null,
      sentAt: null,
      createdAt,
      updatedAt,
    });

    const orm = NotificationDeliveryMapper.toOrm(delivery);

    expect(orm.id).toBe('11');
    expect(orm.providerMessageId).toBeNull();
    expect(orm.lastError).toBeNull();
    expect(orm.sentAt).toBeNull();
    expect(orm.createdAt).toBe(createdAt);
    expect(orm.updatedAt).toBe(updatedAt);
  });

  it('keeps provided nullable values when mapping to ORM', () => {
    const sentAt = new Date('2026-08-23T10:05:00Z');
    const delivery = NotificationDelivery.fromPersistence({
      id: '11',
      notificationId: '7',
      channel: NotificationChannel.WHATSAPP,
      recipientAddress: '+966500000000',
      status: NotificationDeliveryStatus.SENT,
      attemptCount: 2,
      providerMessageId: 'provider-abc',
      lastError: 'temporary provider outage',
      sentAt,
      createdAt: sentAt,
      updatedAt: sentAt,
    });

    const orm = NotificationDeliveryMapper.toOrm(delivery);

    expect(orm.providerMessageId).toBe('provider-abc');
    expect(orm.lastError).toBe('temporary provider outage');
    expect(orm.sentAt).toBe(sentAt);
  });

  it('round-trips an ORM row back into the domain model using the relation id', () => {
    const sentAt = new Date('2026-08-23T10:05:00Z');
    const orm = {
      id: '11',
      notification: { id: '7' } as NotificationOrmEntity,
      channel: NotificationChannel.WHATSAPP,
      recipientAddress: '+966500000000',
      status: NotificationDeliveryStatus.SENT,
      attemptCount: 2,
      providerMessageId: 'provider-abc',
      lastError: null,
      sentAt,
      createdAt: sentAt,
      updatedAt: sentAt,
    } as unknown as NotificationDeliveryOrmEntity;

    const delivery = NotificationDeliveryMapper.toDomain(orm);

    expect(delivery.id).toBe('11');
    expect(delivery.notificationId).toBe('7');
    expect(delivery.recipientAddress).toBe('+966500000000');
    expect(delivery.attemptCount).toBe(2);
    expect(delivery.providerMessageId).toBe('provider-abc');
    expect(delivery.sentAt).toBe(sentAt);
  });

  it('rejects rows whose notification relation was not loaded', () => {
    const orm = {
      id: '11',
      channel: NotificationChannel.EMAIL,
      recipientAddress: 'client@example.com',
    } as unknown as NotificationDeliveryOrmEntity;

    expect(() => NotificationDeliveryMapper.toDomain(orm)).toThrow(
      /missing its notification relation/,
    );
  });
});
