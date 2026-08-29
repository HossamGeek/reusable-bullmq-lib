/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return */
import { FindOperator, Repository } from 'typeorm';
import { NotificationChannel } from '../../../../domain/enums/notification-channel.enum';
import { NotificationOutboxRecord } from '../../../../application/ports/persistence/notification-outbox-repository.port';
import { NotificationOutboxOrmEntity } from '../entities/notification-outbox.orm-entity';
import { TypeOrmNotificationOutboxRepository } from './typeorm-notification-outbox.repository';

/** Shape of the options object recorded from `repository.find()` calls. */
interface RecordedFindOptions {
  where: Array<Record<string, FindOperator<Date>>>;
  order?: { createdAt: string };
  take?: number;
  lock?: { mode: string; onLocked: string };
}

describe('TypeOrmNotificationOutboxRepository', () => {
  const fixedNow = new Date('2026-08-23T12:00:00Z');
  const savedRow = {
    id: '3',
    delivery: { id: '11', channel: NotificationChannel.EMAIL },
    publishedAt: null,
    publishAttempts: 0,
    lastPublishError: null,
    nextPublishAt: null,
    createdAt: fixedNow,
  } as unknown as NotificationOutboxOrmEntity;

  const buildRecord = (): NotificationOutboxRecord => ({
    id: null,
    deliveryId: '11',
    channel: NotificationChannel.EMAIL,
    publishedAt: null,
    publishAttempts: 0,
    lastPublishError: null,
    nextPublishAt: null,
    createdAt: null,
  });

  it('saves new outbox rows as inserts referencing the delivery id', async () => {
    const save = jest.fn().mockResolvedValue(savedRow);
    const repository = new TypeOrmNotificationOutboxRepository({
      save,
    } as unknown as Repository<NotificationOutboxOrmEntity>);

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
      channel: NotificationChannel.EMAIL,
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

  describe('processPublishable', () => {
    it('selects publishable rows with a pessimistic write + SKIP LOCKED lock inside a transaction and passes tx-scoped mutations to the processor', async () => {
      const rows = [
        { id: '1', delivery: { id: '11', channel: NotificationChannel.EMAIL } },
        { id: '2', delivery: { id: '12', channel: NotificationChannel.WHATSAPP } },
      ] as unknown as NotificationOutboxOrmEntity[];

      const txRepo = {
        find: jest.fn().mockResolvedValue(rows),
        update: jest.fn().mockResolvedValue({ affected: 1 }),
      };
      const manager = {
        getRepository: jest.fn().mockReturnValue(txRepo),
        update: jest.fn().mockResolvedValue({ affected: 1 }),
        transaction: jest.fn().mockImplementation((cb) => cb(manager)),
      };
      const repository = new TypeOrmNotificationOutboxRepository({
        manager,
      } as unknown as Repository<NotificationOutboxOrmEntity>);

      const processor = jest.fn().mockResolvedValue('done');
      const result = await repository.processPublishable({ limit: 5, now: fixedNow }, processor);

      expect(result).toBe('done');
      expect(manager.getRepository).toHaveBeenCalledWith(NotificationOutboxOrmEntity);
      const [[findOptions]] = txRepo.find.mock.calls as Array<[RecordedFindOptions]>;
      expect(findOptions.take).toBe(5);
      expect(findOptions.lock).toEqual({ mode: 'pessimistic_write', onLocked: 'skip_locked' });

      const [records, tx] = processor.mock.calls[0];
      expect(records).toHaveLength(2);
      expect(records[0]).toMatchObject({
        id: '1',
        deliveryId: '11',
        channel: NotificationChannel.EMAIL,
      });
      expect(records[1]).toMatchObject({
        id: '2',
        deliveryId: '12',
        channel: NotificationChannel.WHATSAPP,
      });

      // tx-scoped mutations must route through the transaction manager.
      await tx.markPublished('1', fixedNow, 1);
      expect(manager.update).toHaveBeenCalledWith(
        NotificationOutboxOrmEntity,
        { id: '1' },
        expect.objectContaining({ publishedAt: fixedNow, publishAttempts: 1, nextPublishAt: null }),
      );

      await tx.schedulePublishRetry('2', fixedNow, 'boom', 1);
      expect(manager.update).toHaveBeenCalledWith(
        NotificationOutboxOrmEntity,
        { id: '2' },
        expect.objectContaining({
          lastPublishError: 'boom',
          nextPublishAt: fixedNow,
          publishAttempts: 1,
        }),
      );
    });

    it('rolls back the transaction when the processor throws', async () => {
      const txRepo = {
        find: jest.fn().mockResolvedValue([]),
        update: jest.fn(),
      };
      const manager = {
        getRepository: jest.fn().mockReturnValue(txRepo),
        update: jest.fn(),
        transaction: jest.fn().mockImplementation((cb) => cb(manager)),
      };
      const repository = new TypeOrmNotificationOutboxRepository({
        manager,
      } as unknown as Repository<NotificationOutboxOrmEntity>);

      const processor = jest.fn().mockRejectedValue(new Error('processor failed'));
      await expect(
        repository.processPublishable({ limit: 5, now: fixedNow }, processor),
      ).rejects.toThrow('processor failed');
    });
  });

  describe('markPublished', () => {
    it('clears the error and next retry while persisting the attempt count', async () => {
      const update = jest.fn().mockResolvedValue({ affected: 1 });
      const repository = new TypeOrmNotificationOutboxRepository({
        update,
      } as unknown as Repository<NotificationOutboxOrmEntity>);

      await repository.markPublished('1', fixedNow, 3);

      expect(update).toHaveBeenCalledWith(
        { id: '1' },
        { publishedAt: fixedNow, lastPublishError: null, nextPublishAt: null, publishAttempts: 3 },
      );
    });
  });

  describe('schedulePublishRetry', () => {
    it('stores the error and next retry while persisting the attempt count', async () => {
      const update = jest.fn().mockResolvedValue({ affected: 1 });
      const repository = new TypeOrmNotificationOutboxRepository({
        update,
      } as unknown as Repository<NotificationOutboxOrmEntity>);

      await repository.schedulePublishRetry('1', fixedNow, 'boom', 2);

      expect(update).toHaveBeenCalledWith(
        { id: '1' },
        { lastPublishError: 'boom', nextPublishAt: fixedNow, publishAttempts: 2 },
      );
    });
  });
});
