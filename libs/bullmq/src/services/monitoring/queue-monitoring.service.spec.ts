/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { QueueRegistryService } from '../queue-registry/queue-registry.service';
import { QueueMonitoringService, QueueMonitorService } from './queue-monitoring.service';

describe('QueueMonitoringService', () => {
  const fixedNow = 10_000;

  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(fixedNow);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('requests exact statuses and getJobs args and maps counts with deterministic waiting age', async () => {
    const counts = {
      waiting: 1,
      active: 2,
      completed: 3,
      failed: 4,
      delayed: 5,
      prioritized: 6,
      paused: 7,
      'waiting-children': 8,
    };
    const queue = {
      getJobCounts: jest.fn().mockResolvedValue(counts),
      getJobs: jest.fn().mockResolvedValue([{ id: 'a', timestamp: 9_950 }]),
    };

    const stats = await new QueueMonitoringService({ get: jest.fn(() => queue) } as any).stats('q');

    expect(queue.getJobCounts).toHaveBeenCalledWith(
      'waiting',
      'active',
      'completed',
      'failed',
      'delayed',
      'prioritized',
      'paused',
      'waiting-children',
    );
    expect(queue.getJobs).toHaveBeenCalledWith(['waiting'], 0, 0, true);
    expect(stats).toEqual({
      queueName: 'q',
      counts,
      oldestWaitingJobId: 'a',
      oldestWaitingAgeMs: 50,
    });
  });

  it('handles no waiting jobs, numeric/zero ids, and future timestamp clamp', async () => {
    const queue = { getJobCounts: jest.fn().mockResolvedValue({ waiting: 0 }), getJobs: jest.fn() };
    const service = new QueueMonitorService({
      get: jest.fn(() => queue),
    } as unknown as QueueRegistryService);

    queue.getJobs.mockResolvedValueOnce([]);
    await expect(service.stats('q')).resolves.toMatchObject({
      oldestWaitingJobId: null,
      oldestWaitingAgeMs: null,
    });

    queue.getJobs.mockResolvedValueOnce([{ id: 0, timestamp: 9_000 }]);
    await expect(service.stats('q')).resolves.toMatchObject({
      oldestWaitingJobId: '0',
      oldestWaitingAgeMs: 1_000,
    });

    queue.getJobs.mockResolvedValueOnce([{ id: 42, timestamp: 11_000 }]);
    await expect(service.stats('q')).resolves.toMatchObject({
      oldestWaitingJobId: '42',
      oldestWaitingAgeMs: 0,
    });
  });

  it('propagates missing queue and queue method errors', async () => {
    await expect(
      new QueueMonitoringService({
        get: jest.fn(() => {
          throw new Error('missing');
        }),
      } as any).stats('x'),
    ).rejects.toThrow('missing');

    const countsError = {
      getJobCounts: jest.fn().mockRejectedValue(new Error('counts')),
      getJobs: jest.fn(),
    };
    await expect(
      new QueueMonitoringService({ get: jest.fn(() => countsError) } as any).stats('q'),
    ).rejects.toThrow('counts');

    const jobsError = {
      getJobCounts: jest.fn().mockResolvedValue({}),
      getJobs: jest.fn().mockRejectedValue(new Error('jobs')),
    };
    await expect(
      new QueueMonitoringService({ get: jest.fn(() => jobsError) } as any).stats('q'),
    ).rejects.toThrow('jobs');
  });
});
