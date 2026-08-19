/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
import { BadRequestException } from '@nestjs/common';
import { QueueRegistryService } from '../queue-registry/queue-registry.service';
import { QueueMonitoringService } from '../monitoring/queue-monitoring.service';
import { QueueService } from './queue.service';

describe('QueueService', () => {
  const registry = (queue: any) =>
    ({ get: jest.fn(() => queue) }) as unknown as QueueRegistryService;

  it('enqueues happy path with no opts, maps supported opts, filters unsupported/undefined, and propagates add/missing errors', async () => {
    const queue = { add: jest.fn().mockResolvedValue({ id: 1, name: 'job' }) };
    const reg = registry(queue);
    const service = new QueueService(reg);

    await expect(service.enqueue('q', 'job', { a: 1 })).resolves.toEqual({
      id: '1',
      name: 'job',
      queueName: 'q',
    });
    expect(queue.add).toHaveBeenLastCalledWith('job', { a: 1 }, undefined);

    await service.enqueue('q', 'job', {}, {
      attempts: 2,
      backoff: { type: 'fixed', delay: 1 },
      delay: 5,
      priority: 1,
      removeOnComplete: 0,
      removeOnFail: false,
      jobId: 'id',
      lifo: false,
      timeout: 9,
      stackTraceLimit: 0,
      repeat: { every: 1 },
      attemptsMade: 1,
      debounce: undefined,
    } as any);
    expect(queue.add).toHaveBeenLastCalledWith(
      'job',
      {},
      {
        attempts: 2,
        backoff: { type: 'fixed', delay: 1 },
        delay: 5,
        priority: 1,
        removeOnComplete: 0,
        removeOnFail: false,
        jobId: 'id',
        lifo: false,
        timeout: 9,
        stackTraceLimit: 0,
      },
    );

    queue.add.mockRejectedValueOnce(new Error('add failed'));
    await expect(service.enqueue('q', 'job', {})).rejects.toThrow('add failed');
    await expect(
      new QueueService({
        get: jest.fn(() => {
          throw new Error('missing queue');
        }),
      } as any).enqueue('x', 'j', {}),
    ).rejects.toThrow('missing queue');
  });

  it('enqueues delayed jobs with merged override and rejects invalid delay/missing/add errors', async () => {
    const queue = { add: jest.fn().mockResolvedValue({ id: 'd', name: 'job' }) };
    const service = new QueueService(registry(queue));

    await expect(
      service.enqueueDelayed('q', 'job', {}, 50, { delay: 1, priority: 2 }),
    ).resolves.toEqual({ id: 'd', name: 'job', queueName: 'q' });
    expect(queue.add).toHaveBeenCalledWith('job', {}, { delay: 50, priority: 2 });

    for (const delay of [0, -1, 1.5, NaN, Infinity]) {
      await expect(service.enqueueDelayed('q', 'job', {}, delay)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    }
    queue.add.mockRejectedValueOnce(new Error('delayed add'));
    await expect(service.enqueueDelayed('q', 'job', {}, 1)).rejects.toThrow('delayed add');
  });

  it('validates bulk input and all names before registry access or partial enqueue', async () => {
    const get = jest.fn(() => ({ addBulk: jest.fn() }));
    const service = new QueueService({ get } as any);

    await expect(service.enqueueBulk('q', undefined as any)).rejects.toThrow(
      'jobs must be an array',
    );
    await expect(service.enqueueBulk('q', [])).resolves.toEqual({
      accepted: 0,
      chunks: 0,
      jobs: [],
    });
    for (const chunk of [0, -1, 1.2, NaN, Infinity]) {
      await expect(service.enqueueBulk('q', [{ name: 'a', data: 1 }], chunk)).rejects.toThrow(
        'chunkSize',
      );
    }
    for (const name of [undefined, null, 1, '', '   ']) {
      get.mockClear();
      await expect(service.enqueueBulk('q', [{ name, data: 1 } as any])).rejects.toThrow(
        'each bulk job requires a name',
      );
      expect(get).not.toHaveBeenCalled();
    }
  });

  it('bulk enqueues default chunk 100, exact boundary, filters per-job opts, returns refs, and propagates addBulk errors with second-chunk semantics', async () => {
    const queue = {
      addBulk: jest.fn((jobs: any[]) =>
        Promise.resolve(jobs.map((j, i) => ({ id: `${j.name}-${i}`, name: j.name }))),
      ),
    };
    const service = new QueueService(registry(queue));
    const jobs = Array.from({ length: 101 }, (_, i) => ({
      name: `j${i}`,
      data: i,
      opts: { priority: 0, repeat: { every: 1 } } as any,
    }));

    const result = await service.enqueueBulk('q', jobs);

    expect(result.accepted).toBe(101);
    expect(result.chunks).toBe(2);
    expect(queue.addBulk).toHaveBeenCalledTimes(2);
    expect(queue.addBulk.mock.calls[0][0]).toHaveLength(100);
    expect(queue.addBulk.mock.calls[0][0][0]).toEqual({
      name: 'j0',
      data: 0,
      opts: { priority: 0 },
    });
    expect(result.jobs[100]).toEqual({ id: 'j100-0', name: 'j100', queueName: 'q' });

    queue.addBulk.mockClear();
    await service.enqueueBulk('q', jobs.slice(0, 100));
    expect(queue.addBulk).toHaveBeenCalledTimes(1);

    queue.addBulk.mockReset().mockRejectedValueOnce(new Error('registry addBulk'));
    await expect(service.enqueueBulk('q', [{ name: 'a', data: 1 }])).rejects.toThrow(
      'registry addBulk',
    );

    queue.addBulk
      .mockReset()
      .mockResolvedValueOnce([{ id: '1', name: 'a' }])
      .mockRejectedValueOnce(new Error('second'));
    await expect(
      service.enqueueBulk(
        'q',
        [
          { name: 'a', data: 1 },
          { name: 'b', data: 2 },
        ],
        1,
      ),
    ).rejects.toThrow('second');
    expect(queue.addBulk).toHaveBeenCalledTimes(2);
  });

  it('gets normalized job snapshots, returns null for missing, and propagates underlying errors', async () => {
    const job = {
      id: 7,
      name: 'n',
      attemptsMade: 2,
      opts: { attempts: 3 },
      progress: 50,
      failedReason: 'no',
      timestamp: 1,
      processedOn: 2,
      finishedOn: 3,
      asJSON: () => ({ data: { x: 1 }, returnvalue: { ok: true } }),
      getState: jest.fn().mockResolvedValue('completed'),
    };
    const queue = { getJob: jest.fn().mockResolvedValue(job) };
    const service = new QueueService(registry(queue));

    await expect(service.getJob('q', '7')).resolves.toEqual({
      id: '7',
      name: 'n',
      data: { x: 1 },
      attemptsMade: 2,
      opts: { attempts: 3 },
      progress: 50,
      returnvalue: { ok: true },
      failedReason: 'no',
      timestamp: 1,
      processedOn: 2,
      finishedOn: 3,
      state: 'completed',
    });
    queue.getJob.mockResolvedValueOnce(null);
    await expect(service.getJob('q', 'x')).resolves.toBeNull();
    queue.getJob.mockRejectedValueOnce(new Error('get error'));
    await expect(service.getJob('q', 'x')).rejects.toThrow('get error');
  });

  it('removes/retries existing jobs, returns false for missing, propagates errors, and aliases delegate', async () => {
    const job = {
      remove: jest.fn().mockResolvedValue(undefined),
      retry: jest.fn().mockResolvedValue(undefined),
    };
    const queue = {
      getJob: jest.fn().mockResolvedValue(job),
      add: jest.fn().mockResolvedValue({ id: 1, name: 'a' }),
      addBulk: jest.fn().mockResolvedValue([{ id: 2, name: 'b' }]),
    };
    const service = new QueueService(registry(queue));

    await expect(service.removeJob('q', '1')).resolves.toBe(true);
    await expect(service.retryJob('q', '1')).resolves.toBe(true);
    queue.getJob.mockResolvedValueOnce(null);
    await expect(service.remove('q', '1')).resolves.toBe(false);
    queue.getJob.mockResolvedValueOnce(null);
    await expect(service.retry('q', '1')).resolves.toBe(false);
    await expect(service.add('q', 'a', {})).resolves.toEqual({
      id: '1',
      name: 'a',
      queueName: 'q',
    });
    await expect(service.addBulk('q', [{ name: 'b', data: {} }])).resolves.toEqual([
      { id: '2', name: 'b', queueName: 'q' },
    ]);
    job.remove.mockRejectedValueOnce(new Error('remove error'));
    await expect(service.removeJob('q', '1')).rejects.toThrow('remove error');
    job.retry.mockRejectedValueOnce(new Error('retry error'));
    await expect(service.retryJob('q', '1')).rejects.toThrow('retry error');
  });

  it('gets stats when monitor is present and errors when absent or monitor fails', async () => {
    const monitor = {
      stats: jest.fn().mockResolvedValue({
        queueName: 'q',
        counts: {},
        oldestWaitingAgeMs: null,
        oldestWaitingJobId: null,
      }),
    } as unknown as QueueMonitoringService;
    await expect(new QueueService({} as any, monitor).getStats('q')).resolves.toEqual({
      queueName: 'q',
      counts: {},
      oldestWaitingAgeMs: null,
      oldestWaitingJobId: null,
    });
    await expect(new QueueService({} as any).getStats('q')).rejects.toThrow('unavailable');
    (monitor.stats as jest.Mock).mockRejectedValueOnce(new Error('monitor'));
    await expect(new QueueService({} as any, monitor).getStats('q')).rejects.toThrow('monitor');
  });
});
