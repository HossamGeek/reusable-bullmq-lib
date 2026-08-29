/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/unbound-method */
import { NotificationChannel } from '../../domain/enums/notification-channel.enum';
import { OutboxPublisherConfig } from '../config/outbox-publisher.config';
import { ExponentialRetryPolicy, RetryPolicyConfig } from '../policies/retry-policy';
import {
  NotificationOutboxRecord,
  NotificationOutboxRepository,
  OutboxPublishTransaction,
} from '../ports/persistence/notification-outbox-repository.port';
import { QueuePublisherPort } from '../ports/queue/queue-publisher.port';
import { OutboxPublisher } from './outbox-publisher.service';

describe('OutboxPublisher', () => {
  const fixedNow = new Date('2026-01-01T00:00:00.000Z');

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(fixedNow);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const buildRecord = (
    overrides: Partial<NotificationOutboxRecord> = {},
  ): NotificationOutboxRecord => ({
    id: '1',
    deliveryId: '11',
    channel: NotificationChannel.EMAIL,
    publishedAt: null,
    publishAttempts: 0,
    lastPublishError: null,
    nextPublishAt: null,
    createdAt: fixedNow,
    ...overrides,
  });

  const buildConfig = (overrides: Partial<OutboxPublisherConfig> = {}): OutboxPublisherConfig => ({
    batchSize: 100,
    ...overrides,
  });

  const buildRetryConfig = (overrides: Partial<RetryPolicyConfig> = {}): RetryPolicyConfig => ({
    baseDelayMs: 1000,
    maxDelayMs: 8000,
    ...overrides,
  });

  const buildPublisher = (deps: {
    outbox: NotificationOutboxRepository;
    publisher: QueuePublisherPort;
    config?: OutboxPublisherConfig;
    retryConfig?: RetryPolicyConfig;
  }) => {
    return new OutboxPublisher(
      deps.outbox,
      deps.publisher,
      new ExponentialRetryPolicy(deps.retryConfig ?? buildRetryConfig()),
      deps.config ?? buildConfig(),
    );
  };

  it('publishes each row and marks it published with an incremented attempt count', async () => {
    const records = [
      buildRecord({ id: '1', deliveryId: '11', publishAttempts: 0 }),
      buildRecord({
        id: '2',
        deliveryId: '12',
        channel: NotificationChannel.WHATSAPP,
        publishAttempts: 2,
      }),
    ];
    const tx: OutboxPublishTransaction = {
      markPublished: jest.fn().mockResolvedValue(undefined),
      schedulePublishRetry: jest.fn().mockResolvedValue(undefined),
    };
    const outbox = {
      processPublishable: jest
        .fn()
        .mockImplementation((_opts, processor) => processor(records, tx)),
    } as unknown as NotificationOutboxRepository;
    const publisher = {
      publishDelivery: jest.fn().mockResolvedValue(undefined),
    } as unknown as QueuePublisherPort;

    const service = buildPublisher({ outbox, publisher });
    await service.run();

    expect(publisher.publishDelivery).toHaveBeenCalledTimes(2);
    expect(publisher.publishDelivery).toHaveBeenNthCalledWith(1, {
      deliveryId: '11',
      channel: NotificationChannel.EMAIL,
    });
    expect(publisher.publishDelivery).toHaveBeenNthCalledWith(2, {
      deliveryId: '12',
      channel: NotificationChannel.WHATSAPP,
    });

    // Attempt count is incremented once per attempt, including the successful one.
    expect(tx.markPublished).toHaveBeenNthCalledWith(1, '1', fixedNow, 1);
    expect(tx.markPublished).toHaveBeenNthCalledWith(2, '2', fixedNow, 3);
    expect(tx.schedulePublishRetry).not.toHaveBeenCalled();
  });

  it('schedules a retry with the incremented attempt count, error, and policy-based next publish time on failure', async () => {
    const records = [buildRecord({ id: '1', deliveryId: '11', publishAttempts: 1 })];
    const tx: OutboxPublishTransaction = {
      markPublished: jest.fn().mockResolvedValue(undefined),
      schedulePublishRetry: jest.fn().mockResolvedValue(undefined),
    };
    const outbox = {
      processPublishable: jest
        .fn()
        .mockImplementation((_opts, processor) => processor(records, tx)),
    } as unknown as NotificationOutboxRepository;
    const publisher = {
      publishDelivery: jest.fn().mockRejectedValue(new Error('provider down')),
    } as unknown as QueuePublisherPort;

    const service = buildPublisher({ outbox, publisher });
    await service.run();

    // attempt = 1 + 1 = 2 -> delay = base * 2^(2-1) = 2000ms
    const expectedNext = new Date(fixedNow.getTime() + 2000);
    expect(tx.schedulePublishRetry).toHaveBeenCalledWith('1', expectedNext, 'provider down', 2);
    expect(tx.markPublished).not.toHaveBeenCalled();
  });

  it('continues processing the remaining rows after one row fails', async () => {
    const records = [
      buildRecord({ id: '1', deliveryId: '11' }),
      buildRecord({ id: '2', deliveryId: '12', channel: NotificationChannel.WHATSAPP }),
    ];
    const tx: OutboxPublishTransaction = {
      markPublished: jest.fn().mockResolvedValue(undefined),
      schedulePublishRetry: jest.fn().mockResolvedValue(undefined),
    };
    const outbox = {
      processPublishable: jest
        .fn()
        .mockImplementation((_opts, processor) => processor(records, tx)),
    } as unknown as NotificationOutboxRepository;
    const publisher = {
      publishDelivery: jest
        .fn()
        .mockRejectedValueOnce(new Error('first failed'))
        .mockResolvedValueOnce(undefined),
    } as unknown as QueuePublisherPort;

    const service = buildPublisher({ outbox, publisher });
    await service.run();

    expect(publisher.publishDelivery).toHaveBeenCalledTimes(2);
    expect(tx.schedulePublishRetry).toHaveBeenCalledTimes(1);
    expect(tx.markPublished).toHaveBeenCalledTimes(1);
  });

  it('passes the configured batch size and clock to the repository', async () => {
    const outbox = {
      processPublishable: jest.fn().mockResolvedValue(undefined),
    } as unknown as NotificationOutboxRepository;
    const publisher = { publishDelivery: jest.fn() } as unknown as QueuePublisherPort;

    const service = buildPublisher({ outbox, publisher, config: buildConfig({ batchSize: 25 }) });
    await service.run();

    expect(outbox.processPublishable).toHaveBeenCalledWith(
      { limit: 25, now: fixedNow },
      expect.any(Function),
    );
  });
});
