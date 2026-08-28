import { DataSource, EntityManager, QueryFailedError } from 'typeorm';

import { DuplicateNotificationError } from '../../../../application/errors';
import { NotificationTransactionRepositories } from '../../../../application/ports/persistence';

import { NotificationChannel } from '../../../../domain/enums/notification-channel.enum';
import { NotificationDeliveryStatus } from '../../../../domain/enums/notification-delivery-status.enum';
import { NotificationStatus } from '../../../../domain/enums/notification-status.enum';
import { NotificationType } from '../../../../domain/enums/notification-type.enum';
import { RecipientType } from '../../../../domain/enums/recipient-type.enum';
import { ReferenceType } from '../../../../domain/enums/reference-type.enum';

import { NotificationDeliveryOrmEntity } from '../entities/notification-delivery.orm-entity';
import { NotificationOutboxOrmEntity } from '../entities/notification-outbox.orm-entity';
import { NotificationOrmEntity } from '../entities/notification.orm-entity';

import { TypeOrmNotificationDeliveryRepository } from '../repositories/typeorm-notification-delivery.repository';
import { TypeOrmNotificationOutboxRepository } from '../repositories/typeorm-notification-outbox.repository';
import { TypeOrmNotificationRepository } from '../repositories/typeorm-notification.repository';

import { TypeOrmNotificationTransaction } from './typeorm-notification.transaction';

/** Minimal repository surface the adapters rely on. */
interface MockTypeOrmRepository {
  save: jest.Mock;
  findOne: jest.Mock;
  find: jest.Mock;
}

interface Harness {
  notificationTransaction: TypeOrmNotificationTransaction;
  transaction: jest.Mock;
  getRepository: jest.Mock;
  notificationRepo: MockTypeOrmRepository;
  deliveryRepo: MockTypeOrmRepository;
  outboxRepo: MockTypeOrmRepository;
}

type TransactionImpl = (
  callback: (manager: EntityManager) => Promise<unknown>,
) => Promise<unknown>;

/**
 * Builds a driver error that extends `Error` while carrying the PostgreSQL
 * `code`/`constraint` fields the transaction inspects.
 */
const buildDriverError = (
  code: string,
  constraint: string,
): Error & { code: string; constraint: string } => {
  const error = new Error(
    'duplicate key value violates unique constraint "UQ_notifications_source_recipient_type"',
  ) as Error & { code: string; constraint: string };
  error.code = code;
  error.constraint = constraint;
  return error;
};

/**
 * Builds a notification transaction backed by a mocked `DataSource.transaction`
 * that invokes its callback with a mocked `EntityManager`. The manager's
 * `getRepository` returns per-entity mock repositories so the adapters wrap
 * transaction-manager repositories rather than default ones.
 */
const buildHarness = (transactionImpl?: TransactionImpl): Harness => {
  const notificationRepo: MockTypeOrmRepository = {
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
  };
  const deliveryRepo: MockTypeOrmRepository = {
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
  };
  const outboxRepo: MockTypeOrmRepository = {
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
  };

  const getRepository = jest.fn((entity: unknown) => {
    if (entity === NotificationOrmEntity) return notificationRepo;
    if (entity === NotificationDeliveryOrmEntity) return deliveryRepo;
    if (entity === NotificationOutboxOrmEntity) return outboxRepo;
    throw new Error(`Unexpected entity passed to getRepository: ${String(entity)}`);
  });

  const manager = { getRepository } as unknown as EntityManager;

  const transaction = jest.fn(
    transactionImpl ??
      ((callback: (m: EntityManager) => Promise<unknown>) => callback(manager)),
  );

  const dataSource = { transaction } as unknown as DataSource;
  const notificationTransaction = new TypeOrmNotificationTransaction(dataSource);

  return {
    notificationTransaction,
    transaction,
    getRepository,
    notificationRepo,
    deliveryRepo,
    outboxRepo,
  };
};

describe('TypeOrmNotificationTransaction', () => {
  const context = { orderId: '1001', orderNumber: 'ORD-1001', clientId: '42' };
  const createdAt = new Date('2026-08-23T09:00:00Z');

  const notificationRow = {
    id: '7',
    sourceEventId: 'evt-1',
    recipientType: RecipientType.CLIENT,
    recipientId: '42',
    type: NotificationType.ORDER_CREATED,
    referenceType: ReferenceType.ORDER,
    referenceId: 'ORD-1001',
    context,
    status: NotificationStatus.PENDING,
    createdAt,
    updatedAt: createdAt,
  } as NotificationOrmEntity;

  const deliveryRow = {
    id: '11',
    notification: { id: '7' } as NotificationOrmEntity,
    channel: NotificationChannel.EMAIL,
    recipientAddress: 'client@example.com',
    status: NotificationDeliveryStatus.PENDING,
    attemptCount: 0,
    providerMessageId: null,
    lastError: null,
    sentAt: null,
    createdAt,
    updatedAt: createdAt,
  } as unknown as NotificationDeliveryOrmEntity;

  const outboxRow = {
    id: '3',
    delivery: { id: '11' },
    publishedAt: null,
    publishAttempts: 0,
    lastPublishError: null,
    nextPublishAt: null,
    createdAt,
  } as unknown as NotificationOutboxOrmEntity;

  it('delegates to DataSource.transaction and builds repositories from the transaction manager', async () => {
    const harness = buildHarness();
    harness.notificationRepo.findOne.mockResolvedValue(notificationRow);
    harness.deliveryRepo.findOne.mockResolvedValue(deliveryRow);
    harness.outboxRepo.findOne.mockResolvedValue(outboxRow);

    let received: NotificationTransactionRepositories | undefined;
    const result = await harness.notificationTransaction.run((repos) => {
      received = repos;
      return Promise.resolve('work-result');
    });

    expect(result).toBe('work-result');
    expect(harness.transaction).toHaveBeenCalledTimes(1);

    // Repositories are resolved from the transaction manager, not defaults.
    expect(harness.getRepository).toHaveBeenCalledWith(NotificationOrmEntity);
    expect(harness.getRepository).toHaveBeenCalledWith(NotificationDeliveryOrmEntity);
    expect(harness.getRepository).toHaveBeenCalledWith(NotificationOutboxOrmEntity);

    expect(received).toBeDefined();
    const repos = received as NotificationTransactionRepositories;

    // The callback receives the correct adapter types.
    expect(repos.notifications).toBeInstanceOf(TypeOrmNotificationRepository);
    expect(repos.deliveries).toBeInstanceOf(TypeOrmNotificationDeliveryRepository);
    expect(repos.outbox).toBeInstanceOf(TypeOrmNotificationOutboxRepository);

    // The adapters are functioning: they delegate to the manager-provided
    // repositories and map the persisted rows back to the domain.
    const notification = await repos.notifications.findById('7');
    expect(notification?.id).toBe('7');
    expect(harness.notificationRepo.findOne).toHaveBeenCalledWith({ where: { id: '7' } });

    const delivery = await repos.deliveries.findById('11');
    expect(delivery?.recipientAddress).toBe('client@example.com');
    expect(harness.deliveryRepo.findOne).toHaveBeenCalledWith({
      where: { id: '11' },
      relations: { notification: true },
    });

    const outbox = await repos.outbox.findById('3');
    expect(outbox?.deliveryId).toBe('11');
    expect(harness.outboxRepo.findOne).toHaveBeenCalledWith({
      where: { id: '3' },
      relations: { delivery: true },
    });
  });

  it('returns the successful callback result', async () => {
    const harness = buildHarness();

    const result = await harness.notificationTransaction.run(() => Promise.resolve(42));

    expect(result).toBe(42);
  });

  it('translates an exact PostgreSQL unique conflict to DuplicateNotificationError', async () => {
    const conflict = new QueryFailedError(
      'INSERT INTO notifications ...',
      [],
      buildDriverError('23505', 'UQ_notifications_source_recipient_type'),
    );
    const harness = buildHarness(() => Promise.reject(conflict));

    const promise = harness.notificationTransaction.run(() => Promise.resolve('never'));

    await expect(promise).rejects.toBeInstanceOf(DuplicateNotificationError);
    await expect(promise).rejects.toMatchObject({ cause: conflict });
  });

  it('translates a nested driverError shape (Error-like driver error)', async () => {
    const driverError = new Error(
      'duplicate key value violates unique constraint "UQ_notifications_source_recipient_type"',
    ) as Error & { code?: string; constraint?: string };
    driverError.code = '23505';
    driverError.constraint = 'UQ_notifications_source_recipient_type';

    const conflict = new QueryFailedError('INSERT INTO notifications ...', [], driverError);
    const harness = buildHarness(() => Promise.reject(conflict));

    const promise = harness.notificationTransaction.run(() => Promise.resolve('never'));

    await expect(promise).rejects.toBeInstanceOf(DuplicateNotificationError);
    await expect(promise).rejects.toMatchObject({ cause: conflict });
  });

  it('translates a mixed direct/nested driverError shape by merging fields per key', async () => {
    // `code` lives directly on the driver error while `constraint` is nested
    // one level deeper. The transaction merges missing fields per key, so the
    // exact conflict is still recognized and translated.
    const mixedDriverError = new Error(
      'duplicate key value violates unique constraint',
    ) as Error & { code?: string; driverError?: { constraint: string } };
    mixedDriverError.code = '23505';
    mixedDriverError.driverError = { constraint: 'UQ_notifications_source_recipient_type' };

    const conflict = new QueryFailedError('INSERT INTO notifications ...', [], mixedDriverError);
    const harness = buildHarness(() => Promise.reject(conflict));

    const promise = harness.notificationTransaction.run(() => Promise.resolve('never'));

    await expect(promise).rejects.toBeInstanceOf(DuplicateNotificationError);
    await expect(promise).rejects.toMatchObject({ cause: conflict });
  });

  it('propagates a conflict with the wrong code unchanged', async () => {
    const conflict = new QueryFailedError(
      'INSERT INTO notifications ...',
      [],
      buildDriverError('23500', 'UQ_notifications_source_recipient_type'),
    );
    const harness = buildHarness(() => Promise.reject(conflict));

    await expect(harness.notificationTransaction.run(() => Promise.resolve('never'))).rejects.toBe(conflict);
  });

  it('propagates a conflict with the wrong constraint unchanged', async () => {
    const conflict = new QueryFailedError(
      'INSERT INTO notifications ...',
      [],
      buildDriverError('23505', 'UQ_some_other_constraint'),
    );
    const harness = buildHarness(() => Promise.reject(conflict));

    await expect(harness.notificationTransaction.run(() => Promise.resolve('never'))).rejects.toBe(conflict);
  });

  it('propagates a plain Error unchanged', async () => {
    const error = new Error('boom');
    const harness = buildHarness(() => Promise.reject(error));

    await expect(harness.notificationTransaction.run(() => Promise.resolve('never'))).rejects.toBe(error);
  });

  it('propagates a non-object rejection unchanged', async () => {
    // A non-Error rejection (a string) must propagate unchanged. The lint rule
    // prefers rejecting with an Error, so it is disabled for this deliberate case.
    // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
    const harness = buildHarness(() => Promise.reject('boom'));

    await expect(harness.notificationTransaction.run(() => Promise.resolve('never'))).rejects.toBe('boom');
  });

  it('observes callback errors only after DataSource.transaction rejects', async () => {
    const conflict = new QueryFailedError(
      'INSERT INTO notifications ...',
      [],
      buildDriverError('23505', 'UQ_notifications_source_recipient_type'),
    );

    // The work callback throws; the transaction mock invokes the callback and
    // propagates its rejection, so the error is observed through run()'s catch
    // (the real adapter path) rather than by bypassing the transaction boundary.
    const harness = buildHarness();
    const work = jest.fn(() => Promise.reject(conflict));

    await expect(harness.notificationTransaction.run(work)).rejects.toBeInstanceOf(
      DuplicateNotificationError,
    );
    expect(work).toHaveBeenCalledTimes(1);
    expect(harness.transaction).toHaveBeenCalledTimes(1);
  });
});
