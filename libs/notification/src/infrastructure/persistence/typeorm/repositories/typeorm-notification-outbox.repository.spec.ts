import { FindOperator, Repository } from 'typeorm';
import { NotificationOutboxRecord } from '../../../../application/ports/persistence/notification-outbox-repository.port';
import { NotificationOutboxOrmEntity } from '../entities/notification-outbox.orm-entity';
import { TypeOrmNotificationOutboxRepository } from './typeorm-notification-outbox.repository';

/** Shape of the options object recorded from `repository.find()` calls. */
interface RecordedFindOptions {
  where: Array<Record<string, FindOperator<Date>>>;
  order?: { createdAt: string };
  take?: number;
}

describe('TypeOrmNotificationOutboxRepository', () => {
  const fixedNow = new Date('2026-08-23T12:00:00Z');
  const savedRow = {
    id: '3',
    delivery: { id: '11' },
    publishedAt: null,
    publishAttempts: 0,
    lastPublishError: null,
    nextPublishAt: null,
    createdAt: fixedNow,
  } as unknown as NotificationOutboxOrmEntity;

  const buildRecord = (): NotificationOutboxRecord => ({
    id: null,
    deliveryId: '11',
    publishedAt: null,
    publishAttempts: 0,
    lastPublishError: null,
    nextPublishAt: null,
    createdAt: null,
  });

  it('saves new outbox rows as inserts referencing the delivery id', async () => {
    const save = jest.fn().mockResolvedValue(savedRow);
    const repository = new TypeOrmNotificationOutboxRepository(
      { save } as unknown as Repository<NotificationOutboxOrmEntity>,
    );

    const result = await repository.save(buildRecord());

    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: undefined,
        delivery: { id: '11' },
        publishAttempts: 0,
      }),
    );
    expect(result).toEqual({
      id: '3',
      deliveryId: '11',
      publishedAt: null,
      publishAttempts: 0,
      lastPublishError: null,
      nextPublishAt: null,
      createdAt: fixedNow,
    });
  });

  it('returns null when findById finds no row', async () => {
    const findOne = jest.fn().mockResolvedValue(null);
    const repository = new TypeOrmNotificationOutboxRepository({
      findOne,
    } as unknown as Repository<NotificationOutboxOrmEntity>);

    await expect(repository.findById('404')).resolves.toBeNull();
    expect(findOne).toHaveBeenCalledWith({
      where: { id: '404' },
      relations: { delivery: true },
    });
  });

  it('queries unpublished rows with due-or-absent scheduling, oldest first', async () => {
    const find = jest.fn().mockResolvedValue([savedRow]);
    const repository = new TypeOrmNotificationOutboxRepository({
      find,
    } as unknown as Repository<NotificationOutboxOrmEntity>);

    const result = await repository.findPublishable({ limit: 5, now: fixedNow });

    expect(result.map((record) => record.id)).toEqual(['3']);
    const [[options]] = find.mock.calls as Array<[RecordedFindOptions]>;
    const where = options.where;
    expect(where).toHaveLength(2);
    expect(where[0].publishedAt.type).toBe('isNull');
    expect(where[0].nextPublishAt.type).toBe('isNull');
    expect(where[1].publishedAt.type).toBe('isNull');
    expect(where[1].nextPublishAt.type).toBe('lessThanOrEqual');
    expect(where[1].nextPublishAt.value).toBe(fixedNow);
    expect(options.order).toEqual({ createdAt: 'ASC' });
    expect(options.take).toBe(5);
  });

  it('applies the default limit and clock when no options are given', async () => {
    const find = jest.fn().mockResolvedValue([]);
    const repository = new TypeOrmNotificationOutboxRepository({
      find,
    } as unknown as Repository<NotificationOutboxOrmEntity>);

    await repository.findPublishable();

    const [[options]] = find.mock.calls as Array<[RecordedFindOptions]>;
    expect(options.take).toBe(100);
    expect(options.where[1].nextPublishAt.value.getTime()).toBeLessThanOrEqual(Date.now());
  });
});
