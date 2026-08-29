import { NotificationChannel } from '../../../../domain/enums/notification-channel.enum';
import { NotificationOutboxRecord } from '../../../../application/ports/persistence/notification-outbox-repository.port';
import { NotificationDeliveryOrmEntity } from '../entities/notification-delivery.orm-entity';
import { NotificationOutboxOrmEntity } from '../entities/notification-outbox.orm-entity';
import { NotificationOutboxMapper } from './notification-outbox.mapper';

describe('NotificationOutboxMapper', () => {
  const buildNewRecord = (): NotificationOutboxRecord => ({
    id: null,
    deliveryId: '11',
    channel: NotificationChannel.EMAIL,
    publishedAt: null,
    publishAttempts: 0,
    lastPublishError: null,
    nextPublishAt: null,
    createdAt: null,
  });

  it('maps a new record to an insert-ready ORM partial with FK reference and explicit nulls', () => {
    const orm = NotificationOutboxMapper.toOrm(buildNewRecord());

    expect(orm).toEqual({
      id: undefined,
      delivery: { id: '11' },
      // Nullable columns carry explicit null so inserts write NULL and
      // updates would clear stale values; only generated fields stay
      // undefined.
      publishedAt: null,
      publishAttempts: 0,
      lastPublishError: null,
      nextPublishAt: null,
      createdAt: undefined,
    });
  });

  it('maps cleared nullable columns to explicit null so saves clear stale database values', () => {
    // Regression guard for the TypeORM nullable-update bug: undefined fields
    // are omitted from queries, so a cleared value must map to null (not
    // undefined) or stale database data would survive an update — e.g. an
    // outbox row retried after a failure must drop its previous error.
    const publishedAt = new Date('2026-08-23T10:00:00Z');

    const orm = NotificationOutboxMapper.toOrm({
      ...buildNewRecord(),
      id: '9',
      publishedAt,
      publishAttempts: 3,
      lastPublishError: null,
      nextPublishAt: null,
    });

    expect(orm.id).toBe('9');
    expect(orm.publishedAt).toBe(publishedAt);
    expect(orm.lastPublishError).toBeNull();
    expect(orm.nextPublishAt).toBeNull();
    expect(orm.createdAt).toBeUndefined();
  });

  it('maps a persisted ORM row back into the port record through the delivery relation', () => {
    const createdAt = new Date('2026-08-23T09:00:00Z');
    const orm = {
      id: '3',
      delivery: {
        id: '11',
        channel: NotificationChannel.WHATSAPP,
      } as NotificationDeliveryOrmEntity,
      publishedAt: null,
      publishAttempts: 2,
      lastPublishError: 'temporary provider outage',
      nextPublishAt: null,
      createdAt,
    } as unknown as NotificationOutboxOrmEntity;

    const record = NotificationOutboxMapper.toRecord(orm);

    expect(record).toEqual({
      id: '3',
      deliveryId: '11',
      channel: NotificationChannel.WHATSAPP,
      publishedAt: null,
      publishAttempts: 2,
      lastPublishError: 'temporary provider outage',
      nextPublishAt: null,
      createdAt,
    });
  });

  it('keeps provided nullable values when mapping to ORM and returns null for unset columns on read', () => {
    const publishedAt = new Date('2026-08-23T10:00:00Z');
    const nextPublishAt = new Date('2026-08-23T10:05:00Z');

    const orm = NotificationOutboxMapper.toOrm({
      ...buildNewRecord(),
      id: '3',
      publishedAt,
      publishAttempts: 1,
      lastPublishError: 'boom',
      nextPublishAt,
    });
    expect(orm.id).toBe('3');
    expect(orm.publishedAt).toBe(publishedAt);
    expect(orm.lastPublishError).toBe('boom');
    expect(orm.nextPublishAt).toBe(nextPublishAt);

    const record = NotificationOutboxMapper.toRecord({
      id: '3',
      delivery: { id: '11', channel: NotificationChannel.EMAIL },
      publishedAt: null,
      publishAttempts: 0,
      lastPublishError: null,
      nextPublishAt: null,
      createdAt: null,
    } as unknown as NotificationOutboxOrmEntity);
    expect(record.publishedAt).toBeNull();
    expect(record.lastPublishError).toBeNull();
    expect(record.nextPublishAt).toBeNull();
    expect(record.createdAt).toBeNull();
  });

  it('rejects rows whose delivery relation was not loaded', () => {
    const orm = {
      id: '3',
      publishAttempts: 0,
    } as unknown as NotificationOutboxOrmEntity;

    expect(() => NotificationOutboxMapper.toRecord(orm)).toThrow(/missing its delivery relation/);
  });
});
