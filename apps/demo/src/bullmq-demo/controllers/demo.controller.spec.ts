import { DemoController } from './demo.controller';
import { DemoService } from '../services/demo.service';
import {
  BulkDto,
  DelayedDto,
  EnqueueJobDto,
  LoadDto,
  PriorityDto,
  RetryBackoffType,
  RetryJobDto,
} from '../dto/job.dto';

type DemoServiceMethod =
  | 'ready'
  | 'normal'
  | 'bulk'
  | 'delayed'
  | 'retry'
  | 'priority'
  | 'load'
  | 'stats'
  | 'get'
  | 'remove'
  | 'retryJob';

type DemoServiceMock = Record<DemoServiceMethod, jest.Mock>;

function createController() {
  const service: DemoServiceMock = {
    ready: jest.fn(),
    normal: jest.fn(),
    bulk: jest.fn(),
    delayed: jest.fn(),
    retry: jest.fn(),
    priority: jest.fn(),
    load: jest.fn(),
    stats: jest.fn(),
    get: jest.fn(),
    remove: jest.fn(),
    retryJob: jest.fn(),
  };

  return {
    controller: new DemoController(service as unknown as DemoService),
    service,
  };
}

describe('DemoController', () => {
  describe('health', () => {
    it('returns the static health response without calling DemoService', () => {
      const { controller, service } = createController();

      expect(controller.health()).toEqual({ status: 'ok' });
      expect(
        jest.mocked(Object.values(service)).every((mock) => mock.mock.calls.length === 0),
      ).toBe(true);
    });
  });

  describe('live', () => {
    it('returns the static liveness response without calling DemoService', () => {
      const { controller, service } = createController();

      expect(controller.live()).toEqual({ status: 'alive' });
      expect(
        jest.mocked(Object.values(service)).every((mock) => mock.mock.calls.length === 0),
      ).toBe(true);
    });
  });

  describe('ready', () => {
    it('delegates without arguments and returns the service result unchanged', () => {
      const { controller, service } = createController();
      const result = Promise.resolve({ status: 'ready' });
      service.ready.mockReturnValue(result);

      expect(controller.ready()).toBe(result);
      expect(service.ready).toHaveBeenCalledTimes(1);
      expect(service.ready).toHaveBeenCalledWith();
    });

    it('propagates service errors', async () => {
      const { controller, service } = createController();
      const error = new Error('ready failed');
      service.ready.mockRejectedValue(error);

      await expect(controller.ready()).rejects.toBe(error);
    });
  });

  describe('normal', () => {
    it('delegates the exact dto and returns the service result unchanged', () => {
      const { controller, service } = createController();
      const dto: EnqueueJobDto = {
        message: 'hello',
        payload: { nested: true },
        failUntilAttempt: 2,
        attempts: 4,
      };
      const result = Promise.resolve({ id: 'normal-1' });
      service.normal.mockReturnValue(result);

      expect(controller.normal(dto)).toBe(result);
      expect(service.normal).toHaveBeenCalledTimes(1);
      expect(service.normal).toHaveBeenCalledWith(dto);
    });

    it('propagates service errors', async () => {
      const { controller, service } = createController();
      const error = new Error('normal failed');
      service.normal.mockRejectedValue(error);

      await expect(controller.normal({ message: 'boom' })).rejects.toBe(error);
    });
  });

  describe('bulk', () => {
    it('delegates the exact dto and returns the service result unchanged', () => {
      const { controller, service } = createController();
      const dto: BulkDto = {
        jobs: [
          { message: 'first', attempts: 2 },
          { message: 'second', payload: { two: 2 } },
        ],
        chunkSize: 2,
      };
      const result = Promise.resolve({ accepted: 2, chunks: 1, jobs: [] });
      service.bulk.mockReturnValue(result);

      expect(controller.bulk(dto)).toBe(result);
      expect(service.bulk).toHaveBeenCalledTimes(1);
      expect(service.bulk).toHaveBeenCalledWith(dto);
    });

    it('propagates service errors', async () => {
      const { controller, service } = createController();
      const error = new Error('bulk failed');
      service.bulk.mockRejectedValue(error);

      await expect(controller.bulk({ jobs: [] })).rejects.toBe(error);
    });
  });

  describe('delayed', () => {
    it('delegates the exact dto and returns the service result unchanged', () => {
      const { controller, service } = createController();
      const dto: DelayedDto = { message: 'later', delayMs: 5000, attempts: 3 };
      const result = Promise.resolve({ id: 'delayed-1' });
      service.delayed.mockReturnValue(result);

      expect(controller.delayed(dto)).toBe(result);
      expect(service.delayed).toHaveBeenCalledTimes(1);
      expect(service.delayed).toHaveBeenCalledWith(dto);
    });

    it('propagates service errors', async () => {
      const { controller, service } = createController();
      const error = new Error('delayed failed');
      service.delayed.mockRejectedValue(error);

      await expect(controller.delayed({ delayMs: 1 })).rejects.toBe(error);
    });
  });

  describe('retry', () => {
    it('delegates the exact dto and returns the service result unchanged', () => {
      const { controller, service } = createController();
      const dto: RetryJobDto = {
        message: 'retry me',
        attempts: 5,
        failUntilAttempt: 2,
        backoffType: RetryBackoffType.Exponential,
        backoffDelayMs: 1000,
      };
      const result = Promise.resolve({ id: 'retry-1' });
      service.retry.mockReturnValue(result);

      expect(controller.retry(dto)).toBe(result);
      expect(service.retry).toHaveBeenCalledTimes(1);
      expect(service.retry).toHaveBeenCalledWith(dto);
    });

    it('propagates service errors', async () => {
      const { controller, service } = createController();
      const error = new Error('retry demo failed');
      service.retry.mockRejectedValue(error);

      await expect(controller.retry({ message: 'boom' })).rejects.toBe(error);
    });
  });

  describe('priority', () => {
    it('delegates the exact dto and returns the service result unchanged', () => {
      const { controller, service } = createController();
      const dto: PriorityDto = { message: 'important', priority: 1, attempts: 2 };
      const result = Promise.resolve({ id: 'priority-1' });
      service.priority.mockReturnValue(result);

      expect(controller.priority(dto)).toBe(result);
      expect(service.priority).toHaveBeenCalledTimes(1);
      expect(service.priority).toHaveBeenCalledWith(dto);
    });

    it('propagates service errors', async () => {
      const { controller, service } = createController();
      const error = new Error('priority failed');
      service.priority.mockRejectedValue(error);

      await expect(controller.priority({ priority: 1 })).rejects.toBe(error);
    });
  });

  describe('load', () => {
    it('delegates the exact dto and returns the service result unchanged', () => {
      const { controller, service } = createController();
      const dto: LoadDto = { count: 100, chunkSize: 20, deterministicFailures: true };
      const result = Promise.resolve({ accepted: 100, chunks: 5, jobs: [] });
      service.load.mockReturnValue(result);

      expect(controller.load(dto)).toBe(result);
      expect(service.load).toHaveBeenCalledTimes(1);
      expect(service.load).toHaveBeenCalledWith(dto);
    });

    it('propagates service errors', async () => {
      const { controller, service } = createController();
      const error = new Error('load failed');
      service.load.mockRejectedValue(error);

      await expect(controller.load({ count: 1 })).rejects.toBe(error);
    });
  });

  describe('stats', () => {
    it('delegates without arguments and returns the service result unchanged', () => {
      const { controller, service } = createController();
      const result = Promise.resolve({ waiting: 1, active: 2, completed: 3 });
      service.stats.mockReturnValue(result);

      expect(controller.stats()).toBe(result);
      expect(service.stats).toHaveBeenCalledTimes(1);
      expect(service.stats).toHaveBeenCalledWith();
    });

    it('propagates service errors', async () => {
      const { controller, service } = createController();
      const error = new Error('stats failed');
      service.stats.mockRejectedValue(error);

      await expect(controller.stats()).rejects.toBe(error);
    });
  });

  describe('get', () => {
    it('delegates the exact id and returns the service result unchanged', () => {
      const { controller, service } = createController();
      const result = Promise.resolve({ id: 'job-1', state: 'completed' });
      service.get.mockReturnValue(result);

      expect(controller.get('job-1')).toBe(result);
      expect(service.get).toHaveBeenCalledTimes(1);
      expect(service.get).toHaveBeenCalledWith('job-1');
    });

    it('propagates service errors', async () => {
      const { controller, service } = createController();
      const error = new Error('get failed');
      service.get.mockRejectedValue(error);

      await expect(controller.get('missing')).rejects.toBe(error);
    });
  });

  describe('remove', () => {
    it('delegates the exact id and returns the service result unchanged', () => {
      const { controller, service } = createController();
      const result = Promise.resolve({ removed: true, id: 'job-1' });
      service.remove.mockReturnValue(result);

      expect(controller.remove('job-1')).toBe(result);
      expect(service.remove).toHaveBeenCalledTimes(1);
      expect(service.remove).toHaveBeenCalledWith('job-1');
    });

    it('propagates service errors', async () => {
      const { controller, service } = createController();
      const error = new Error('remove failed');
      service.remove.mockRejectedValue(error);

      await expect(controller.remove('job-1')).rejects.toBe(error);
    });
  });

  describe('retryJob', () => {
    it('delegates the exact id and returns the service result unchanged', () => {
      const { controller, service } = createController();
      const result = Promise.resolve({ retried: true, id: 'job-1' });
      service.retryJob.mockReturnValue(result);

      expect(controller.retryJob('job-1')).toBe(result);
      expect(service.retryJob).toHaveBeenCalledTimes(1);
      expect(service.retryJob).toHaveBeenCalledWith('job-1');
    });

    it('propagates service errors', async () => {
      const { controller, service } = createController();
      const error = new Error('retry job failed');
      service.retryJob.mockRejectedValue(error);

      await expect(controller.retryJob('job-1')).rejects.toBe(error);
    });
  });
});
