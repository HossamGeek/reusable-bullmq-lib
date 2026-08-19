import { ConflictException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { QueueRegistryService, QueueService } from '@app/bullmq';
import { DEMO_JOB, DEMO_QUEUE } from '../../shared/constants/demo.constants';
import { RetryBackoffType } from '../dto/job.dto';
import { DemoService } from './demo.service';

type QueueServiceMock = jest.Mocked<
  Pick<
    QueueService,
    'enqueue' | 'enqueueBulk' | 'enqueueDelayed' | 'getStats' | 'getJob' | 'removeJob' | 'retryJob'
  >
>;

type ReadyQueue = { waitUntilReady: jest.Mock<Promise<void>, []> };
type QueueRegistryServiceMock = jest.Mocked<Pick<QueueRegistryService, 'get'>>;
type DemoJobData = {
  message?: string;
  payload?: Record<string, unknown>;
  failUntilAttempt?: number;
  enqueuedAt: number;
  sequence?: number;
};

const NOW = 1_725_000_000_000;

function createService() {
  const queue: QueueServiceMock = {
    enqueue: jest.fn(),
    enqueueBulk: jest.fn(),
    enqueueDelayed: jest.fn(),
    getStats: jest.fn(),
    getJob: jest.fn(),
    removeJob: jest.fn(),
    retryJob: jest.fn(),
  };
  const waitUntilReady: ReadyQueue['waitUntilReady'] = jest.fn<Promise<void>, []>();
  waitUntilReady.mockResolvedValue(undefined);
  const readyQueue: ReadyQueue = { waitUntilReady };
  const registry: QueueRegistryServiceMock = { get: jest.fn().mockReturnValue(readyQueue) };

  return {
    queue,
    readyQueue,
    registry,
    service: new DemoService(
      queue as unknown as QueueService,
      registry as unknown as QueueRegistryService,
    ),
  };
}

describe('DemoService', () => {
  let nowSpy: jest.SpyInstance<number, []>;

  beforeEach(() => {
    nowSpy = jest.spyOn(Date, 'now').mockReturnValue(NOW);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('normal', () => {
    it('delegates with demo constants and deterministic generated payload', async () => {
      const { service, queue } = createService();
      const result = { id: '1', name: DEMO_JOB, queueName: DEMO_QUEUE };
      queue.enqueue.mockResolvedValue(result);

      await expect(
        service.normal({
          message: 'hello',
          payload: { nested: true },
          failUntilAttempt: 2,
          attempts: 4,
        }),
      ).resolves.toBe(result);

      expect(queue.enqueue).toHaveBeenCalledWith(
        DEMO_QUEUE,
        DEMO_JOB,
        {
          message: 'hello',
          payload: { nested: true },
          failUntilAttempt: 2,
          enqueuedAt: NOW,
          sequence: undefined,
        },
        { attempts: 4 },
      );
    });

    it('preserves omitted attempts as an undefined attempts option', async () => {
      const { service, queue } = createService();
      queue.enqueue.mockResolvedValue({ id: '1', name: DEMO_JOB, queueName: DEMO_QUEUE });

      await service.normal({ message: 'no-attempts' });

      expect(queue.enqueue).toHaveBeenCalledWith(
        DEMO_QUEUE,
        DEMO_JOB,
        expect.objectContaining({ message: 'no-attempts' }),
        { attempts: undefined },
      );
    });

    it('passes QueueService enqueue errors through unchanged', async () => {
      const { service, queue } = createService();
      const error = new Error('enqueue failed');
      queue.enqueue.mockRejectedValue(error);

      await expect(service.normal({ message: 'boom' })).rejects.toBe(error);
    });
  });

  describe('bulk', () => {
    it.each([
      { name: 'default chunk size', dtoChunkSize: undefined, expectedChunkSize: 100 },
      { name: 'explicit chunk size', dtoChunkSize: 2, expectedChunkSize: 2 },
    ])('maps jobs with sequence and $name', async ({ dtoChunkSize, expectedChunkSize }) => {
      const { service, queue } = createService();
      const result = { accepted: 2, chunks: 1, jobs: [] };
      queue.enqueueBulk.mockResolvedValue(result);

      await expect(
        service.bulk({
          jobs: [
            { message: 'first', payload: { one: 1 }, attempts: 5 },
            { message: 'second', failUntilAttempt: 1 },
          ],
          chunkSize: dtoChunkSize,
        }),
      ).resolves.toBe(result);

      expect(queue.enqueueBulk).toHaveBeenCalledWith(
        DEMO_QUEUE,
        [
          {
            name: DEMO_JOB,
            data: {
              message: 'first',
              payload: { one: 1 },
              failUntilAttempt: undefined,
              enqueuedAt: NOW,
              sequence: 0,
            },
            opts: { attempts: 5 },
          },
          {
            name: DEMO_JOB,
            data: {
              message: 'second',
              payload: undefined,
              failUntilAttempt: 1,
              enqueuedAt: NOW,
              sequence: 1,
            },
            opts: { attempts: undefined },
          },
        ],
        expectedChunkSize,
      );
    });

    it('delegates an empty job list to QueueService', async () => {
      const { service, queue } = createService();
      queue.enqueueBulk.mockResolvedValue({ accepted: 0, chunks: 0, jobs: [] });

      await expect(service.bulk({ jobs: [] })).resolves.toEqual({
        accepted: 0,
        chunks: 0,
        jobs: [],
      });

      expect(queue.enqueueBulk).toHaveBeenCalledWith(DEMO_QUEUE, [], 100);
    });

    it('passes QueueService bulk errors through unchanged', async () => {
      const { service, queue } = createService();
      const error = new Error('bulk failed');
      queue.enqueueBulk.mockRejectedValue(error);

      await expect(service.bulk({ jobs: [{ message: 'x' }] })).rejects.toBe(error);
    });

    it('generates a fresh timestamp for each mapped bulk job', async () => {
      const { service, queue } = createService();
      nowSpy.mockReturnValueOnce(10).mockReturnValueOnce(11);
      queue.enqueueBulk.mockResolvedValue({ accepted: 2, chunks: 1, jobs: [] });

      await service.bulk({ jobs: [{ message: 'a' }, { message: 'b' }] });

      const jobs = queue.enqueueBulk.mock.calls[0][1] as Array<{ data: DemoJobData }>;
      expect(jobs.map((job) => job.data.enqueuedAt)).toEqual([10, 11]);
    });
  });

  describe('delayed', () => {
    it('delegates delay, attempts, constants, and deterministic payload', async () => {
      const { service, queue } = createService();
      queue.enqueueDelayed.mockResolvedValue({
        id: 'delay',
        name: DEMO_JOB,
        queueName: DEMO_QUEUE,
      });

      await service.delayed({
        message: 'later',
        payload: { wait: true },
        delayMs: 5_000,
        attempts: 2,
      });

      expect(queue.enqueueDelayed).toHaveBeenCalledWith(
        DEMO_QUEUE,
        DEMO_JOB,
        {
          message: 'later',
          payload: { wait: true },
          failUntilAttempt: undefined,
          enqueuedAt: NOW,
          sequence: undefined,
        },
        5_000,
        { attempts: 2 },
      );
    });

    it('preserves omitted attempts for delayed jobs', async () => {
      const { service, queue } = createService();
      queue.enqueueDelayed.mockResolvedValue({
        id: 'delay',
        name: DEMO_JOB,
        queueName: DEMO_QUEUE,
      });

      await service.delayed({ delayMs: 10 });

      expect(queue.enqueueDelayed).toHaveBeenCalledWith(
        DEMO_QUEUE,
        DEMO_JOB,
        expect.any(Object),
        10,
        { attempts: undefined },
      );
    });

    it('passes QueueService delayed errors through unchanged', async () => {
      const { service, queue } = createService();
      const error = new Error('delay failed');
      queue.enqueueDelayed.mockRejectedValue(error);

      await expect(service.delayed({ message: 'later', delayMs: 1 })).rejects.toBe(error);
    });
  });

  describe('retry', () => {
    it('applies retry defaults', async () => {
      const { service, queue } = createService();
      queue.enqueue.mockResolvedValue({ id: 'retry', name: DEMO_JOB, queueName: DEMO_QUEUE });

      await service.retry({ message: 'retry-me' });

      expect(queue.enqueue).toHaveBeenCalledWith(
        DEMO_QUEUE,
        DEMO_JOB,
        expect.objectContaining({ message: 'retry-me', failUntilAttempt: 1, enqueuedAt: NOW }),
        { attempts: 3, backoff: { type: 'fixed', delay: 100 } },
      );
    });

    it.each([
      [RetryBackoffType.Fixed, 250],
      [RetryBackoffType.Exponential, 500],
    ])('maps explicit %s backoff', async (backoffType, delay) => {
      const { service, queue } = createService();
      queue.enqueue.mockResolvedValue({ id: 'retry', name: DEMO_JOB, queueName: DEMO_QUEUE });

      await service.retry({ attempts: 4, failUntilAttempt: 2, backoffType, backoffDelayMs: delay });

      expect(queue.enqueue).toHaveBeenCalledWith(
        DEMO_QUEUE,
        DEMO_JOB,
        expect.objectContaining({ failUntilAttempt: 2 }),
        { attempts: 4, backoff: { type: backoffType, delay } },
      );
    });

    it('keeps explicit zero failUntilAttempt instead of defaulting', async () => {
      const { service, queue } = createService();
      queue.enqueue.mockResolvedValue({ id: 'retry', name: DEMO_JOB, queueName: DEMO_QUEUE });

      await service.retry({ failUntilAttempt: 0 });

      expect(queue.enqueue).toHaveBeenCalledWith(
        DEMO_QUEUE,
        DEMO_JOB,
        expect.objectContaining({ failUntilAttempt: 0 }),
        expect.any(Object),
      );
    });

    it('passes QueueService retry enqueue errors through unchanged', async () => {
      const { service, queue } = createService();
      const error = new Error('retry enqueue failed');
      queue.enqueue.mockRejectedValue(error);

      await expect(service.retry({})).rejects.toBe(error);
    });
  });

  describe('priority', () => {
    it('delegates priority, attempts, constants, and deterministic payload', async () => {
      const { service, queue } = createService();
      queue.enqueue.mockResolvedValue({ id: 'priority', name: DEMO_JOB, queueName: DEMO_QUEUE });

      await service.priority({ message: 'important', priority: 7, attempts: 2 });

      expect(queue.enqueue).toHaveBeenCalledWith(
        DEMO_QUEUE,
        DEMO_JOB,
        expect.objectContaining({ message: 'important', enqueuedAt: NOW }),
        { priority: 7, attempts: 2 },
      );
    });

    it('preserves omitted attempts for priority jobs', async () => {
      const { service, queue } = createService();
      queue.enqueue.mockResolvedValue({ id: 'priority', name: DEMO_JOB, queueName: DEMO_QUEUE });

      await service.priority({ priority: 1 });

      expect(queue.enqueue).toHaveBeenCalledWith(DEMO_QUEUE, DEMO_JOB, expect.any(Object), {
        priority: 1,
        attempts: undefined,
      });
    });

    it('passes QueueService priority errors through unchanged', async () => {
      const { service, queue } = createService();
      const error = new Error('priority failed');
      queue.enqueue.mockRejectedValue(error);

      await expect(service.priority({ priority: 9 })).rejects.toBe(error);
    });
  });

  describe('load', () => {
    it('creates requested load messages with default chunking and disabled deterministic failures', async () => {
      const { service, queue } = createService();
      queue.enqueueBulk.mockResolvedValue({ accepted: 3, chunks: 1, jobs: [] });

      await service.load({ count: 3 });

      const jobs = queue.enqueueBulk.mock.calls[0][1] as Array<{ data: DemoJobData }>;
      expect(queue.enqueueBulk).toHaveBeenCalledWith(DEMO_QUEUE, expect.any(Array), 100);
      expect(jobs.map((job) => [job.data.message, job.data.failUntilAttempt])).toEqual([
        ['load-0', undefined],
        ['load-1', undefined],
        ['load-2', undefined],
      ]);
    });

    it('sets deterministic failure indices 0, 10, and 20', async () => {
      const { service, queue } = createService();
      queue.enqueueBulk.mockResolvedValue({ accepted: 21, chunks: 1, jobs: [] });

      await service.load({ count: 21, deterministicFailures: true });

      const jobs = queue.enqueueBulk.mock.calls[0][1] as Array<{ data: DemoJobData }>;
      expect(jobs.map((job) => job.data.failUntilAttempt)).toEqual(
        Array.from({ length: 21 }, (_, index) =>
          index === 0 || index === 10 || index === 20 ? 1 : undefined,
        ),
      );
    });

    it('uses explicit load chunk size', async () => {
      const { service, queue } = createService();
      queue.enqueueBulk.mockResolvedValue({ accepted: 2, chunks: 1, jobs: [] });

      await service.load({ count: 2, chunkSize: 2, deterministicFailures: false });

      expect(queue.enqueueBulk).toHaveBeenCalledWith(DEMO_QUEUE, expect.any(Array), 2);
    });

    it('assigns sequential load sequence values', async () => {
      const { service, queue } = createService();
      queue.enqueueBulk.mockResolvedValue({ accepted: 4, chunks: 1, jobs: [] });

      await service.load({ count: 4 });

      const jobs = queue.enqueueBulk.mock.calls[0][1] as Array<{ data: DemoJobData }>;
      expect(jobs.map((job) => job.data.sequence)).toEqual([0, 1, 2, 3]);
    });

    it('passes bulk delegation errors from load through unchanged', async () => {
      const { service, queue } = createService();
      const error = new Error('load bulk failed');
      queue.enqueueBulk.mockRejectedValue(error);

      await expect(service.load({ count: 1 })).rejects.toBe(error);
    });
  });

  describe('stats', () => {
    it('delegates stats to the demo queue', async () => {
      const { service, queue } = createService();
      const stats = {
        queueName: DEMO_QUEUE,
        counts: { waiting: 1 },
        oldestWaitingAgeMs: null,
        oldestWaitingJobId: null,
      };
      queue.getStats.mockResolvedValue(stats);

      await expect(service.stats()).resolves.toBe(stats);

      expect(queue.getStats).toHaveBeenCalledWith(DEMO_QUEUE);
    });

    it('passes stats errors through unchanged', async () => {
      const { service, queue } = createService();
      const error = new Error('stats failed');
      queue.getStats.mockRejectedValue(error);

      await expect(service.stats()).rejects.toBe(error);
    });
  });

  describe('get', () => {
    it('returns an existing job from the demo queue', async () => {
      const { service, queue } = createService();
      const job: Awaited<ReturnType<QueueService['getJob']>> = {
        id: 'job-1',
        name: DEMO_JOB,
        data: 'payload',
        attemptsMade: 0,
        opts: {},
        progress: 0,
        returnvalue: 'done',
        failedReason: '',
        timestamp: NOW,
        processedOn: undefined,
        finishedOn: undefined,
        state: 'completed',
      };
      queue.getJob.mockResolvedValue(job);

      await expect(service.get('job-1')).resolves.toBe(job);

      expect(queue.getJob).toHaveBeenCalledWith(DEMO_QUEUE, 'job-1');
    });

    it('throws NotFound when the job is missing', async () => {
      const { service, queue } = createService();
      queue.getJob.mockResolvedValue(null);

      await expect(service.get('missing')).rejects.toThrow(NotFoundException);
    });

    it('passes getJob errors through unchanged', async () => {
      const { service, queue } = createService();
      const error = new Error('get failed');
      queue.getJob.mockRejectedValue(error);

      await expect(service.get('job-1')).rejects.toBe(error);
    });
  });

  describe('remove', () => {
    it('returns a removal result after QueueService removes the demo job', async () => {
      const { service, queue } = createService();
      queue.removeJob.mockResolvedValue(true);

      await expect(service.remove('job-1')).resolves.toEqual({ removed: true, id: 'job-1' });

      expect(queue.removeJob).toHaveBeenCalledWith(DEMO_QUEUE, 'job-1');
    });

    it('throws NotFound directly when QueueService returns false', async () => {
      const { service, queue } = createService();
      queue.removeJob.mockResolvedValue(false);

      await expect(service.remove('missing')).rejects.toThrow(NotFoundException);
      await expect(service.remove('missing')).rejects.not.toThrow(ConflictException);
    });

    it('transforms an underlying Error to Conflict while preserving the safe message', async () => {
      const { service, queue } = createService();
      queue.removeJob.mockRejectedValue(new Error('job is locked'));

      await expect(service.remove('job-1')).rejects.toMatchObject({
        constructor: ConflictException,
        message: 'job is locked',
      });
    });

    it('uses a stable Conflict fallback for non-Error thrown values', async () => {
      const { service, queue } = createService();
      queue.removeJob.mockRejectedValue('not an error');

      await expect(service.remove('job-1')).rejects.toMatchObject({
        constructor: ConflictException,
        message: 'Job operation conflict',
      });
    });

    it('does not transform a NotFoundException thrown by removeJob', async () => {
      const { service, queue } = createService();
      const error = new NotFoundException('Job not found');
      queue.removeJob.mockRejectedValue(error);

      await expect(service.remove('missing')).rejects.toBe(error);
    });
  });

  describe('retryJob', () => {
    it('returns a retry result after QueueService retries the demo job', async () => {
      const { service, queue } = createService();
      queue.retryJob.mockResolvedValue(true);

      await expect(service.retryJob('job-1')).resolves.toEqual({ retried: true, id: 'job-1' });

      expect(queue.retryJob).toHaveBeenCalledWith(DEMO_QUEUE, 'job-1');
    });

    it('throws NotFound directly when QueueService returns false', async () => {
      const { service, queue } = createService();
      queue.retryJob.mockResolvedValue(false);

      await expect(service.retryJob('missing')).rejects.toThrow(NotFoundException);
    });

    it('transforms an underlying Error to Conflict while preserving the safe message', async () => {
      const { service, queue } = createService();
      queue.retryJob.mockRejectedValue(new Error('job is not failed'));

      await expect(service.retryJob('job-1')).rejects.toMatchObject({
        constructor: ConflictException,
        message: 'job is not failed',
      });
    });

    it('uses a stable Conflict fallback for non-Error thrown values', async () => {
      const { service, queue } = createService();
      queue.retryJob.mockRejectedValue({ reason: 'bad state' });

      await expect(service.retryJob('job-1')).rejects.toMatchObject({
        constructor: ConflictException,
        message: 'Job operation conflict',
      });
    });
  });

  describe('ready', () => {
    it('returns ready after the demo queue connection is ready', async () => {
      const { service, registry, readyQueue } = createService();

      await expect(service.ready()).resolves.toEqual({ status: 'ready' });

      expect(registry.get).toHaveBeenCalledWith(DEMO_QUEUE);
      expect(readyQueue.waitUntilReady).toHaveBeenCalledTimes(1);
    });

    it('throws ServiceUnavailable when registry get fails', async () => {
      const { service, registry } = createService();
      registry.get.mockImplementation(() => {
        throw new Error('queue missing');
      });

      await expect(service.ready()).rejects.toThrow(ServiceUnavailableException);
    });

    it('throws ServiceUnavailable when waitUntilReady rejects', async () => {
      const { service, readyQueue } = createService();
      readyQueue.waitUntilReady.mockRejectedValue(new Error('redis down'));

      await expect(service.ready()).rejects.toThrow(ServiceUnavailableException);
    });

    it('throws ServiceUnavailable after the 500ms readiness timeout without open handles', async () => {
      jest.useFakeTimers();
      const { service, readyQueue } = createService();
      readyQueue.waitUntilReady.mockReturnValue(new Promise(() => undefined));

      const promise = service.ready();
      jest.advanceTimersByTime(500);

      await expect(promise).rejects.toThrow(ServiceUnavailableException);
      expect(jest.getTimerCount()).toBe(0);
    });
  });
});
